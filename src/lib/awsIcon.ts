import type { SystemComponent } from "@/types/component";

/**
 * Public URL for a component's bundled AWS icon, or undefined to fall back to
 * the Lucide icon (pattern nodes and user-created custom components).
 *
 * The icons are CC-BY-ND 2.0 and must be rendered unaltered — scale them
 * uniformly, but never recolor or re-proportion them. See THIRD-PARTY-NOTICES.md.
 */
export function awsIconUrl(
  component: Pick<SystemComponent, "awsIcon"> | undefined,
): string | undefined {
  return component?.awsIcon ? `/aws-icons/${component.awsIcon}.svg` : undefined;
}
