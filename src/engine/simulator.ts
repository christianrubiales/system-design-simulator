import type { Node, Edge } from "@xyflow/react";
import type { ComponentNodeData } from "@/store/canvasStore";
import type { NodeMetrics, NodeStatus, SimulationResult, Traffic } from "@/types/simulation";
import { SERVICE_CONFIG, defaultConfig } from "@/data/serviceConfig";
import { resolveComponentId } from "@/data/conceptMap";
import {
  UTILIZATION_WARNING,
  UTILIZATION_CRITICAL,
  LATENCY_SPIKE_THRESHOLD,
  LATENCY_SPIKE_MULTIPLIER,
} from "./constants";

/** Component IDs that split (load-balance) traffic across children. */
const LOAD_BALANCING_COMPONENTS = new Set([
  "load-balancer",
  "api-gateway",
  "alb",
  "nlb",
]);

/** Categories a cache can plausibly sit in front of. */
const DATASTORE_CATEGORIES = new Set(["database", "storage", "analytics"]);

const ZERO: Traffic = { reads: 0, writes: 0 };
const total = (t: Traffic): number => t.reads + t.writes;
const scale = (t: Traffic, f: number): Traffic => ({ reads: t.reads * f, writes: t.writes * f });
const add = (a: Traffic, b: Traffic): Traffic => ({
  reads: a.reads + b.reads,
  writes: a.writes + b.writes,
});

/**
 * Fraction of reads a caching node serves itself, 0 when it is not a cache.
 *
 * Read from the node's config so the panel's hit-rate slider drives the
 * simulation directly. This is the single most important capacity lever in a
 * read-heavy design, and the one candidates most often hand-wave.
 */
function cacheHitRate(node: Node<ComponentNodeData>): number {
  const id = resolveComponentId(node.data.componentId);
  const spec = SERVICE_CONFIG[id];
  if (!spec?.params.some((p) => p.id === "cacheHitRate")) return 0;
  const configured = node.data.config?.cacheHitRate;
  const pct = typeof configured === "number" ? configured : Number(defaultConfig(id).cacheHitRate ?? 0);
  return Math.min(1, Math.max(0, pct / 100));
}

/**
 * Extra read capacity from read replicas. Replicas serve reads only — writes
 * still go to the single primary, which is the point interviewers probe.
 * Returns 1 when the service has no replica parameter, so nothing changes.
 */
function readCapacityMultiplier(node: Node<ComponentNodeData>): number {
  const id = resolveComponentId(node.data.componentId);
  const spec = SERVICE_CONFIG[id];
  if (!spec?.params.some((p) => p.id === "readReplicas")) return 1;
  const configured = node.data.config?.readReplicas;
  const replicas =
    typeof configured === "number" ? configured : Number(defaultConfig(id).readReplicas ?? 0);
  return 1 + Math.max(0, replicas);
}

function getStatus(utilization: number): NodeStatus {
  if (utilization > UTILIZATION_CRITICAL) return "critical";
  if (utilization > UTILIZATION_WARNING) return "warning";
  return "healthy";
}

/**
 * Tail latency. Queueing delay is what separates p99 from p50, so the gap
 * widens with utilization rather than being a fixed multiple — a node at 20%
 * has a tight distribution, one at 95% has a long tail.
 */
function computeP99(p50: number, utilization: number): number {
  const u = Math.min(Math.max(utilization, 0), 1);
  return p50 * (2 + 8 * u * u);
}

function computeLatency(baseLatency: number, utilization: number): number {
  if (utilization > LATENCY_SPIKE_THRESHOLD) {
    return baseLatency * (1 + Math.max(0, utilization - LATENCY_SPIKE_THRESHOLD) * LATENCY_SPIKE_MULTIPLIER);
  }
  return baseLatency;
}

