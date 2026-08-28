import { SYSTEM_COMPONENTS } from "@/data/components";
import { resolveComponentId } from "@/data/conceptMap";
import { findSize } from "@/data/instanceFamilies";

/**
 * Per-service configuration schemas.
 *
 * Schemas are DATA, rendered by one generic panel — adding a service's
 * configuration never means writing a component.
 *
 * Capacity derives from published AWS specs wherever possible: vCPU counts for
 * instance-shaped services, and real provisioned units (DynamoDB capacity
 * units, Kinesis shards, Lambda concurrency) elsewhere. The one estimated
 * number per service is `throughput.qps`, and its `note` says what it assumes.
 *
 * INVARIANT: deriveCapacity(service, defaults) === service.maxQPS. The catalog
 * figure IS capacity at default configuration, so the two cannot drift —
 * check-catalog fails the build if they do.
 */

export type ConfigParam =
  | {
      id: string;
      kind: "instance";
      label: string;
      /** Keys into INSTANCE_FAMILIES. */
      families: string[];
      default: string;
      help?: string;
    }
  | {
      id: string;
      kind: "choice";
      label: string;
      options: {
        value: string;
        label: string;
        help?: string;
        /** Selecting this option pins capacity to this QPS (e.g. SQS FIFO). */
        capacity?: number;
      }[];
      default: string;
      help?: string;
    }
  | {
      id: string;
      kind: "number";
      label: string;
      unit: string;
      default: number;
      min: number;
      max: number;
      /** This value multiplies `throughput.qps` to give capacity. */
      drivesCapacity?: boolean;
      help?: string;
    }
  | { id: string; kind: "toggle"; label: string; default: boolean; help?: string };

export interface ServiceConfigSpec {
  params: ConfigParam[];
  throughput: {
    /** vcpu: qps per vCPU. unit: qps per unit of the capacity-driving param. fixed: the catalog constant. */
    per: "vcpu" | "unit" | "fixed";
    qps: number;
    note: string;
  };
}

const fixed = (qps: number, note: string): ServiceConfigSpec => ({
  params: [],
  throughput: { per: "fixed", qps, note },
});

