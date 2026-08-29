import type { Node, Edge } from "@xyflow/react";
import type { ComponentNodeData } from "@/store/canvasStore";
import type { NodeMetrics, SimulationResult } from "@/types/simulation";
import { runSimulation } from "@/engine/simulator";
import { resolveComponentId } from "@/data/conceptMap";

/**
 * Time-stepped simulation.
 *
 * The steady-state engine (`runSimulation`) answers "at this sustained load,
 * where does this design break?". It cannot show a queue absorbing a burst,
 * autoscaling arriving too late, or a retry storm compounding, because none of
 * those exist without a clock.
 *
 * CORRECTNESS ORACLE: under the `steady` scenario, running to convergence must
 * reproduce `runSimulation`'s answer for every reference solution. Queues drain,
 * capacity settles, and the resulting steady state IS what the snapshot
 * computes. A mismatch is a bug in the tick model, never a tolerance to widen.
 */

export type ScenarioId = "steady" | "spike" | "ramp" | "outage";

export interface Scenario {
  id: ScenarioId;
  label: string;
  description: string;
  /** Offered load at tick t, as a multiple of the baseline QPS. */
  loadAt: (t: number, ticks: number) => number;
  /** Ticks during which a consumer is unavailable (capacity forced to zero). */
  outageAt?: (t: number, ticks: number) => boolean;
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  steady: {
    id: "steady",
    label: "Steady",
    description:
      "Constant load. This is the assessment scenario — it converges to the same answer the steady-state engine gives.",
    loadAt: () => 1,
  },
  spike: {
    id: "spike",
    label: "Spike",
    description:
      "A sudden 4x burst for 15 seconds. Watch whether a queue absorbs it — and note that autoscaling arrives too late to help.",
    loadAt: (t, ticks) => (t >= Math.floor(ticks * 0.25) && t < Math.floor(ticks * 0.25) + 15 ? 4 : 1),
  },
  ramp: {
    id: "ramp",
    label: "Ramp",
    description: "Load climbs steadily to 3x. Slow enough that autoscaling can keep up — if you have it.",
    loadAt: (t, ticks) => 1 + (2 * t) / ticks,
  },
  outage: {
    id: "outage",
    label: "Consumer outage",
    description:
      "A downstream consumer goes dark for 20 seconds. A queue retains the work; without one it is lost.",
    loadAt: () => 1,
    outageAt: (t, ticks) => t >= Math.floor(ticks * 0.3) && t < Math.floor(ticks * 0.3) + 20,
  },
};

export interface TickSnapshot {
  t: number;
  /** Offered load this tick, including retries carried from the previous tick. */
  offeredQPS: number;
  deliveredQPS: number;
  backlogTotal: number;
  nodeMetrics: Map<string, NodeMetrics>;
}

export interface TickRunOptions {
  ticks?: number;
  scenario?: ScenarioId;
  readRatio?: number;
  /** Fraction of shed requests that are retried on the next tick. 0 disables. */
  retryRate?: number;
  /** Enable capacity growth under sustained load. */
  autoscaling?: boolean;
}

export interface TickResult extends SimulationResult {
  series: TickSnapshot[];
  scenario: ScenarioId;
  /** Set when retries drove offered load past the safety cap. */
  retryStorm: boolean;
}

/** Services that buffer work rather than shedding it. */
const QUEUE_SERVICES = new Set(["sqs", "kinesis", "msk", "eventbridge", "sns"]);

/** Hard ceiling on offered load, as a multiple of baseline. Prevents a hang. */
const RETRY_STORM_CAP = 5;

/** Amplification beyond this multiple is reported as a retry storm. */
const RETRY_STORM_FLAG = 2;

/** Autoscaling adds at most this multiple of the configured instance count. */
const MAX_SCALE = 4;

function isQueue(node: Node<ComponentNodeData>): boolean {
  return QUEUE_SERVICES.has(resolveComponentId(String(node.data.componentId)));
}

/**
 * Run the design over time.
 *
 * Tick ordering — decided explicitly, because this is where simulators of this
 * kind go wrong:
 *   1. arrivals = scenario load + retries carried from t-1
 *   2. propagate and serve with the capacity this tick STARTED with
 *   3. queues absorb overflow into backlog; non-queues shed
 *   4. record metrics
 *   5. autoscaling adjusts capacity, applied to t+1
 *   6. shed requests become retries, applied to t+1
 *
 * Both feedback paths lag by one tick. That is the physical truth, it is why
 * autoscaling cannot rescue a sudden spike, and it removes within-tick
 * circularity.
 */
