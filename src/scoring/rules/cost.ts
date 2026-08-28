import type { Node, Edge } from "@xyflow/react";
import type { ComponentNodeData } from "@/store/canvasStore";
import type { CategoryScore, ScoringGraph } from "@/types/scoring";
import { rolesOf, nodeIs } from "@/scoring/concepts";

// Point budget (max 20): capacity matched to load 3 + no per-request billing on
// bulk traffic 2 + storage count 3 + cache savings 3 + no disconnected nodes 3 +
// CDN 3 + queue 3 = 20
export function scoreCost(
  nodes: Node<ComponentNodeData>[],
  edges: Edge[],
  graph: ScoringGraph
): CategoryScore {
  const feedback: string[] = [];
  const passed: string[] = [];
  let score = 0;

  const connectedNodes = nodes.filter((n) => graph.reachable.has(n.id));
  // NOTE: these hold ARCHITECTURAL ROLES, not component ids. Matching on raw
  // ids is what silently broke scoring when the catalog moved to AWS names —
  // every check for "cache"/"nosql-db" returned false and the reference
  // solutions fell to 27/100. rolesOf() maps a service to its concept plus
  // everything it satisfies, so Aurora counts as a SQL database.
  const connectedIds = new Set(connectedNodes.flatMap((n) => [...rolesOf(String(n.data.componentId))]));
  const placedIds = new Set(nodes.flatMap((n) => [...rolesOf(String(n.data.componentId))]));

  // Capacity matched to load (3 pts).
  //
  // This used to award points for having between 3 and 25 components, which is
  // a proxy for cost rather than cost. Now that the simulator reports per-node
  // utilization, we can measure the actual waste: capacity you provisioned and
  // are not using. Absolute dollars would not work here — a URL shortener and a
  // video platform have wildly different legitimate budgets — but utilization
  // is comparable across every problem.
  const simulated = connectedNodes.filter(
    (n) => typeof n.data.utilization === "number" && (n.data.incomingQPS ?? 1) !== 0,
  );
  const idleExpensive = connectedNodes.filter((n) => {
    const u = n.data.utilization;
    return typeof u === "number" && u > 0 && u < 0.1 && (Number(n.data.replicas) || 1) > 1;
  });
  const overSized = connectedNodes.filter((n) => {
    const u = n.data.utilization;
    return typeof u === "number" && u > 0 && u < 0.05;
  });

  if (simulated.length === 0) {
    // No simulation yet — fall back to the structural sanity check.
    if (nodes.length >= 3 && nodes.length <= 25) {
      score += 3;
      passed.push(
        "Reasonable component count (" + nodes.length + "). Run a simulation to score capacity against real utilization.",
      );
    } else if (nodes.length < 3) {
      score += 1;
      feedback.push(
        "Only " + nodes.length + " component(s) — under-provisioned for any real workload. A minimal production system needs at least DNS → Load Balancer → App Server → Database.",
      );
    } else {
      feedback.push(
        nodes.length + " components is likely over-engineered. Every component carries hosting, monitoring, and on-call cost.",
      );
    }
  } else if (overSized.length === 0 && idleExpensive.length === 0) {
    score += 3;
    passed.push("Capacity is matched to load — no component is sitting far below its provisioned ceiling");
  } else {
    const worst = [...overSized, ...idleExpensive][0];
    score += 1;
    feedback.push(
      "You are paying for capacity you are not using: " +
        String(worst.data.label) +
        " is at " +
        Math.round((Number(worst.data.utilization) || 0) * 100) +
        "% utilization. Right-size it, or reduce the instance count — over-provisioning is the most common source of avoidable AWS spend.",
    );
  }

  // Expensive service where a cheaper one would do (2 pts).
  // API Gateway bills per request; at high traffic an ALB costs orders of
  // magnitude less for the same routing.
  const apiGwNodes = connectedNodes.filter((n) => nodeIs(n, "api-gateway"));
  const pricey = apiGwNodes.find((n) => (Number(n.data.incomingQPS) || 0) > 20000);
  if (pricey) {
    feedback.push(
      "API Gateway is carrying " +
        Math.round(Number(pricey.data.incomingQPS) / 1000) +
        "k req/s. It bills per request, so at this volume it costs orders of magnitude more than an ALB doing the same routing. Keep API Gateway where you need its authorization, throttling, and transformation features; use an ALB for raw traffic.",
    );
  } else {
    score += 2;
    passed.push("No per-request-billed service is carrying bulk traffic");
  }

  // Appropriate storage choice (3 pts)
  // Databases moved to their own category when the catalog went AWS; counting
  // only "storage" would miss RDS and DynamoDB entirely.
  const DATA_CATEGORIES = new Set(["storage", "database"]);
  const storageNodes = nodes.filter((n) => DATA_CATEGORIES.has(String(n.data.category)));
  if (storageNodes.length >= 1 && storageNodes.length <= 5) {
    score += 3;
    passed.push("Appropriate number of storage components — each serves a distinct purpose");
  } else if (storageNodes.length === 0) {
    feedback.push(
      "No storage components in your design — where is data persisted? Every system needs at least one database. Without persistent storage, you lose all data on restart."
    );
  } else {
    feedback.push(
      "You have " + storageNodes.length + " storage components — consider consolidating. Each storage system requires backups, monitoring, and operational expertise. Use the minimum number of distinct stores that satisfy your access patterns."
    );
  }

  // Caching reduces DB load = cost savings (3 pts) — both must be on the request path
  const hasCache = connectedIds.has("cache");
  const hasDB = connectedIds.has("sql-db") || connectedIds.has("nosql-db");
  if (hasCache && hasDB) {
    score += 3;
    passed.push("Cache reduces expensive database queries — a $50/mo Redis instance can save $500/mo in DB scaling costs");
  } else if (hasDB && !hasCache) {
    if (placedIds.has("cache")) {
      feedback.push(
        "You placed a Cache but it isn't connected to the request path — it's costing money without absorbing any database load. Connect your App Servers to it."
      );
    } else {
      feedback.push(
        "Add a Cache (Redis/Memcached) to reduce database load and cost. Databases are one of the most expensive components to scale. A cache costing $50-100/month can handle reads that would otherwise require a $500+/month larger DB instance."
      );
    }
  }
  // No cache or no DB = 0 points for this check (cache cost savings only apply when both exist)

  // No disconnected nodes (3 pts) — self-loops and edges to non-component
  // nodes (text annotations) don't count as being "connected"
  const nodeIds = new Set(nodes.map((n) => n.id));
  const attachedNodes = new Set<string>();
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    attachedNodes.add(edge.source);
    attachedNodes.add(edge.target);
  }
  const disconnected = nodes.filter((n) => !attachedNodes.has(n.id));
  if (disconnected.length === 0) {
    score += 3;
    passed.push("All components are connected — no wasted resources sitting idle");
  } else {
    feedback.push(
      `${disconnected.length} disconnected component(s) are not connected to anything — they're costing money without providing value. Either connect them to your architecture or remove them. Idle infrastructure is pure waste.`
    );
  }

  // CDN offloads origin traffic (3 pts)
  if (connectedIds.has("cdn")) {
    score += 3;
    passed.push("CDN offloads traffic from origin servers, reducing compute and bandwidth costs significantly");
  } else if (placedIds.has("cdn")) {
    feedback.push(
      "You placed a CDN but it isn't connected to the request path — it can't offload any origin traffic. Put it in front of your origin servers."
    );
  } else {
    feedback.push(
      "Add a CDN to offload static content delivery from your origin servers. CDN bandwidth costs $0.01-0.08/GB vs $0.09-0.12/GB for origin egress. For a media-heavy service serving 100TB/month, a CDN can save $4,000-8,000/month in bandwidth alone."
    );
  }

  // Async processing avoids over-provisioning compute (3 pts)
  if (connectedIds.has("message-queue")) {
    score += 3;
    passed.push("Message queue enables right-sizing compute — process background tasks at lower priority instead of provisioning for peak");
  } else if (placedIds.has("message-queue")) {
    feedback.push(
      "You placed a Message Queue but it isn't connected to the request path — no work is being offloaded to it. Connect a producer so it can absorb background tasks."
    );
  } else {
    feedback.push(
      "Add a Message Queue for background processing. Without async offloading, you must provision your App Servers for peak load including background tasks. With a queue, you can run cheaper, smaller worker instances that process tasks at their own pace."
    );
  }

  // Efficient architecture — not duplicating functionality (2 pts)
  // The old "duplicate networking" check (2 pts) is gone: API Gateway now
  // satisfies the rate-limiter role, so "has both" is no longer an overlap —
  // it is one service filling two jobs. Those 2 points moved to the
  // per-request-billing check above, which measures something real.


  return { category: "Cost Efficiency", score, maxScore: 20, feedback, passed };
}
