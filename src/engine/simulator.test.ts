import { describe, it, expect } from "vitest";
import { runSimulation } from "@/engine/simulator";
import { testNode, testEdge } from "@/engine/testFixtures";

/** app -> cache + db: the shape every reference solution uses. */
function cacheAndDb(hitRate: number, readRatio: number, qps = 10000) {
  const nodes = [
    // Sized so the app tier is not itself the bottleneck — otherwise it throttles
    // everything downstream and the cache split is impossible to observe.
    testNode("app", "ec2", { config: { size: "m5.4xlarge" } }),
    testNode("cache", "elasticache", { config: { cacheHitRate: hitRate } }),
    testNode("db", "dynamodb"),
  ];
  const r = runSimulation(nodes, [testEdge("app", "cache"), testEdge("app", "db")], qps, readRatio);
  return { cache: r.nodeMetrics.get("cache")!, db: r.nodeMetrics.get("db")! };
}

describe("cache routing", () => {
  it("sends the hit-rate share of reads to the cache", () => {
    expect(cacheAndDb(85, 1).cache.incomingReads).toBeCloseTo(8500, 0);
  });

  it("sends only the misses to the datastore", () => {
    expect(cacheAndDb(85, 1).db.incomingReads).toBeCloseTo(1500, 0);
  });

  it("passes ALL writes to the datastore, never the cache", () => {
    const { cache, db } = cacheAndDb(85, 0.8); // 8000 reads, 2000 writes
    expect(cache.incomingWrites).toBe(0);
    expect(db.incomingWrites).toBeCloseTo(2000, 0);
  });

  it("is a pass-through at a 0% hit rate", () => {
    expect(cacheAndDb(0, 1).db.incomingReads).toBeCloseTo(10000, 0);
  });
});

describe("read replicas", () => {
  const util = (readReplicas: number, readRatio: number) =>
    runSimulation([testNode("db", "rds", { config: { readReplicas } })], [], 10000, readRatio)
      .nodeMetrics.get("db")!.utilization;

  it("add read capacity", () => {
    expect(util(0, 1)).toBeCloseTo(1, 3);
    expect(util(4, 1)).toBeCloseTo(0.2, 3);
  });

  it("do NOT add write capacity — writes still hit the single primary", () => {
    expect(util(4, 0)).toBeCloseTo(1, 3);
  });
});

describe("latency", () => {
  const at = (qps: number) =>
    runSimulation([testNode("app", "ec2")], [], qps, 1).nodeMetrics.get("app")!;

  it("reports p99 at or above p50", () => {
    const m = at(100);
    expect(m.latencyP99).toBeGreaterThanOrEqual(m.latencyMs);
  });

  it("widens the tail as utilization rises", () => {
    const light = at(100);
    const heavy = at(5000);
    expect(heavy.latencyP99 / heavy.latencyMs).toBeGreaterThan(light.latencyP99 / light.latencyMs);
  });
});

describe("engine invariants", () => {
  it("never reports throughput above offered load", () => {
    const r = runSimulation([testNode("app", "ec2")], [], 500000, 1);
    expect(r.throughput).toBeLessThanOrEqual(500000);
  });

  it("gives a disconnected node no traffic", () => {
    const nodes = [testNode("a", "ec2"), testNode("b", "alb"), testNode("lonely", "dynamodb")];
    const r = runSimulation(nodes, [testEdge("a", "b")], 10000, 1);
    expect(r.nodeMetrics.get("lonely")!.incomingQPS).toBe(0);
  });

  it("splits load balancer traffic across its targets", () => {
    const nodes = [testNode("lb", "alb"), testNode("x", "ec2"), testNode("y", "ec2")];
    const r = runSimulation(nodes, [testEdge("lb", "x"), testEdge("lb", "y")], 10000, 1);
    // Regression guard: LOAD_BALANCING_COMPONENTS once listed the pre-AWS id
    // "load-balancer", so ALBs silently stopped splitting and every multi-target
    // ALB double-counted its load.
    expect(r.nodeMetrics.get("x")!.incomingQPS).toBeCloseTo(5000, 0);
    expect(r.nodeMetrics.get("y")!.incomingQPS).toBeCloseTo(5000, 0);
  });

  it("terminates on a cycle", () => {
    const nodes = [testNode("a", "ec2"), testNode("b", "ec2")];
    const r = runSimulation(nodes, [testEdge("a", "b"), testEdge("b", "a")], 1000, 1);
    expect(r.nodeMetrics.size).toBe(2);
  });

  it("returns zero throughput for an empty canvas", () => {
    expect(runSimulation([], [], 1000, 1).throughput).toBe(0);
  });
});