export const SERVICE_CONFIG: Record<string, ServiceConfigSpec> = {
  // ---------- Compute ----------
  ec2: {
    params: [
      {
        id: "size",
        kind: "instance",
        label: "Instance type",
        families: ["t3", "m5", "m6g", "c5", "c6g", "r5"],
        default: "m5.large",
        help: "Pick the family to match the bottleneck: c for CPU, r for memory, m when balanced, t for bursty low traffic.",
      },
    ],
    throughput: {
      per: "vcpu",
      qps: 2500,
      note: "Assumes a light JSON API at roughly 2,500 req/s per vCPU. CPU-heavy work will be far lower.",
    },
  },
  ecs: {
    params: [
      {
        id: "size",
        kind: "instance",
        label: "Task size",
        families: ["m5", "m6g", "c5", "c6g", "fargate"],
        default: "m5.4xlarge",
        help: "Container task sizing. Scale out with task count rather than up, where the workload allows.",
      },
    ],
    throughput: {
      per: "vcpu",
      qps: 3125,
      note: "Assumes lightweight containers serving ~3,125 req/s per vCPU in aggregate across the service.",
    },
  },
  eks: {
    params: [
      {
        id: "size",
        kind: "instance",
        label: "Node size",
        families: ["m5", "m6g", "c5", "c6g"],
        default: "m5.4xlarge",
        help: "Worker node sizing. Pod density and requests/limits decide how much of this is usable.",
      },
    ],
    throughput: {
      per: "vcpu",
      qps: 3125,
      note: "Assumes lightweight pods serving ~3,125 req/s per vCPU in aggregate across the cluster.",
    },
  },
  fargate: {
    params: [
      {
        id: "size",
        kind: "instance",
        label: "Task size",
        families: ["fargate"],
        default: "1 vCPU",
        help: "Fargate bills per task vCPU and GB — there is no instance to right-size or patch.",
      },
    ],
    throughput: {
      per: "vcpu",
      qps: 5000,
      note: "Assumes a light containerised API at roughly 5,000 req/s per task vCPU.",
    },
  },
  lambda: {
    params: [
      {
        id: "memory",
        kind: "choice",
        label: "Memory",
        options: [
          { value: "128", label: "128 MB", help: "Minimum. CPU scales with memory, so this is also the slowest." },
          { value: "512", label: "512 MB" },
          { value: "1024", label: "1024 MB" },
          { value: "3008", label: "3008 MB" },
          { value: "10240", label: "10240 MB", help: "Maximum. Buys more vCPU as well as more memory." },
        ],
        default: "1024",
      },
      {
        id: "concurrency",
        kind: "number",
        label: "Concurrency",
        unit: "executions",
        default: 1000,
        min: 10,
        max: 10000,
        drivesCapacity: true,
        help: "Default account limit is 1,000 concurrent executions per region (raisable).",
      },
    ],
    throughput: {
      per: "unit",
      qps: 20,
      note: "20 req/s per concurrent execution assumes ~50ms average duration. Slower functions yield less per unit.",
    },
  },

  // ---------- Database ----------
  rds: {
    params: [
      {
        id: "size",
        kind: "instance",
        label: "Instance class",
        families: ["db.t3", "db.m5", "db.r5"],
        default: "db.m5.large",
      },
      {
        id: "multiAz",
        kind: "toggle",
        label: "Multi-AZ",
        default: true,
        help: "Synchronous standby in another Availability Zone. Roughly doubles cost; does not add read capacity.",
      },
      {
        id: "readReplicas",
        kind: "number",
        label: "Read replicas",
        unit: "replicas",
        default: 0,
        min: 0,
        max: 5,
        help: "Up to 5 for MySQL and PostgreSQL. Replicas add read capacity only — every write still goes to the single primary.",
      },
    ],
    throughput: {
      per: "vcpu",
      qps: 5000,
      note: "Assumes indexed OLTP queries. Real ceilings are usually IO or connection limits, not CPU.",
    },
  },
  aurora: {
    params: [
      {
        id: "size",
        kind: "instance",
        label: "Instance class",
        families: ["db.t3", "db.m5", "db.r5"],
        default: "db.r5.2xlarge",
      },
      {
        id: "readReplicas",
        kind: "number",
        label: "Read replicas",
        unit: "replicas",
        default: 2,
        min: 0,
        max: 15,
        help: "Up to 15, sharing the same storage volume with low replication lag.",
      },
    ],
    throughput: {
      per: "vcpu",
      qps: 6250,
      note: "Assumes Aurora's decoupled storage advantage over stock MySQL on the same class.",
    },
  },
  dynamodb: {
    params: [
      {
        id: "mode",
        kind: "choice",
        label: "Capacity mode",
        options: [
          { value: "provisioned", label: "Provisioned", help: "You set capacity units. Cheaper for steady, predictable load." },
          { value: "ondemand", label: "On-demand", help: "Scales automatically, priced per request. Better for spiky or unknown traffic.", capacity: 40000 },
        ],
        default: "provisioned",
      },
      {
        id: "capacityUnits",
        kind: "number",
        label: "Capacity units",
        unit: "RCU/WCU",
        default: 40000,
        min: 100,
        max: 200000,
        drivesCapacity: true,
        help: "One RCU is one strongly-consistent read per second for a 4 KB item. Default table quota is 40,000.",
      },
    ],
    throughput: {
      per: "unit",
      qps: 1,
      note: "One capacity unit is one request per second by definition — this is an AWS quota, not an estimate.",
    },
  },
  elasticache: {
    params: [
      {
        id: "size",
        kind: "instance",
        label: "Node type",
        families: ["cache.t3", "cache.r6g"],
        default: "cache.r6g.large",
      },
      {
        id: "shards",
        kind: "number",
        label: "Shards",
        unit: "shards",
        default: 1,
        min: 1,
        max: 500,
        help: "Cluster mode splits the keyspace across shards for horizontal scale.",
      },
      {
        id: "cacheHitRate",
        kind: "number",
        label: "Cache hit rate",
        unit: "%",
        default: 85,
        min: 0,
        max: 99,
        help: "Share of reads served from cache. At 85%, the database still sees 15% of reads — that ratio is usually the difference between one instance and ten.",
      },
    ],
    throughput: {
      per: "vcpu",
      qps: 50000,
      note: "In-memory operations are cheap; a modern Redis/Valkey node sustains roughly 100k simple ops/s on 2 vCPU.",
    },
  },
  documentdb: {
    params: [
      { id: "size", kind: "instance", label: "Instance class", families: ["db.r5", "db.m5"], default: "db.r5.xlarge" },
    ],
    throughput: { per: "vcpu", qps: 5000, note: "Assumes indexed document reads on a warm working set." },
  },
  neptune: {
    params: [
      { id: "size", kind: "instance", label: "Instance class", families: ["db.r5", "db.m5"], default: "db.r5.xlarge" },
    ],
    throughput: { per: "vcpu", qps: 5000, note: "Assumes bounded traversals; deep multi-hop queries are far more expensive." },
  },
  timestream: fixed(50000, "Serverless ingestion scales automatically; no instance to size."),

  // ---------- Analytics ----------
  opensearch: {
    params: [
      { id: "size", kind: "instance", label: "Data node type", families: ["r5", "m5", "c5"], default: "r5.xlarge" },
      {
        id: "shards",
        kind: "number",
        label: "Primary shards",
        unit: "shards",
        default: 5,
        min: 1,
        max: 100,
        help: "Shard count fixes the parallelism of a query and cannot be changed without reindexing.",
      },
    ],
    throughput: { per: "vcpu", qps: 7500, note: "Assumes cached term queries. Aggregations and deep pagination are much heavier." },
  },
  kinesis: {
    params: [
      {
        id: "shards",
        kind: "number",
        label: "Shards",
        unit: "shards",
        default: 100,
        min: 1,
        max: 10000,
        drivesCapacity: true,
        help: "Each shard ingests 1 MB/s or 1,000 records/s. This is an AWS quota, not an estimate.",
      },
    ],
    throughput: { per: "unit", qps: 1000, note: "1,000 records/s per shard is the documented AWS limit." },
  },
  msk: {
    params: [
      { id: "size", kind: "instance", label: "Broker type", families: ["m5", "m6g"], default: "m5.4xlarge" },
      { id: "brokers", kind: "number", label: "Brokers", unit: "brokers", default: 3, min: 2, max: 30, help: "Partitions spread across brokers; replication factor decides durability." },
    ],
    throughput: { per: "vcpu", qps: 12500, note: "Assumes small messages with batching, which Kafka handles very efficiently." },
  },
  redshift: fixed(500, "Analytical warehouses run few heavy queries; concurrency, not QPS, is the real limit."),
  athena: fixed(25, "Serverless and quota-limited to roughly 20-25 concurrent queries per account."),
  glue: fixed(100, "Batch ETL — throughput is job-shaped, not request-shaped."),
  firehose: fixed(50000, "Delivery-stream throughput scales automatically on request."),

  // ---------- Storage ----------
  s3: {
    params: [
      {
        id: "storageClass",
        kind: "choice",
        label: "Storage class",
        options: [
          { value: "standard", label: "Standard", help: "Frequent access. Highest storage price, no retrieval fee." },
          { value: "ia", label: "Infrequent Access", help: "Cheaper storage, per-GB retrieval fee, 30-day minimum." },
          { value: "glacier-ir", label: "Glacier Instant Retrieval", help: "Archive pricing with millisecond access." },
          { value: "glacier", label: "Glacier Flexible Retrieval", help: "Archive storage at a fraction of Standard; retrieval takes minutes to hours." },
        ],
        default: "standard",
      },
      { id: "storageGB", kind: "number", label: "Stored data", unit: "GB", default: 1000, min: 1, max: 10000000 },
    ],
    throughput: { per: "fixed", qps: 5500, note: "5,500 GET/s per partitioned prefix is an AWS quota. Spread keys across prefixes to scale." },
  },
  efs: {
    params: [
      {
        id: "throughputMode",
        kind: "choice",
        label: "Throughput mode",
        options: [
          { value: "elastic", label: "Elastic", help: "Scales automatically, priced per use." },
          { value: "provisioned", label: "Provisioned", help: "Fixed throughput regardless of stored size." },
        ],
        default: "elastic",
      },
      { id: "storageGB", kind: "number", label: "Stored data", unit: "GB", default: 500, min: 1, max: 1000000 },
    ],
    throughput: { per: "fixed", qps: 35000, note: "General Purpose mode supports up to 35,000 read IOPS." },
  },

  // ---------- Integration ----------
  sqs: {
    params: [
      {
        id: "queueType",
        kind: "choice",
        label: "Queue type",
        options: [
          { value: "standard", label: "Standard", help: "Near-unlimited throughput, at-least-once delivery, best-effort ordering." },
          { value: "fifo", label: "FIFO", help: "Exactly-once processing and strict ordering — but capped at 300 msg/s (3,000 batched).", capacity: 300 },
        ],
        default: "standard",
      },
      { id: "visibilityTimeout", kind: "number", label: "Visibility timeout", unit: "s", default: 30, min: 0, max: 43200, help: "How long a message stays hidden after a receive. Too short and work is done twice." },
    ],
    throughput: { per: "fixed", qps: 100000, note: "Standard queues support near-unlimited transactions per second." },
  },
  sns: fixed(30000, "Standard topics support 30,000 publishes/s in the largest regions."),
  eventbridge: fixed(10000, "Default PutEvents quota is 10,000 requests/s in the largest regions."),
  "eventbridge-scheduler": fixed(1000, "Models invocation throughput; a scheduler is not a request-path component."),
  "step-functions": {
    params: [
      {
        id: "workflowType",
        kind: "choice",
        label: "Workflow type",
        options: [
          { value: "standard", label: "Standard", help: "Durable, runs up to a year, exactly-once, priced per state transition." },
          { value: "express", label: "Express", help: "Up to 100,000 executions/s for short high-volume work, priced per duration.", capacity: 100000 },
        ],
        default: "standard",
      },
    ],
    throughput: { per: "fixed", qps: 2000, note: "Standard workflows start at 2,000 executions/s." },
  },
  appsync: fixed(10000, "Default request-rate quota is 10,000 requests/s per API."),
  "app-mesh": fixed(100000, "Control plane distributing config to Envoy sidecars; not a throughput bottleneck."),

  // ---------- Networking ----------
  "api-gateway": {
    params: [
      {
        id: "apiType",
        kind: "choice",
        label: "API type",
        options: [
          { value: "rest", label: "REST API", help: "Full feature set: usage plans, API keys, request validation, caching." },
          { value: "http", label: "HTTP API", help: "Cheaper and lower latency, with a reduced feature set." },
          { value: "websocket", label: "WebSocket API", help: "Persistent bidirectional connections." },
        ],
        default: "rest",
      },
      {
        id: "throttle",
        kind: "number",
        label: "Throttle rate",
        unit: "req/s",
        default: 10000,
        min: 100,
        max: 100000,
        drivesCapacity: true,
        help: "Default account-level throttle is 10,000 req/s across all APIs in a region (raisable).",
      },
    ],
    throughput: { per: "unit", qps: 1, note: "Capacity is exactly the configured throttle — an AWS quota, not an estimate." },
  },
  cloudfront: {
    params: [
      {
        id: "payloadKB",
        kind: "number",
        label: "Avg response size",
        unit: "KB",
        default: 10,
        min: 1,
        max: 100000,
        help: "Drives the data-transfer line on the bill, which is often the largest. This is YOUR assumption — set it to your real average response size.",
      },
      {
        id: "cacheHitRate",
        kind: "number",
        label: "Cache hit rate",
        unit: "%",
        default: 90,
        min: 0,
        max: 99,
        help: "Share of reads served from an edge location. Misses pay the full origin round trip, so this ratio drives both origin load and perceived latency.",
      },
    ],
    throughput: { per: "fixed", qps: 250000, note: "Default quota is 250,000 requests/s per distribution." },
  },
  alb: fixed(200000, "Scales automatically with load; capacity is billed via LCUs rather than capped."),
  nlb: fixed(1000000, "Handles millions of requests per second at layer 4."),
  route53: fixed(1000000, "Designed for effectively unlimited authoritative DNS query volume."),
  vpc: fixed(1000000, "A network boundary, not a request-processing hop."),
  "nat-gateway": {
    params: [
      {
        id: "payloadKB",
        kind: "number",
        label: "Avg response size",
        unit: "KB",
        default: 10,
        min: 1,
        max: 100000,
        help: "Every GB leaving a private subnet through NAT is billed twice over: hourly plus per-GB processing. A surprisingly common source of bill shock.",
      },
    ],
    throughput: { per: "fixed", qps: 55000, note: "Up to 55,000 simultaneous connections per unique destination." },
  },
  privatelink: fixed(100000, "Throughput follows the backing VPC endpoint."),
  "global-accelerator": fixed(1000000, "Throughput follows the backing endpoints."),

  // ---------- Security ----------
  waf: fixed(250000, "Inspects requests inline at CloudFront, ALB, or API Gateway and scales with them."),
  cognito: fixed(10000, "User-pool operation quotas are per-category and per-region."),
  iam: fixed(1000000, "Authorization happens in the AWS control plane, not as a hop in your request path."),
  "secrets-manager": fixed(10000, "GetSecretValue default quota is 10,000 requests/s; applications should cache."),
  kms: fixed(50000, "Shared cryptographic operation quotas are in the tens of thousands per second."),

  // ---------- Observability ----------
  cloudwatch: fixed(100000, "Telemetry ingestion scales with the account and sits off the request path."),
  xray: fixed(100000, "Sampled tracing; overhead is negligible."),
  "cloud-map": fixed(100000, "Discovery happens at connection setup, not per request."),
  appconfig: fixed(10000, "Clients poll and cache; configuration is not fetched per request."),
};