/** Sanitize a raw maxQPS spec: finite positive number, otherwise 0. */
function sanitizeMaxQPS(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Sanitize a raw replicas spec: integer >= 1 (NaN/negative/fractional inputs clamp to 1). */
function sanitizeReplicas(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 1;
  return Math.max(1, n);
}

export function runSimulation(
  nodes: Node<ComponentNodeData>[],
  edges: Edge[],
  requestsPerSec: number,
  /** Fraction of offered load that is reads, 0..1. Seeded from the problem. */
  readRatio = 0.9
): SimulationResult {
  const warnings: string[] = [];
  const nodeMetrics = new Map<string, NodeMetrics>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Sanitized effective capacity per node (maxQPS * replicas)
  const capacity = new Map<string, number>();
  for (const node of nodes) {
    capacity.set(
      node.id,
      sanitizeMaxQPS(node.data.maxQPS) * sanitizeReplicas(node.data.replicas)
    );
  }

  // Build adjacency list and in-degree map.
  // - Edges whose endpoints aren't known component nodes (e.g. text nodes) are skipped,
  //   otherwise they'd inflate in-degree and falsely flag cycles.
  // - Duplicate parallel edges A->B are deduped so traffic isn't double-counted.
  // - Async edges still carry QPS, but are excluded from the latency graph:
  //   queue/notification/monitoring hops aren't user-facing latency.
  const adjacency = new Map<string, string[]>();
  const syncAdjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
    syncAdjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }
  const seenPairs = new Set<string>();
  const seenSyncPairs = new Set<string>();
  let validEdgeCount = 0;
  for (const edge of edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) continue;
    const key = `${edge.source}->${edge.target}`;
    if (!seenPairs.has(key)) {
      seenPairs.add(key);
      validEdgeCount++;
      adjacency.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
    if (edge.data?.async !== true && !seenSyncPairs.has(key)) {
      seenSyncPairs.add(key);
      syncAdjacency.get(edge.source)!.push(edge.target);
    }
  }

  // Entry nodes: in-degree 0 AND at least one outgoing edge, so disconnected
  // nodes don't steal traffic from the real request path. When the canvas has
  // no (valid) edges at all, fall back to treating every root as an entry.
  const hasEdges = validEdgeCount > 0;
  const entryNodes = nodes.filter(
    (n) =>
      (inDegree.get(n.id) ?? 0) === 0 &&
      (!hasEdges || (adjacency.get(n.id)?.length ?? 0) > 0)
  );

  // Initialize incoming traffic for entry nodes, split by the read ratio.
  const incomingQPS = new Map<string, Traffic>();
  const qpsPerEntry = entryNodes.length > 0 ? requestsPerSec / entryNodes.length : 0;
  const ratio = Math.min(1, Math.max(0, readRatio));
  for (const entry of entryNodes) {
    incomingQPS.set(entry.id, {
      reads: qpsPerEntry * ratio,
      writes: qpsPerEntry * (1 - ratio),
    });
  }

  const bottleneckNodes: string[] = [];
  const deliveredQPS = new Map<string, number>();
  const absorbed = new Map<string, number>();
  const processed = new Set<string>();

  /**
   * How a node's output is shared among its children.
   *
   * Load balancers divide traffic. Otherwise every child receives the full
   * flow (a request typically touches the cache AND the database), with one
   * exception: when a node fans out to BOTH a cache and a datastore, reads are
   * split by the cache's hit rate — the cache serves its share and only the
   * misses reach the store. Writes never go to a cache.
   *
   * That fan-out case is the important one: in practice a cache is drawn as a
   * sibling of the database under the app tier, not in front of it, so
   * absorbing at the cache node alone would have no downstream effect at all.
   */
  const distribute = (nodeId: string, output: Traffic): Map<string, Traffic> => {
    const result = new Map<string, Traffic>();
    const children = adjacency.get(nodeId) ?? [];
    if (children.length === 0) return result;

    if (LOAD_BALANCING_COMPONENTS.has(nodeMap.get(nodeId)!.data.componentId)) {
      const share = scale(output, 1 / children.length);
      for (const childId of children) result.set(childId, share);
      return result;
    }

    const caches = children.filter((id) => {
      const child = nodeMap.get(id);
      return child ? cacheHitRate(child) > 0 : false;
    });
    const stores = children.filter((id) => {
      const child = nodeMap.get(id);
      return child ? DATASTORE_CATEGORIES.has(String(child.data.category)) : false;
    });
    const cacheSet = new Set(caches);
    const storeSet = new Set(stores.filter((id) => !cacheSet.has(id)));

    // Only meaningful when the cache and its backing store are siblings.
    const hit =
      caches.length > 0 && storeSet.size > 0
        ? cacheHitRate(nodeMap.get(caches[0])!)
        : 0;

    for (const childId of children) {
      if (hit > 0 && cacheSet.has(childId)) {
        result.set(childId, { reads: output.reads * hit, writes: 0 });
      } else if (hit > 0 && storeSet.has(childId)) {
        result.set(childId, { reads: output.reads * (1 - hit), writes: output.writes });
      } else {
        result.set(childId, output);
      }
    }
    return result;
  };

  // Compute metrics for a node from its accumulated incoming QPS; returns delivered QPS.
  const processNode = (nodeId: string): Traffic => {
    const node = nodeMap.get(nodeId)!;
    const data = node.data;
    const incoming = incomingQPS.get(nodeId) ?? ZERO;
    const incomingTotal = total(incoming);
    const effectiveQPS = capacity.get(nodeId) ?? 0;

    // Read replicas add read capacity only — writes still go to the single
    // primary. With no replica parameter this multiplier is 1, so utilization
    // reduces exactly to (reads + writes) / capacity as before.
    const readCap = effectiveQPS * readCapacityMultiplier(node);
    const utilization =
      effectiveQPS <= 0
        ? incomingTotal > 0
          ? 2
          : 0
        : (readCap > 0 ? incoming.reads / readCap : 0) + incoming.writes / effectiveQPS;

    const latency = computeLatency(data.latencyMs, utilization);
    const status = getStatus(utilization);
    const isBottleneck = utilization > UTILIZATION_CRITICAL;

    if (isBottleneck) bottleneckNodes.push(nodeId);

    // Over capacity, both channels are shed proportionally.
    const throttle = utilization > 1 ? 1 / utilization : 1;
    const served = scale(incoming, throttle);

    // A cache with downstream children serves its share and passes the misses
    // on (CloudFront in front of S3). For a leaf cache this is bookkeeping only.
    const hit = cacheHitRate(node);
    const absorbedReads = served.reads * hit;
    const output: Traffic = { reads: served.reads - absorbedReads, writes: served.writes };

    deliveredQPS.set(nodeId, total(served));
    absorbed.set(nodeId, absorbedReads);

    nodeMetrics.set(nodeId, {
      nodeId,
      incomingQPS: incomingTotal,
      incomingReads: incoming.reads,
      incomingWrites: incoming.writes,
      absorbedReads,
      effectiveQPS,
      utilization: Math.min(utilization, 2), // cap at 200% for display
      latencyMs: latency,
      latencyP99: computeP99(latency, utilization),
      status,
      isBottleneck,
    });
    return output;
  };

  // Push a node's output traffic to its (not yet processed) children.
  const propagateToUnprocessedChildren = (nodeId: string, output: Traffic) => {
    for (const [childId, share] of distribute(nodeId, output)) {
      if (processed.has(childId)) continue;
      incomingQPS.set(childId, add(incomingQPS.get(childId) ?? ZERO, share));
    }
  };

  // --- Kahn's algorithm for topological-order QPS propagation ---
  // Clone inDegree so we can decrement without corrupting the original
  const remaining = new Map(inDegree);
  const queue: string[] = entryNodes.map((n) => n.id);
  let head = 0;

  while (head < queue.length) {
    const nodeId = queue[head++];
    if (processed.has(nodeId)) continue;
    processed.add(nodeId);

    const output = processNode(nodeId);

    // Propagate to children per the distribution policy (splitting, cache
    // routing, or plain fan-out).
    const shares = distribute(nodeId, output);
    for (const childId of adjacency.get(nodeId) ?? []) {
      incomingQPS.set(
        childId,
        add(incomingQPS.get(childId) ?? ZERO, shares.get(childId) ?? ZERO),
      );

      // Decrement in-degree; enqueue when all predecessors processed
      const newDeg = (remaining.get(childId) ?? 1) - 1;
      remaining.set(childId, newDeg);
      if (newDeg === 0) {
        queue.push(childId);
      }
    }
  }

  // --- Cycle handling ---
  // Unprocessed nodes with inbound edges are either ON a cycle or strictly
  // DOWNSTREAM of one. Distinguish them by repeatedly peeling zero-out-degree
  // nodes within the unresolved subgraph: survivors are on (or feed back into)
  // a cycle, peeled nodes are merely downstream of it.
  const unresolved = nodes.filter(
    (n) => !processed.has(n.id) && (inDegree.get(n.id) ?? 0) > 0
  );

  if (unresolved.length > 0) {
    const unresolvedSet = new Set(unresolved.map((n) => n.id));
    const outDeg = new Map<string, number>();
    const revAdj = new Map<string, string[]>();
    for (const id of unresolvedSet) {
      outDeg.set(id, 0);
      revAdj.set(id, []);
    }
    for (const id of unresolvedSet) {
      for (const child of adjacency.get(id) ?? []) {
        if (unresolvedSet.has(child)) {
          outDeg.set(id, (outDeg.get(id) ?? 0) + 1);
          revAdj.get(child)!.push(id);
        }
      }
    }
    const peelQueue: string[] = [];
    for (const [id, deg] of outDeg) {
      if (deg === 0) peelQueue.push(id);
    }
    const peeled = new Set<string>();
    let peelHead = 0;
    while (peelHead < peelQueue.length) {
      const id = peelQueue[peelHead++];
      peeled.add(id);
      for (const pred of revAdj.get(id) ?? []) {
        const newDeg = (outDeg.get(pred) ?? 1) - 1;
        outDeg.set(pred, newDeg);
        if (newDeg === 0) peelQueue.push(pred);
      }
    }
    const cycleIds = unresolved.filter((n) => !peeled.has(n.id)).map((n) => n.id);
    const downstreamIds = unresolved.filter((n) => peeled.has(n.id)).map((n) => n.id);

    if (cycleIds.length > 0) {
      warnings.push(
        `Cycle detected involving node(s): ${cycleIds.join(", ")}. Processing with accumulated QPS.`
      );
    }
    if (downstreamIds.length > 0) {
      warnings.push(
        `Node(s) downstream of a cycle: ${downstreamIds.join(", ")}. Traffic propagated after resolving the cycle.`
      );
    }

    // Process cycle members in traffic-flow order: start from members that
    // already accumulated QPS from the acyclic portion, and let each push its
    // output one step onward (around the cycle and out of it), so nodes
    // downstream of the cycle aren't black-holed.
    const cycleSet = new Set(cycleIds);
    const cycleQueue: string[] = cycleIds.filter((id) => total(incomingQPS.get(id) ?? ZERO) > 0);
    const processCycleMember = (nodeId: string) => {
      processed.add(nodeId);
      const output = processNode(nodeId);
      for (const [childId, share] of distribute(nodeId, output)) {
        if (processed.has(childId)) continue;
        incomingQPS.set(childId, add(incomingQPS.get(childId) ?? ZERO, share));
        if (cycleSet.has(childId)) cycleQueue.push(childId);
      }
    };
    let cycleHead = 0;
    while (cycleHead < cycleQueue.length) {
      const nodeId = cycleQueue[cycleHead++];
      if (processed.has(nodeId)) continue;
      processCycleMember(nodeId);
    }
    // Cycle members that never saw any traffic still need metrics
    for (const nodeId of cycleIds) {
      if (!processed.has(nodeId)) processCycleMember(nodeId);
    }

    // Topological pass over the downstream-of-cycle subgraph (acyclic by construction).
    const downstreamSet = new Set(downstreamIds);
    const dsInDeg = new Map<string, number>();
    for (const id of downstreamSet) dsInDeg.set(id, 0);
    for (const id of downstreamSet) {
      for (const child of adjacency.get(id) ?? []) {
        if (downstreamSet.has(child)) {
          dsInDeg.set(child, (dsInDeg.get(child) ?? 0) + 1);
        }
      }
    }
    const dsQueue: string[] = [];
    for (const [id, deg] of dsInDeg) {
      if (deg === 0) dsQueue.push(id);
    }
    let dsHead = 0;
    while (dsHead < dsQueue.length) {
      const nodeId = dsQueue[dsHead++];
      if (processed.has(nodeId)) continue;
      processed.add(nodeId);
      const output = processNode(nodeId);
      propagateToUnprocessedChildren(nodeId, output);
      for (const childId of adjacency.get(nodeId) ?? []) {
        if (!downstreamSet.has(childId)) continue;
        const newDeg = (dsInDeg.get(childId) ?? 1) - 1;
        dsInDeg.set(childId, newDeg);
        if (newDeg === 0) dsQueue.push(childId);
      }
    }
  }

  // Disconnected/idle nodes get their base latency, not 0
  for (const node of nodes) {
    if (!nodeMetrics.has(node.id)) {
      nodeMetrics.set(node.id, {
        nodeId: node.id,
        incomingQPS: 0,
        incomingReads: 0,
        incomingWrites: 0,
        absorbedReads: 0,
        effectiveQPS: capacity.get(node.id) ?? 0,
        utilization: 0,
        latencyMs: node.data.latencyMs, // base latency, not 0
        latencyP99: node.data.latencyMs,
        status: "idle",
        isBottleneck: false,
      });
    }
  }

  // User-facing latency: longest synchronous path from an entry node
  // (async hops — queues, notifications, monitoring — are excluded).
  const totalLatencyMs = computeLongestPathLatency(
    entryNodes.map((n) => n.id),
    syncAdjacency,
    nodeMetrics
  );

  // Throughput can never exceed offered load. With no entry point, nothing flows.
  // At a bottleneck, what actually gets through is min(incoming, capacity).
  let throughput: number;
  if (nodes.length === 0 || entryNodes.length === 0) {
    throughput = 0;
  } else if (bottleneckNodes.length > 0) {
    throughput = Math.min(
      requestsPerSec,
      ...bottleneckNodes.map((id) => deliveredQPS.get(id) ?? 0)
    );
  } else {
    throughput = requestsPerSec;
  }

  return {
    nodeMetrics,
    totalLatencyMs,
    bottleneckNodes,
    throughput,
    timestamp: Date.now(),
    warnings,
  };
}

