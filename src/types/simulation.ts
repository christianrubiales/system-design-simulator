export type NodeStatus = "healthy" | "warning" | "critical" | "idle";

/** Traffic flows as two channels: a cache can serve reads but never writes. */
export interface Traffic {
  reads: number;
  writes: number;
}

export interface NodeMetrics {
  nodeId: string;
  /** reads + writes. Kept so existing consumers need no change. */
  incomingQPS: number;
  incomingReads: number;
  incomingWrites: number;
  /** Reads a cache served itself, so downstream never saw them. */
  absorbedReads: number;
  effectiveQPS: number;
  utilization: number;
  /** Median latency. Same field the scorer and metrics panel already read. */
  latencyMs: number;
  /** Tail latency — queueing delay under load is where p99 comes from. */
  latencyP99: number;
  status: NodeStatus;
  isBottleneck: boolean;
}

export interface SimulationResult {
  nodeMetrics: Map<string, NodeMetrics>;
  totalLatencyMs: number;
  bottleneckNodes: string[];
  throughput: number;
  timestamp: number;
  warnings: string[];
}

export interface SimulationConfig {
  requestsPerSec: number;
  durationSec: number;
  rampUp: boolean;
  /** Fraction of offered load that is reads, 0..1. Seeded from the problem. */
  readRatio: number;
  /** Which load profile to run. Scoring always uses "steady". */
  scenario: "steady" | "spike" | "ramp" | "outage";
  /** Grow capacity under sustained load, with a one-tick lag. */
  autoscaling: boolean;
  /** Fraction of shed requests retried on the next tick. 0 disables. */
  retryRate: number;
}
