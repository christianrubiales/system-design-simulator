import type { Node } from "@xyflow/react";
import type { ComponentNodeData } from "@/store/canvasStore";
import type { Concept } from "@/types/component";
import type { ScoringGraph } from "@/types/scoring";
import { SYSTEM_COMPONENTS } from "@/data/components";
import { resolveComponentId } from "@/data/conceptMap";

/**
 * Which architectural roles a catalog entry can fill.
 *
 * Rules MUST match on this rather than on raw component ids. Hardcoding ids is
 * what silently broke scoring when the catalog moved to AWS names: 86 checks
 * for "cache", "nosql-db" and friends all began returning false, and the
 * reference solutions dropped to an average of 27/100.
 *
 * A service's own `concept` plus everything in `satisfies` — so Aurora counts
 * as a SQL database, MSK as both a queue and a pub/sub bus, and Fargate as an
 * application tier.
 */
export function rolesOf(componentId: string): Set<Concept> {
  const spec = SYSTEM_COMPONENTS.find((c) => c.id === resolveComponentId(componentId));
  const roles = new Set<Concept>();
  if (!spec) return roles;
  if (spec.concept) roles.add(spec.concept);
  for (const r of spec.satisfies ?? []) roles.add(r);
  return roles;
}

/** Does this node fill the given architectural role? */
export function nodeIs(node: Node<ComponentNodeData>, concept: Concept): boolean {
  return rolesOf(String(node.data.componentId)).has(concept);
}

/**
 * Is a component filling this role present AND on the wired request path?
 *
 * Reachability is deliberate: placing a cache without connecting it earns no
 * points, exactly as it would earn no credit in a real interview.
 */
export function hasConcept(
  nodes: Node<ComponentNodeData>[],
  graph: ScoringGraph,
  ...concepts: Concept[]
): boolean {
  return nodes.some(
    (n) => graph.reachable.has(n.id) && concepts.some((c) => nodeIs(n, c)),
  );
}

/** Every connected node filling any of the given roles. */
export function nodesWith(
  nodes: Node<ComponentNodeData>[],
  graph: ScoringGraph,
  ...concepts: Concept[]
): Node<ComponentNodeData>[] {
  return nodes.filter(
    (n) => graph.reachable.has(n.id) && concepts.some((c) => nodeIs(n, c)),
  );
}

/** Is the component present at all, wired or not? */
export function placedConcept(
  nodes: Node<ComponentNodeData>[],
  ...concepts: Concept[]
): boolean {
  return nodes.some((n) => concepts.some((c) => nodeIs(n, c)));
}

/** True when the node is an AWS-managed service rather than something self-run. */
export function isManaged(node: Node<ComponentNodeData>): boolean {
  const spec = SYSTEM_COMPONENTS.find(
    (c) => c.id === resolveComponentId(String(node.data.componentId)),
  );
  return spec?.managed === true;
}