/**
 * Longest-path latency over the synchronous edge graph, starting from the
 * simulation's entry nodes. Nodes only reachable via async edges don't
 * contribute — async work isn't on the user-facing request path.
 */
function computeLongestPathLatency(
  entryIds: string[],
  syncAdjacency: Map<string, string[]>,
  metrics: Map<string, NodeMetrics>
): number {
  if (entryIds.length === 0) return 0;

  // BFS reachable set from entries over sync edges
  const reachable = new Set<string>(entryIds);
  const bfs: string[] = [...entryIds];
  let bfsHead = 0;
  while (bfsHead < bfs.length) {
    const id = bfs[bfsHead++];
    for (const child of syncAdjacency.get(id) ?? []) {
      if (!reachable.has(child)) {
        reachable.add(child);
        bfs.push(child);
      }
    }
  }

  // In-degree restricted to the reachable subgraph (edges from unreachable
  // nodes must not block Kahn's ordering)
  const inDeg = new Map<string, number>();
  for (const id of reachable) inDeg.set(id, 0);
  for (const id of reachable) {
    for (const child of syncAdjacency.get(id) ?? []) {
      if (reachable.has(child)) {
        inDeg.set(child, (inDeg.get(child) ?? 0) + 1);
      }
    }
  }

  const dist = new Map<string, number>();
  const queue: string[] = [];
  for (const id of entryIds) {
    queue.push(id);
    dist.set(id, metrics.get(id)?.latencyMs ?? 0);
  }

  const done = new Set<string>();
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    if (done.has(id)) continue;
    done.add(id);

    const currentDist = dist.get(id) ?? 0;
    for (const childId of syncAdjacency.get(id) ?? []) {
      if (!reachable.has(childId)) continue;
      const childLatency = metrics.get(childId)?.latencyMs ?? 0;
      const newDist = currentDist + childLatency;
      if (newDist > (dist.get(childId) ?? 0)) {
        dist.set(childId, newDist);
      }
      const newDeg = (inDeg.get(childId) ?? 1) - 1;
      inDeg.set(childId, newDeg);
      if (newDeg === 0) {
        queue.push(childId);
      }
    }
  }

  return dist.size === 0 ? 0 : Math.max(0, ...dist.values());
}
