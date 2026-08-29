import { describe, it, expect } from "vitest";
import { runTickedSimulation } from "@/engine/ticks";
import { runSimulation } from "@/engine/simulator";
import { testNode, testEdge } from "@/engine/testFixtures";
import { PROBLEMS } from "@/data/problems";
import { buildReferenceGraph } from "@/lib/loadReference";

describe("steady-state convergence (the oracle)", () => {
  // The snapshot engine is the tick engine's correctness oracle: under constant
  // load a ticked run must settle into exactly what runSimulation computes.
  // A mismatch means the tick model corrupts propagation — not that the
  // tolerance is too tight.
  it("reproduces the snapshot engine for every reference solution", () => {
    for (const p of PROBLEMS) {
      const { nodes, edges } = buildReferenceGraph(p);
      const snapshot = runSimulation(nodes, edges, 100000, 0.9);
      const ticked = runTickedSimulation(nodes, edges, 100000, {
        scenario: "steady",
        ticks: 20,
        readRatio: 0.9,
      });
      for (const n of nodes) {
        const a = snapshot.nodeMetrics.get(n.id);
        const b = ticked.nodeMetrics.get(n.id);
        if (!a || !b) continue;
        const drift = Math.abs(b.incomingQPS - a.incomingQPS) / Math.max(1, a.incomingQPS);
        expect(drift, `${p.id} / ${String(n.data.componentId)}`).toBeLessThan(0.01);
      }
    }
  });
});

describe("queue backlog", () => {
  // Sizing is the whole trick: the consumer must handle the baseline (3,000 QPS
  // vs 2,000) but not the 4x spike (8,000). Undersize it for the baseline too
  // and backlog grows forever without ever draining.
  const design = () => [
    testNode("app", "ec2", { replicas: 20 }),
    testNode("q", "sqs"),
    testNode("worker", "lambda", { config: { concurrency: 150 } }),
  ];
  const wiring = [testEdge("app", "q"), testEdge("q", "worker")];

  it("builds during a spike and drains afterwards", () => {
    const r = runTickedSimulation(design(), wiring, 2000, { scenario: "spike", ticks: 80 });
    const peak = Math.max(...r.series.map((s) => s.backlogTotal));
    const final = r.series[r.series.length - 1].backlogTotal;
    expect(peak).toBeGreaterThan(0);
    expect(final).toBeLessThan(peak * 0.6);
  });

  it("drains at the CONSUMER's rate, not the queue's own ceiling", () => {
    // SQS accepts 100k/s; the Lambda behind it takes 3k/s. Measuring overflow
    // against SQS's own capacity made backlog permanently zero — the first real
    // bug in this model.
    const r = runTickedSimulation(design(), wiring, 2000, { scenario: "spike", ticks: 80 });
    expect(Math.max(...r.series.map((s) => s.backlogTotal))).toBeGreaterThan(10000);
  });

  it("stays flat under steady load the consumer can handle", () => {
    const r = runTickedSimulation(design(), wiring, 2000, { scenario: "steady", ticks: 40 });
    expect(Math.max(...r.series.map((s) => s.backlogTotal))).toBe(0);
  });
});

describe("autoscaling", () => {
  const nodes = () => [testNode("app", "ec2", { replicas: 4 })];
  const peakUtil = (r: ReturnType<typeof runTickedSimulation>) =>
    Math.max(...r.series.map((s) => Math.max(...[...s.nodeMetrics.values()].map((m) => m.utilization))));
  const endUtil = (r: ReturnType<typeof runTickedSimulation>) =>
    [...r.series[r.series.length - 1].nodeMetrics.values()][0].utilization;

  it("does NOT rescue a sudden spike — the one-tick lag is the point", () => {
    const without = runTickedSimulation(nodes(), [], 10000, { scenario: "spike", ticks: 80 });
    const with_ = runTickedSimulation(nodes(), [], 10000, { scenario: "spike", ticks: 80, autoscaling: true });
    expect(Math.abs(peakUtil(with_) - peakUtil(without))).toBeLessThan(0.05);
  });

  it("absorbs a gradual ramp", () => {
    const without = runTickedSimulation(nodes(), [], 10000, { scenario: "ramp", ticks: 80 });
    const with_ = runTickedSimulation(nodes(), [], 10000, { scenario: "ramp", ticks: 80, autoscaling: true });
    expect(endUtil(with_)).toBeLessThan(endUtil(without) - 0.05);
  });
});

describe("retry amplification", () => {
  const saturated = () => [testNode("app", "ec2")]; // 5k capacity against 50k offered
  const offeredAtEnd = (r: ReturnType<typeof runTickedSimulation>) =>
    r.series[r.series.length - 1].offeredQPS;

  it("leaves offered load flat when retries are off", () => {
    const r = runTickedSimulation(saturated(), [], 50000, { scenario: "steady", ticks: 40 });
    expect(offeredAtEnd(r)).toBeCloseTo(50000, 0);
    expect(r.retryStorm).toBe(false);
  });

  it("amplifies offered load when retrying into a saturated service", () => {
    const r = runTickedSimulation(saturated(), [], 50000, { scenario: "steady", ticks: 40, retryRate: 0.8 });
    expect(offeredAtEnd(r)).toBeGreaterThan(50000 * 1.5);
  });

  it("flags a storm below the hard cap", () => {
    // Retries converge to a fixed point (~4.6x here) that can sit under the
    // ceiling and still be a storm. Flagging only at the cap missed this.
    const r = runTickedSimulation(saturated(), [], 50000, { scenario: "steady", ticks: 40, retryRate: 0.8 });
    expect(r.retryStorm).toBe(true);
    expect(offeredAtEnd(r)).toBeLessThanOrEqual(50000 * 5 + 1);
  });
});

describe("per-tick invariants", () => {
  it("never delivers more than was offered, and never goes negative", () => {
    for (const scenario of ["steady", "spike", "ramp", "outage"] as const) {
      const r = runTickedSimulation(
        [testNode("app", "ec2", { replicas: 3 }), testNode("q", "sqs"), testNode("w", "lambda")],
        [testEdge("app", "q"), testEdge("q", "w")],
        20000,
        { scenario, ticks: 40, retryRate: 0.3, autoscaling: true },
      );
      for (const s of r.series) {
        expect(s.deliveredQPS, `${scenario} t=${s.t}`).toBeLessThanOrEqual(s.offeredQPS + 1e-6);
        expect(s.backlogTotal, `${scenario} t=${s.t}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("produces one snapshot per tick", () => {
    const r = runTickedSimulation([testNode("app", "ec2")], [], 1000, { ticks: 37 });
    expect(r.series).toHaveLength(37);
  });
});