/** The default value of every param in a service's schema. */
export function defaultConfig(componentId: string): Record<string, string | number | boolean> {
  const spec = SERVICE_CONFIG[resolveComponentId(componentId)];
  if (!spec) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const p of spec.params) out[p.id] = p.default;
  return out;
}

export interface DerivedCapacity {
  maxQPS: number;
  latencyMs: number;
  /** Human-readable arithmetic, shown in the panel so the number is not magic. */
  explanation: string;
}

/**
 * Capacity for one unit (one instance / node / task) at the given config.
 * The node's `replicas` multiplies this — that stays in the simulator, unchanged.
 */
export function deriveCapacity(
  componentId: string,
  config: Record<string, string | number | boolean> | undefined,
): DerivedCapacity {
  const resolved = resolveComponentId(componentId);
  const component = SYSTEM_COMPONENTS.find((c) => c.id === resolved);
  const spec = SERVICE_CONFIG[resolved];
  const latencyMs = component?.latencyMs ?? 0;

  if (!spec || !component) {
    return { maxQPS: component?.maxQPS ?? 0, latencyMs, explanation: "Catalog default" };
  }

  const values = { ...defaultConfig(resolved), ...(config ?? {}) };

  // A choice option may pin capacity outright (SQS FIFO, Step Functions Express).
  for (const p of spec.params) {
    if (p.kind !== "choice") continue;
    const chosen = p.options.find((o) => o.value === values[p.id]);
    if (chosen?.capacity !== undefined) {
      return {
        maxQPS: chosen.capacity,
        latencyMs,
        explanation: `${chosen.label}: ${chosen.capacity.toLocaleString()} QPS`,
      };
    }
  }

  if (spec.throughput.per === "vcpu") {
    const sizeParam = spec.params.find((p) => p.kind === "instance");
    const sizeValue = sizeParam ? String(values[sizeParam.id]) : "";
    const size = findSize(sizeValue);
    const vcpu = size?.vcpu ?? 1;
    const maxQPS = Math.round(vcpu * spec.throughput.qps);
    return {
      maxQPS,
      latencyMs,
      explanation: `${vcpu} vCPU x ${spec.throughput.qps.toLocaleString()} QPS/vCPU = ${maxQPS.toLocaleString()} QPS`,
    };
  }

  if (spec.throughput.per === "unit") {
    const driver = spec.params.find((p) => p.kind === "number" && p.drivesCapacity);
    const units = driver ? Number(values[driver.id]) : 1;
    const maxQPS = Math.round(units * spec.throughput.qps);
    const unitLabel = driver && driver.kind === "number" ? driver.unit : "units";
    return {
      maxQPS,
      latencyMs,
      explanation: `${units.toLocaleString()} ${unitLabel} x ${spec.throughput.qps.toLocaleString()} = ${maxQPS.toLocaleString()} QPS`,
    };
  }

  return {
    maxQPS: spec.throughput.qps,
    latencyMs,
    explanation: `${spec.throughput.qps.toLocaleString()} QPS (fixed)`,
  };
}
