import type { Node, Edge } from "@xyflow/react";
import type { Problem } from "@/types/problem";
import { getComponentById } from "@/data/componentLookup";
import { useCanvasStore, type ComponentNodeData } from "@/store/canvasStore";
import { useAppStore } from "@/store/appStore";

/**
 * Build canvas nodes + edges for a problem's reference solution.
 *
 * Instance matching is EXACT on componentId (never prefix-based):
 * - Each reference node becomes a unique instance, tracked per componentId in order.
 * - Edge endpoints referencing a componentId with N instances are connected
 *   round-robin by occurrence order (independent counters for source/target
 *   roles so chains like A -> B -> C stay connected through the same instance).
 */
export function buildReferenceGraph(problem: Problem): {
  nodes: Node<ComponentNodeData>[];
  edges: Edge[];
} {
  // componentId -> node ids, in declaration order
  const instancesByComponent = new Map<string, string[]>();
  const refNodes: Node<ComponentNodeData>[] = [];

  problem.referenceSolution.nodes.forEach((ref, index) => {
    const comp = getComponentById(ref.componentId);
    if (!comp) return;

    const nodeId = `${comp.id}-ref-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const list = instancesByComponent.get(ref.componentId) ?? [];
    list.push(nodeId);
    instancesByComponent.set(ref.componentId, list);

    refNodes.push({
      id: nodeId,
      type: "component",
      position: { x: ref.x, y: ref.y },
      data: {
        componentId: comp.id,
        label: comp.label,
        icon: comp.icon,
        category: comp.category,
        replicas: 1,
        maxQPS: comp.maxQPS,
        latencyMs: comp.latencyMs,
        scalable: comp.scalable,
      },
    });
  });

  // Round-robin counters, keyed by `${componentId}#${role}`
  const rrCounters = new Map<string, number>();
  const nextInstance = (componentId: string, role: "source" | "target"): string | undefined => {
    const instances = instancesByComponent.get(componentId);
    if (!instances || instances.length === 0) return undefined;
    const key = `${componentId}#${role}`;
    const count = rrCounters.get(key) ?? 0;
    rrCounters.set(key, count + 1);
    return instances[count % instances.length];
  };

  const refEdges: Edge[] = [];
  for (const ref of problem.referenceSolution.edges) {
    const sourceId = nextInstance(ref.source, "source");
    const targetId = nextInstance(ref.target, "target");
    if (sourceId && targetId) {
      refEdges.push({
        id: `e-${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        type: "animated",
      });
    }
  }

  return { nodes: layoutGraph(refNodes, refEdges), edges: refEdges };
}

/**
 * Open a problem's reference solution as an EDITABLE copy in its own tab.
 *
 * Not read-only: the reference is a starting point you can pull apart, not a
 * museum piece. Your own design lives in its own tab and is untouched.
 *
 * If the tab already exists we switch to it rather than rebuilding it —
 * `addTab` replaces the contents of a tab with a matching id, which would
 * silently discard whatever you had changed since you last opened it.
 */
export function loadReferenceIntoTab(problem: Problem): void {
  const tabId = `ref-${problem.id}`;
  const store = useCanvasStore.getState();
  const existing = store.tabs.find((t) => t.id === tabId);

  if (existing) {
    if (store.activeTabId !== tabId) store.switchTab(tabId);
    return;
  }

  const { nodes, edges } = buildReferenceGraph(problem);
  store.addTab({ id: tabId, label: `${problem.title} (Reference)`, nodes, edges });

  useAppStore
    .getState()
    .showToast("Reference opened in a new tab — edit it freely, your design is safe", "success");
}

/**
 * Rendered node footprint, and the room we want around it.
 *
 * A component node is `px-4 py-3` around a label capped at 96px, so it renders
 * roughly 140x100. The spacings below are that footprint plus a comfortable
 * gap, which is what guarantees nodes never touch.
 */
const NODE_W = 140;
const NODE_H = 100;
const COL_GAP = 110;
const ROW_GAP = 44;
const COL_SPACING = NODE_W + COL_GAP; // 250
const ROW_SPACING = NODE_H + ROW_GAP; // 144

/**
 * Lay a reference solution out left-to-right by dependency depth.
 *
 * The hand-authored x/y in `problems.ts` were written for the pre-AWS catalog
 * and never revisited: 32 of 35 solutions had overlapping or touching nodes,
 * two of them stacked at the identical point. Consumer nodes inserted
 * programmatically (Lambda, ECS) made it worse, since their positions were
 * interpolated between two nodes that were already too close.
 *
 * Computing the layout from the graph fixes all of them at once and keeps
 * working for any solution edited later — nobody has to hand-tune coordinates
 * again. Depth is the LONGEST path from an entry node, so an edge always points
 * rightwards and the request path reads in reading order.
 */
export function layoutGraph(
  nodes: Node<ComponentNodeData>[],
  edges: Edge[],
): Node<ComponentNodeData>[] {
  if (nodes.length === 0) return nodes;

  const ids = new Set(nodes.map((n) => n.id));
  const children = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const n of nodes) {
    children.set(n.id, []);
    inDegree.set(n.id, 0);
  }
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) continue;
    children.get(e.source)!.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  // Longest-path depth. The visit cap makes cycles terminate: a node can only
  // be pushed deeper a bounded number of times, so a cycle settles instead of
  // looping forever.
  const depth = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const visits = new Map<string, number>();
  const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  // A graph that is entirely a cycle has no in-degree-0 node; start somewhere.
  if (queue.length === 0) queue.push(nodes[0].id);

  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    const seen = (visits.get(id) ?? 0) + 1;
    visits.set(id, seen);
    if (seen > nodes.length) continue;
    for (const child of children.get(id) ?? []) {
      const candidate = (depth.get(id) ?? 0) + 1;
      if (candidate > (depth.get(child) ?? 0)) {
        depth.set(child, candidate);
        queue.push(child);
      }
    }
  }

  // Compact the depths to consecutive columns before positioning.
  //
  // A cycle inflates depth: web-crawler (EC2 -> SQS -> EC2) relaxed around its
  // loop until the visit cap and reached depth 14 while occupying only two
  // columns — a 3,500px canvas that was almost entirely empty. Ranking the
  // distinct depths collapses that back to a compact diagram and leaves acyclic
  // graphs untouched.
  const usedDepths = [...new Set(nodes.map((n) => depth.get(n.id) ?? 0))].sort((a, b) => a - b);
  const columnOf = new Map(usedDepths.map((d, i) => [d, i]));

  // Group by column, preserving the author's vertical ordering within each.
  const columns = new Map<number, Node<ComponentNodeData>[]>();
  for (const n of nodes) {
    const d = columnOf.get(depth.get(n.id) ?? 0) ?? 0;
    (columns.get(d) ?? columns.set(d, []).get(d)!).push(n);
  }
  for (const column of columns.values()) {
    column.sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  }

  // Centre each column vertically so the diagram reads as a balanced flow.
  const tallest = Math.max(...[...columns.values()].map((c) => c.length));
  const positioned = new Map<string, { x: number; y: number }>();
  for (const [d, column] of columns) {
    const offset = ((tallest - column.length) * ROW_SPACING) / 2;
    column.forEach((n, i) => {
      positioned.set(n.id, { x: d * COL_SPACING, y: offset + i * ROW_SPACING });
    });
  }

  return nodes.map((n) => ({ ...n, position: positioned.get(n.id) ?? n.position }));
}
