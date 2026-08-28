import type { Node } from "@xyflow/react";
import type { ComponentNodeData } from "@/store/canvasStore";
import type { NodeMetrics } from "@/types/simulation";
import { INSTANCE_HOURLY, REGION_MULTIPLIER, PRICING } from "@/data/pricing";
import { SERVICE_CONFIG, defaultConfig } from "@/data/serviceConfig";
import { resolveComponentId } from "@/data/conceptMap";

/** Billable hours in an average month (AWS convention). */
const HOURS_PER_MONTH = 730;
const SECONDS_PER_MONTH = HOURS_PER_MONTH * 3600;
const BYTES_PER_GB = 1024 ** 3;

export type CostDimension =
  | "instances"
  | "provisioned"
  | "storage"
  | "requests"
  | "transfer";

export interface CostLine {
  nodeId: string;
  label: string;
  dimension: CostDimension;
  monthly: number;
  detail: string;
}

export interface CostBreakdown {
  lines: CostLine[];
  monthlyTotal: number;
  regionMultiplier: number;
  /** True when request- and transfer-based lines are missing for want of a simulation. */
  needsSimulation: boolean;
  /** Services on the canvas we do not price at all. */
  unpriced: string[];
}

function cfg(node: Node<ComponentNodeData>): Record<string, string | number | boolean> {
  const id = resolveComponentId(node.data.componentId);
  return { ...defaultConfig(id), ...(node.data.config ?? {}) };
}

/** Requests per month implied by a node's delivered traffic. */
function requestsPerMonth(m: NodeMetrics | undefined): number {
  return m ? m.incomingQPS * SECONDS_PER_MONTH : 0;
}

/** Egress GB per month from delivered traffic and the node's declared payload size. */
function transferGB(m: NodeMetrics | undefined, payloadKB: number): number {
  if (!m) return 0;
  return (m.incomingQPS * payloadKB * 1024 * SECONDS_PER_MONTH) / BYTES_PER_GB;
}

/**
 * Estimate the monthly bill for a design.
 *
 * On-demand pricing only — no Reserved Instances, Savings Plans, or free tier.
 * Instance and storage lines need only the design; request and transfer lines
 * need delivered QPS, so they are absent until a simulation has run. That is
 * reported via `needsSimulation` rather than quietly returning a smaller total.
 */