export function runTickedSimulation(
  nodes: Node<ComponentNodeData>[],
  edges: Edge[],
  baselineQPS: number,
  options: TickRunOptions = {},
): TickResult {
  const ticks = options.ticks ?? 120;
  const scenarioId = options.scenario ?? "steady";
  const scenario = SCENARIOS[scenarioId];
  const readRatio = options.readRatio ?? 0.9;
  const retryRate = options.retryRate ?? 0;
  const autoscaling = options.autoscaling ?? false;

  const series: TickSnapshot[] = [];
  const backlog = new Map<string, number>();
  const scale = new Map<string, number>();
  const utilEma = new Map<string, number>();
  for (const n of nodes) {
    backlog.set(n.id, 0);
    scale.set(n.id, 1);
    utilEma.set(n.id, 0);
  }

  // A queue drains at the rate its consumers can absorb. Computed once: the
  // graph does not change between ticks, only load and capacity do.
  const consumerCapacity = new Map<string, number>();
  for (const n of nodes) {
    if (!isQueue(n)) continue;
    let cap = 0;
    for (const edge of edges) {
      if (edge.source !== n.id) continue;
      const child = nodes.find((c) => c.id === edge.target);
      if (!child) continue;
      const childCap = deriveNodeCapacity(child);
      cap += childCap;
    }
    consumerCapacity.set(n.id, cap);
  }

  let carriedRetries = 0;
  let retryStorm = false;
  let last: SimulationResult | null = null;

  for (let t = 0; t < ticks; t++) {
    // 1. Arrivals: scenario load plus retries carried from the previous tick.
    const scenarioLoad = baselineQPS * scenario.loadAt(t, ticks);
    const offered = scenarioLoad + carriedRetries;

    // 2. Propagate and serve with this tick's starting capacity. Queue backlog
    //    is folded into the queue's own capacity budget for the tick, and
    //    autoscaling is expressed as a replica multiplier — both keep the
    //    existing engine as the single implementation of graph traversal.
    const tickNodes = nodes.map((n) => {
      const outage = scenario.outageAt?.(t, ticks) === true && isQueue(n) === false && !isEntryish(n);
      const replicas = Math.max(1, Number(n.data.replicas) || 1) * (scale.get(n.id) ?? 1);
      return {
        ...n,
        data: {
          ...n.data,
          replicas: outage ? 0 : replicas,
        },
      } as Node<ComponentNodeData>;
    });

    const r = runSimulation(tickNodes, edges, offered, readRatio);
    last = r;

    // 3. Queues absorb what could not be served; everything else sheds.
    //
    // A queue's backlog is set by what its CONSUMER can drain, not by the
    // queue's own throughput ceiling. SQS will happily accept 100k messages a
    // second; the backlog forms because the Lambda behind it can only take two
    // thousand. Measuring overflow against the queue's own capacity makes
    // backlog permanently zero — which is exactly the bug this modelled first.
    let shed = 0;
    let backlogTotal = 0;
    for (const n of nodes) {
      const m = r.nodeMetrics.get(n.id);
      if (!m) continue;
      const pending = (backlog.get(n.id) ?? 0) + m.incomingQPS;

      if (isQueue(n)) {
        const drain = Math.min(consumerCapacity.get(n.id) ?? 0, m.effectiveQPS);
        const overflow = Math.max(0, pending - drain);
        backlog.set(n.id, overflow);
        backlogTotal += overflow;
      } else {
        const served = Math.min(pending, m.effectiveQPS);
        backlog.set(n.id, 0);
        shed += Math.max(0, pending - served);
      }
    }

    // 4. Record.
    series.push({
      t,
      offeredQPS: offered,
      deliveredQPS: r.throughput,
      backlogTotal,
      nodeMetrics: r.nodeMetrics,
    });

    // 5. Autoscaling — applied to the NEXT tick, which is the lag that matters.
    if (autoscaling) {
      for (const n of nodes) {
        const m = r.nodeMetrics.get(n.id);
        if (!m || !n.data.scalable) continue;
        const ema = 0.7 * (utilEma.get(n.id) ?? 0) + 0.3 * m.utilization;
        utilEma.set(n.id, ema);
        const current = scale.get(n.id) ?? 1;
        if (ema > 0.7 && current < MAX_SCALE) scale.set(n.id, Math.min(MAX_SCALE, current * 1.25));
        else if (ema < 0.3 && current > 1) scale.set(n.id, Math.max(1, current * 0.9));
      }
    }

    // 6. Retries — also applied to the NEXT tick. Capped: an unbounded feedback
    //    loop is a hang, not a lesson, but the climb before the cap IS the lesson.
    if (retryRate > 0 && shed > 0) {
      const wanted = shed * retryRate;
      const ceiling = baselineQPS * RETRY_STORM_CAP;
      carriedRetries = Math.min(wanted, Math.max(0, ceiling - scenarioLoad));
      // Flagged well below the hard cap: retries converge to a fixed point that
      // can sit under the ceiling and still be a storm. Doubling your own
      // offered load by retrying into a saturated service is the failure mode,
      // whether or not it runs away entirely.
      if (scenarioLoad + carriedRetries > baselineQPS * RETRY_STORM_FLAG) {
        retryStorm = true;
      }
    } else {
      carriedRetries = 0;
    }
  }

  const final = last ?? runSimulation(nodes, edges, baselineQPS, readRatio);
  return { ...final, series, scenario: scenarioId, retryStorm };
}

/** Effective capacity of a node as configured: maxQPS x replicas. */
function deriveNodeCapacity(node: Node<ComponentNodeData>): number {
  const q = Number(node.data.maxQPS);
  const r = Math.max(1, Number(node.data.replicas) || 1);
  return Number.isFinite(q) && q > 0 ? q * r : 0;
}

/** Entry-ish nodes keep serving during an outage — the outage hits consumers. */
function isEntryish(node: Node<ComponentNodeData>): boolean {
  const id = resolveComponentId(String(node.data.componentId));
  return id === "route53" || id === "cloudfront" || id === "alb" || id === "nlb";
}
