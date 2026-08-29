import { describe, it, expect } from "vitest";
import { scoreDesign } from "@/scoring/scorer";
import { PROBLEMS } from "@/data/problems";
import { buildReferenceGraph } from "@/lib/loadReference";
import { testNode, testEdge } from "@/engine/testFixtures";

function scoreAll() {
  return PROBLEMS.map((p) => {
    const { nodes, edges } = buildReferenceGraph(p);
    return { id: p.id, result: scoreDesign(nodes, edges) };
  });
}

describe("reference solutions", () => {
  // These are the app's own model answers. When the catalog moved to AWS ids,
  // 86 hardcoded presence checks silently returned false and these averaged
  // 27/100 with nothing reporting it. This is the guard against that recurring.
  const scored = scoreAll();

  it("average above 70", () => {
    const avg = scored.reduce((s, x) => s + x.result.total, 0) / scored.length;
    expect(avg).toBeGreaterThanOrEqual(70);
  });

  it("at least 30 of 35 score 60 or better", () => {
    expect(scored.filter((x) => x.result.total >= 60).length).toBeGreaterThanOrEqual(30);
  });

  it("none collapses below the floor", () => {
    // web-crawler, message-queue-design, and distributed-cache legitimately
    // score lower: the rubric judges user-facing web architectures and those
    // are "design the primitive" problems.
    for (const { id, result } of scored) {
      expect(result.total, id).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("category budgets", () => {
  it("keeps every category within 0..20", () => {
    for (const { id, result } of scoreAll()) {
      for (const c of result.categories) {
        expect(c.score, `${id}/${c.category}`).toBeGreaterThanOrEqual(0);
        expect(c.score, `${id}/${c.category}`).toBeLessThanOrEqual(20);
        expect(c.maxScore).toBe(20);
      }
    }
  });

  it("totals at most 100", () => {
    for (const { id, result } of scoreAll()) {
      expect(result.total, id).toBeLessThanOrEqual(100);
    }
  });
});

describe("role matching", () => {
  it("credits an AWS-only service that fills a generic role", () => {
    // Aurora is not `concept: sql-db`; it satisfies it. Without `satisfies`,
    // choosing a better database than the default would score zero.
    const withRds = scoreDesign(
      [testNode("lb", "alb"), testNode("app", "ec2"), testNode("db", "rds")],
      [testEdge("lb", "app"), testEdge("app", "db")],
    );
    const withAurora = scoreDesign(
      [testNode("lb", "alb"), testNode("app", "ec2"), testNode("db", "aurora")],
      [testEdge("lb", "app"), testEdge("app", "db")],
    );
    expect(withAurora.total).toBeGreaterThanOrEqual(withRds.total - 2);
  });
});

describe("connectivity", () => {
  it("gives no credit for unwired components", () => {
    const wired = scoreDesign(
      [testNode("app", "ec2"), testNode("cache", "elasticache"), testNode("db", "dynamodb")],
      [testEdge("app", "cache"), testEdge("app", "db")],
    );
    const scattered = scoreDesign(
      [testNode("app", "ec2"), testNode("cache", "elasticache"), testNode("db", "dynamodb")],
      [],
    );
    expect(scattered.total).toBeLessThan(wired.total);
  });

  it("handles an empty canvas without throwing", () => {
    expect(scoreDesign([], []).total).toBeGreaterThanOrEqual(0);
  });
});
