import type { SystemComponent } from "@/types/component";
import { SYSTEM_COMPONENTS } from "@/data/components";
import { resolveComponentId } from "@/data/conceptMap";
import { useCustomComponentsStore } from "@/store/customComponentsStore";

/**
 * Resolve a component id to its spec, falling back to user-created custom
 * components. Lives apart from components.ts so the catalog itself stays
 * importable from Node scripts (scripts/check-catalog.ts).
 *
 * Ids are run through the concept bridge first, so the content layer can keep
 * speaking generic ids ("cache") while the catalog holds AWS services.
 */
export function getComponentById(id: string): SystemComponent | undefined {
  const resolved = resolveComponentId(id);
  const builtin = SYSTEM_COMPONENTS.find((c) => c.id === resolved);
  if (builtin) return builtin;
  // Custom components are looked up by their original id — never resolved.
  return useCustomComponentsStore.getState().getComponent(id);
}