export function estimateCost(
  nodes: Node<ComponentNodeData>[],
  metrics: Map<string, NodeMetrics> | null,
  region: string,
): CostBreakdown {
  const multiplier = REGION_MULTIPLIER[region] ?? 1;
  const lines: CostLine[] = [];
  const unpriced = new Set<string>();

  for (const node of nodes) {
    const id = resolveComponentId(node.data.componentId);
    const spec = SERVICE_CONFIG[id];
    const label = String(node.data.label ?? id);
    const c = cfg(node);
    const m = metrics?.get(node.id);
    const replicas = Math.max(1, Number(node.data.replicas) || 1);
    const push = (dimension: CostDimension, monthly: number, detail: string) => {
      if (monthly > 0) lines.push({ nodeId: node.id, label, dimension, monthly: monthly * multiplier, detail });
    };

    // --- Instance hours -------------------------------------------------
    const sizeParam = spec?.params.find((p) => p.kind === "instance");
    if (sizeParam) {
      const size = String(c[sizeParam.id]);
      const hourly = INSTANCE_HOURLY[size];
      if (hourly === undefined) {
        unpriced.add(`${label} (${size})`);
      } else {
        const multiAz = c.multiAz === true ? 2 : 1;
        const replicaCount = Number(c.readReplicas ?? 0);
        const units = replicas * multiAz + replicaCount;
        push(
          "instances",
          hourly * units * HOURS_PER_MONTH,
          `${units} x ${size} @ $${hourly}/hr` + (multiAz === 2 ? " (Multi-AZ)" : ""),
        );
      }
    }

    // --- Per-service specifics -----------------------------------------
    switch (id) {
      case "dynamodb": {
        if (c.mode === "provisioned") {
          const units = Number(c.capacityUnits ?? 0);
          // Split the configured units evenly between reads and writes.
          const cost =
            (units / 2) * (PRICING.dynamodb.readUnitHour ?? 0) * HOURS_PER_MONTH +
            (units / 2) * (PRICING.dynamodb.writeUnitHour ?? 0) * HOURS_PER_MONTH;
          push("provisioned", cost, `${units.toLocaleString()} provisioned capacity units`);
        } else if (m) {
          const reads = m.incomingReads * SECONDS_PER_MONTH;
          const writes = m.incomingWrites * SECONDS_PER_MONTH;
          push(
            "requests",
            reads * (PRICING.dynamodb.onDemandRead ?? 0) + writes * (PRICING.dynamodb.onDemandWrite ?? 0),
            `on-demand: ${(reads / 1e6).toFixed(1)}M reads, ${(writes / 1e6).toFixed(1)}M writes`,
          );
        }
        break;
      }
      case "kinesis": {
        const shards = Number(c.shards ?? 0);
        push("provisioned", shards * (PRICING.kinesis.shardHour ?? 0) * HOURS_PER_MONTH, `${shards} shards`);
        break;
      }
      case "lambda": {
        if (m) {
          const reqs = requestsPerMonth(m);
          const memGB = Number(c.memory ?? 1024) / 1024;
          // 50ms average duration, the same assumption the capacity model makes.
          const gbSeconds = reqs * memGB * 0.05;
          push(
            "requests",
            reqs * (PRICING.lambda.perRequest ?? 0) + gbSeconds * (PRICING.lambda.gbSecond ?? 0),
            `${(reqs / 1e6).toFixed(1)}M invocations at ${c.memory} MB`,
          );
        }
        break;
      }
      case "s3": {
        const gb = Number(c.storageGB ?? 0);
        const cls = String(c.storageClass ?? "standard") as keyof typeof PRICING.s3.storageGBMonth;
        const rate = PRICING.s3.storageGBMonth[cls] ?? PRICING.s3.storageGBMonth.standard ?? 0;
        push("storage", gb * rate, `${gb.toLocaleString()} GB ${cls} @ $${rate}/GB-mo`);
        if (m) {
          const reqs = requestsPerMonth(m);
          push(
            "requests",
            (reqs / 1000) * (PRICING.s3.getPer1000 ?? 0),
            `${(reqs / 1e6).toFixed(1)}M requests`,
          );
        }
        break;
      }
      case "efs": {
        const gb = Number(c.storageGB ?? 0);
        push("storage", gb * 0.3, `${gb.toLocaleString()} GB @ $0.30/GB-mo`);
        break;
      }
      case "api-gateway": {
        if (m) {
          const reqs = requestsPerMonth(m);
          const rate =
            c.apiType === "http"
              ? (PRICING.apiGateway.httpPerRequest ?? 0)
              : (PRICING.apiGateway.restPerRequest ?? 0);
          push("requests", reqs * rate, `${(reqs / 1e6).toFixed(1)}M ${String(c.apiType).toUpperCase()} requests`);
        }
        break;
      }
      case "cloudfront": {
        if (m) {
          const reqs = requestsPerMonth(m);
          const gb = transferGB(m, Number(c.payloadKB ?? 0));
          push(
            "transfer",
            gb * (PRICING.cloudfront.egressGB ?? 0) + reqs * (PRICING.cloudfront.perRequestHttps ?? 0),
            `${gb.toFixed(0)} GB egress @ $${PRICING.cloudfront.egressGB}/GB`,
          );
        }
        break;
      }
      case "nat-gateway": {
        push("instances", PRICING.natGateway.hourly * HOURS_PER_MONTH, `$${PRICING.natGateway.hourly}/hr`);
        if (m) {
          const gb = transferGB(m, Number(c.payloadKB ?? 0));
          push("transfer", gb * PRICING.natGateway.perGB, `${gb.toFixed(0)} GB processed @ $${PRICING.natGateway.perGB}/GB`);
        }
        break;
      }
      default:
        // Services with an instance line are priced; the rest we do not claim to price.
        if (!sizeParam && spec && spec.params.length >= 0 && !FREE_SERVICES.has(id)) {
          unpriced.add(label);
        }
    }
  }

  lines.sort((a, b) => b.monthly - a.monthly);
  return {
    lines,
    monthlyTotal: lines.reduce((s, l) => s + l.monthly, 0),
    regionMultiplier: multiplier,
    needsSimulation: metrics === null,
    unpriced: [...unpriced].sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * Services that genuinely cost nothing to have on a diagram — control-plane
 * and boundary constructs. Listing them explicitly keeps them out of the
 * "not priced" warning, which is reserved for real gaps in our data.
 */
const FREE_SERVICES = new Set([
  "vpc", "iam", "privatelink", "cloud-map", "app-mesh", "appconfig",
  "route53", "waf", "cognito", "secrets-manager", "kms", "sns", "sqs",
  "eventbridge", "eventbridge-scheduler", "step-functions", "appsync",
  "cloudwatch", "xray", "alb", "nlb", "global-accelerator", "custom",
]);
