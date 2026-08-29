import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import type { ComponentNodeData } from "@/store/canvasStore";
import { scoreScalability } from "@/scoring/rules/scalability";
import { scoreAvailability } from "@/scoring/rules/availability";
import { scoreLatency } from "@/scoring/rules/latency";
import { scoreCost } from "@/scoring/rules/cost";
import { scoreTradeoffs } from "@/scoring/rules/tradeoffs";
import type { ScoringGraph } from "@/types/scoring";
import { testNode, testEdge } from "@/engine/testFixtures";

const RULES = [
  ["scalability", scoreScalability],
  ["availability", scoreAvailability],
  ["latency", scoreLatency],
  ["cost", scoreCost],
  ["tradeoffs", scoreTradeoffs],
] as const;

/** Build the connectivity context the way scorer.ts does. */
function graphOf(nodes: Node<ComponentNodeData>[], edges: Edge[]): ScoringGraph {
  const ids = new Set(nodes.map((n) => n.id));
  const adjacency = new Map<string, string[]>();
  for (const n of nodes) adjacency.set(n.id, []);
  const inDeg = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) continue;
    adjacency.get(e.source)!.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  }
  const reachable = new Set<string>();
  const queue = nodes.filter((n) => inDeg.get(n.id) === 0 && (adjacency.get(n.id)?.length ?? 0) > 0).map((n) => n.id);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const c of adjacency.get(id) ?? []) queue.push(c);
  }
  return { adjacency, reachable };
}

/**
 * Every rule must stay inside 0..20 for ANY input. The aggregate scorer test
 * only exercises the 35 reference solutions; these are the adversarial shapes
 * that reference solutions never produce.
 */
describe.each(RULES)("%s stays within budget", (name, rule) => {
  const cases: [string, Node<ComponentNodeData>[], Edge[]][] = [
    ["empty canvas", [], []],
    ["one unwired node", [testNode("a", "ec2")], []],
    ["self-loop", [testNode("a", "ec2")], [testEdge("a", "a")]],
    ["cycle", [testNode("a", "ec2"), testNode("b", "alb")], [testEdge("a", "b"), testEdge("b", "a")]],
    ["edge to a node that does not exist", [testNode("a", "ec2")], [testEdge("a", "ghost")]],
    ["only pattern nodes", [testNode("a", "circuit-breaker"), testNode("b", "id-generator")], []],
    [
      "duplicate parallel edges",
      [testNode("a", "alb"), testNode("b", "ec2")],
      [testEdge("a", "b"), { id: "dup", source: "a", target: "b" }],
    ],
    [
      "very large design",
      Array.from({ length: 40 }, (_, i) => testNode(`n${i}`, "ec2")),
      Array.from({ length: 39 }, (_, i) => testEdge(`n${i}`, `n${i + 1}`)),
    ],
  ];

  it.each(cases)("%s", (_label, nodes, edges) => {
    const result = rule(nodes, edges, graphOf(nodes, edges));
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(20);
    expect(result.maxScore).toBe(20);
    expect(Number.isFinite(result.score)).toBe(true);
  });
});

describe("rules credit roles, not service names", () => {
  // The regression that dropped reference solutions to 27/100 was a presence
  // check on a raw id. These assert the role layer is actually being used.
  const wired = (dbId: string) => {
    const nodes = [testNode("lb", "alb"), testNode("app", "ec2"), testNode("db", dbId)];
    const edges = [testEdge("lb", "app"), testEdge("app", "db")];
    return scoreCost(nodes, edges, graphOf(nodes, edges)).score;
  };

  it("scores Aurora as a relational database, like RDS", () => {
    expect(wired("aurora")).toBe(wired("rds"));
  });

  it("scores DocumentDB as a document store, like DynamoDB", () => {
    expect(wired("documentdb")).toBe(wired("dynamodb"));
  });
});

describe("unwired components earn nothing", () => {
  it("gives no caching credit for a cache that is not connected", () => {
    const connected = [testNode("app", "ec2"), testNode("c", "elasticache"), testNode("db", "dynamodb")];
    const wiredEdges = [testEdge("app", "c"), testEdge("app", "db")];
    const withWiring = scoreCost(connected, wiredEdges, graphOf(connected, wiredEdges)).score;
    const withoutWiring = scoreCost(connected, [], graphOf(connected, [])).score;
    expect(withoutWiring).toBeLessThan(withWiring);
  });
});
