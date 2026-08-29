import { describe, it, expect, beforeEach } from "vitest";
import { loadReferenceIntoTab, buildReferenceGraph } from "@/lib/loadReference";
import { useCanvasStore } from "@/store/canvasStore";
import { PROBLEMS } from "@/data/problems";

const problem = PROBLEMS.find((p) => p.id === "url-shortener")!;
const other = PROBLEMS.find((p) => p.id === "twitter-feed")!;
const s = () => useCanvasStore.getState();

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    tabs: [{ id: "my-design", label: "My Design", nodes: [], edges: [] }],
    activeTabId: "my-design",
    history: [],
    future: [],
  });
});

describe("opening a reference", () => {
  it("opens it in its own tab and switches to it", () => {
    loadReferenceIntoTab(problem);
    expect(s().activeTabId).toBe(`ref-${problem.id}`);
    expect(s().nodes.length).toBeGreaterThan(0);
  });

  it("leaves the user's own design untouched", () => {
    useCanvasStore.setState({ nodes: [{ id: "mine", position: { x: 0, y: 0 }, data: {} }] as never });
    loadReferenceIntoTab(problem);
    s().switchTab("my-design");
    expect(s().nodes).toHaveLength(1);
    expect(s().nodes[0].id).toBe("mine");
  });

  it("is an EDITABLE copy, not a read-only view", () => {
    loadReferenceIntoTab(problem);
    const tab = s().tabs.find((t) => t.id === `ref-${problem.id}`);
    expect(tab?.readOnly).toBeFalsy();
  });

  it("does not discard edits when the same reference is opened again", () => {
    // addTab replaces the contents of a tab with a matching id. Re-selecting a
    // problem must therefore switch to the existing tab, not rebuild it —
    // otherwise every revisit silently wipes the user's work.
    loadReferenceIntoTab(problem);
    const originalCount = s().nodes.length;
    s().deleteNode(s().nodes[0].id);
    expect(s().nodes).toHaveLength(originalCount - 1);

    loadReferenceIntoTab(problem);
    expect(s().nodes).toHaveLength(originalCount - 1);
  });

  it("keeps a separate tab per problem", () => {
    loadReferenceIntoTab(problem);
    loadReferenceIntoTab(other);
    const ids = s().tabs.map((t) => t.id);
    expect(ids).toContain(`ref-${problem.id}`);
    expect(ids).toContain(`ref-${other.id}`);
  });

  it("switches back to an already-open reference without rebuilding it", () => {
    loadReferenceIntoTab(problem);
    loadReferenceIntoTab(other);
    loadReferenceIntoTab(problem);
    expect(s().activeTabId).toBe(`ref-${problem.id}`);
    expect(s().tabs.filter((t) => t.id === `ref-${problem.id}`)).toHaveLength(1);
  });
});

describe("buildReferenceGraph", () => {
  it("resolves every node through the concept bridge", () => {
    const { nodes } = buildReferenceGraph(problem);
    expect(nodes.length).toBe(problem.referenceSolution.nodes.length);
    // Generic content ids become AWS services on the canvas.
    expect(nodes.map((n) => n.data.componentId)).toContain("elasticache");
  });

  it("wires every edge the solution declares", () => {
    const { edges } = buildReferenceGraph(problem);
    expect(edges.length).toBe(problem.referenceSolution.edges.length);
  });
});

describe("layout", () => {
  // Node footprint plus the gap we require around it.
  const W = 140, H = 100, GAP = 24;

  it("never overlaps two nodes, in any reference solution", () => {
    // 32 of 35 solutions used to have crowded nodes and two had nodes stacked
    // at the identical point. Positions are computed now, so this holds for
    // solutions edited later too.
    for (const p of PROBLEMS) {
      const { nodes } = buildReferenceGraph(p);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i].position;
          const b = nodes[j].position;
          const clash = Math.abs(a.x - b.x) < W + GAP && Math.abs(a.y - b.y) < H + GAP;
          expect(
            clash,
            `${p.id}: ${nodes[i].data.componentId} overlaps ${nodes[j].data.componentId}`,
          ).toBe(false);
        }
      }
    }
  });

  it("puts every node at a non-negative position", () => {
    for (const p of PROBLEMS) {
      for (const n of buildReferenceGraph(p).nodes) {
        expect(n.position.x, p.id).toBeGreaterThanOrEqual(0);
        expect(n.position.y, p.id).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("leaves no empty columns — a cycle must not stretch the canvas", () => {
    // web-crawler (EC2 -> SQS -> EC2) once reached depth 14 across two occupied
    // columns, producing a 3,500px canvas of mostly blank space.
    for (const p of PROBLEMS) {
      const xs = [...new Set(buildReferenceGraph(p).nodes.map((n) => n.position.x))].sort(
        (a, b) => a - b,
      );
      const widest = xs[xs.length - 1];
      expect(widest / 250, `${p.id} has gaps between columns`).toBe(xs.length - 1);
    }
  });

  it("flows left to right along the request path", () => {
    // An edge should point rightwards or stay in place; never backwards, except
    // where the solution genuinely loops.
    const { nodes, edges } = buildReferenceGraph(PROBLEMS.find((p) => p.id === "url-shortener")!);
    const at = new Map(nodes.map((n) => [n.id, n.position.x]));
    for (const e of edges) {
      expect(at.get(e.target)!).toBeGreaterThan(at.get(e.source)!);
    }
  });
});
