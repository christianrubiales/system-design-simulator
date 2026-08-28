import type { SystemComponent } from "@/types/component";
import { SYSTEM_COMPONENTS } from "@/data/components";
import { useCustomComponentsStore } from "@/store/customComponentsStore";

/**
 * Resolve a component id to its spec, falling back to user-created custom
 * components. Lives apart from components.ts so the catalog itself stays
 * importable from Node scripts (scripts/check-catalog.ts).
 */
export function getComponentById(id: string): SystemComponent | undefined {
  const builtin = SYSTEM_COMPONENTS.find((c) => c.id === id);
  if (builtin) return builtin;
  return useCustomComponentsStore.getState().getComponent(id);
}
