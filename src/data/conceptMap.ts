import type { Concept } from "@/types/component";
import { SYSTEM_COMPONENTS } from "@/data/components";

/**
 * Concepts that describe an architectural pattern rather than a purchasable
 * AWS service. They stay first-class catalog entries under category "pattern"
 * and never map to a service.
 */
export const PATTERN_CONCEPTS: ReadonlySet<Concept> = new Set<Concept>([
  "circuit-breaker",
  "id-generator",
  "sharded-counter",
  "distributed-lock",
  "coordination-service",
  "geospatial-index",
  "reverse-proxy",
  "origin-shield",
  "vector-db",
]);

/**
 * Generic concept -> default AWS service id.
 *
 * INVARIANT: no two concepts may share a value. loadReference.ts round-robins
 * duplicate componentIds, so a collision does not mis-wire a diagram, but it
 * does render two identical-looking nodes in a reference solution — which
 * reads as a mistake to the candidate. check-catalog enforces this.
 *
 * Pattern concepts map to null and resolve to themselves.
 *
 * Values are still the generic ids: the AWS switch-over happens in one commit
 * once the catalog holds AWS services, so any breakage is unambiguously data.
 */
export const CONCEPT_DEFAULT: Record<Concept, string | null> = {
  dns: "dns",
  cdn: "cdn",
  "load-balancer": "load-balancer",
  "api-gateway": "api-gateway",
  "rate-limiter": "rate-limiter",
  "app-server": "app-server",
  "auth-service": "auth-service",
  "sql-db": "sql-db",
  "nosql-db": "nosql-db",
  cache: "cache",
  "object-storage": "object-storage",
  search: "search",
  "message-queue": "message-queue",
  "service-mesh": "service-mesh",
  monitoring: "monitoring",
  "websocket-server": "websocket-server",
  "task-scheduler": "task-scheduler",
  "stream-processor": "stream-processor",
  "notification-service": "notification-service",
  "pub-sub": "pub-sub",
  "graph-db": "graph-db",
  "timeseries-db": "timeseries-db",
  "data-warehouse": "data-warehouse",
  "service-discovery": "service-discovery",
  "file-store": "file-store",
  "config-service": "config-service",
  // Pattern concepts — no AWS service.
  "reverse-proxy": null,
  "distributed-lock": null,
  "circuit-breaker": null,
  "origin-shield": null,
  "coordination-service": null,
  "id-generator": null,
  "sharded-counter": null,
  "vector-db": null,
  "geospatial-index": null,
};

/**
 * Translate a content-layer id into the catalog id to place on canvas.
 * Returns the input unchanged when it is already a catalog id or unknown
 * (unknown ids belong to user-created custom components).
 */
export function resolveComponentId(id: string): string {
  const mapped = CONCEPT_DEFAULT[id as Concept];
  return mapped ?? id;
}

/** Inverse lookup: which generic concept does this catalog entry represent? */
export function conceptOf(componentId: string): Concept | undefined {
  return SYSTEM_COMPONENTS.find((c) => c.id === componentId)?.concept;
}
