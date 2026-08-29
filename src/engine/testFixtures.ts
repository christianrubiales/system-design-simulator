import type { Node, Edge } from "@xyflow/react";
import type { ComponentNodeData } from "@/store/canvasStore";
import { SYSTEM_COMPONENTS } from "@/data/components";
import { deriveCapacity } from "@/data/serviceConfig";

/**
 * Builders for tests. A canvas node carries a snapshot of its catalog spec plus
 * derived capacity, so constructing one by hand is easy to get subtly wrong —
 * which is how an early test "failed" because the node under test had default
 * capacity rather than the configured capacity it was meant to have.
 */
export function testNode(
  id: string,
  componentId: string,
  opts: { replicas?: number; config?: Record<string, string | number | boolean> } = {},
): Node<ComponentNodeData> {
  const spec = SYSTEM_COMPONENTS.find((c) => c.id === componentId);
  if (!spec) throw new Error(`unknown component: ${componentId}`);
  const capacity = deriveCapacity(componentId, opts.config ?? {});
  return {
    id,
    type: "component",
    position: { x: 0, y: 0 },
    data: {
      componentId,
      label: spec.label,
      icon: spec.icon,
      category: spec.category,
      replicas: opts.replicas ?? 1,
      maxQPS: capacity.maxQPS,
      latencyMs: capacity.latencyMs,
      scalable: spec.scalable,
      config: opts.config,
    },
  };
}

export function testEdge(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target };
}
