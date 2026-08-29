import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Tests cover the pure logic — the simulation engines, capacity derivation,
 * connection rules, cost arithmetic, scoring, and persistence migration. All of
 * it is deterministic and needs no browser.
 *
 * Deliberately NOT covered here: chip rendering in both themes, PNG export
 * inlining icons, drag-and-drop, the timeline scrubber, and touch behaviour.
 * Those are genuinely visual; shallow DOM tests would pass without proving
 * anything about them. See README "Testing" for that boundary.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    reporters: "dot",
  },
});
