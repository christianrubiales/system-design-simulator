import { SYSTEM_COMPONENTS } from "@/data/components";
import { resolveComponentId } from "@/data/conceptMap";

/**
 * The catalog-owned presentation fields carried in a persisted component node.
 * Deliberately structural so both `SerializedComponentData` (savedDesignsStore)
 * and `ComponentNodeData` (canvasStore) satisfy it.
 */
export interface UpgradableNodeData {
  componentId: string;
  label: string;
  icon: string;
  category: string;
  maxQPS: number;
  latencyMs: number;
  scalable: boolean;
}

/**
 * Refresh a persisted component node against the current catalog.
 *
 * Designs and canvases saved before the AWS catalog carry generic ids
 * ("cache") with generic presentation ("Cache" / "Zap"). Resolving through the
 * concept bridge brings them back as AWS nodes. Nodes that do not resolve are
 * user-created custom components and are returned untouched.
 *
 * Only catalog-owned fields are overwritten, so user edits that live alongside
 * them — `replicas`, position, runtime metrics — always survive.
 *
 * This module imports nothing from the stores, so both canvasStore and
 * savedDesignsStore can use it without an import cycle.
 */
export function upgradeNodeData<T extends UpgradableNodeData>(data: T): T {
  const resolved = resolveComponentId(data.componentId);
  const spec = SYSTEM_COMPONENTS.find((c) => c.id === resolved);
  if (!spec) return data;
  return {
    ...data,
    componentId: spec.id,
    label: spec.label,
    icon: spec.icon,
    category: spec.category,
    maxQPS: spec.maxQPS,
    latencyMs: spec.latencyMs,
    scalable: spec.scalable,
  };
}
