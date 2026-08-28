# AWS Catalog + Concept Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn SystemForge's 36 generic components into a 45-service AWS catalog with official AWS icons, without editing a single line of the 35 problems' reference solutions.

**Architecture:** `SystemComponent` gains optional AWS fields (`awsIcon`, `awsService`, `concept`, `managed`). A new `conceptMap.ts` translates the old generic ids the content layer speaks into the AWS service ids the catalog now holds, so `problems.ts` and `conceptLibrary.ts` are never touched. A build-gating `check-catalog.ts` mechanizes the data invariants that CLAUDE.md currently enforces by convention.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, @xyflow/react v12, Zustand v5, Tailwind v4. New devDependency: `tsx` (to run the checker). No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-28-aws-catalog-concept-bridge-design.md`

## Global Constraints

- **Read `AGENTS.md` and `CLAUDE.md` first.** This is Next.js 16; check `node_modules/next/dist/docs/` before writing framework code.
- **No file, code, or data may be copied from `../system-design-simulator-sushant/`.** It is GPL v3; this repo is MIT. Read it for ideas only. All AWS facts come from AWS primary sources.
- `simulator.ts` and all five files under `src/scoring/rules/` are **read-only for this entire plan**.
- Each scoring category still totals exactly 20. Scoring is not touched.
- Persisted stores keep `version: 1`, a no-op `migrate`, and `skipHydration: true`. **No store schema version bumps in this plan.**
- `nodeTypes` / `edgeTypes` stay module-level — never inline.
- Reference tabs (`tab.readOnly`) keep gating drag/connect/drop/delete.
- Hover-only affordances stay gated on `useIsCoarsePointer()`.
- `SerializedEdge` keeps carrying `data`.
- **Both themes must work.** CLAUDE.md's "dark theme only" claim is stale — a light/dark toggle ships in `appStore.ts` and `top-bar.tsx`.
- No AI/Claude attribution or co-author trailers in commit messages.
- Verification is `npm run build` (runs `tsc`) plus the catalog checker. There is no test framework and this plan does not add one.

### Two spec corrections, established by reading the code

1. **`learningPath.ts` contains no `componentId`s.** Its `concepts` field holds topic strings (`"caching"`, `"quadtree"`). CLAUDE.md is wrong about this. The checker scopes to `problems.ts` and `conceptLibrary.ts` only.
2. **The collision rule's rationale is narrower than the spec states.** `loadReference.ts` round-robins duplicate `componentId`s, so two concepts resolving to one service yields two identical-looking nodes — visually confusing, *not* mis-wired. The rule stands; it is a content-quality rule, not a correctness one.

---

## File Structure

**Created:**
- `src/data/conceptMap.ts` — the bridge: `CONCEPT_DEFAULT`, `resolveComponentId`, `conceptOf`. Pure, no imports from stores.
- `src/data/componentLookup.ts` — `getComponentById`, the only catalog helper that touches the Zustand custom-components store.
- `src/lib/awsIcon.ts` — `awsIconUrl(component)`; pure string mapping.
- `scripts/check-catalog.ts` — build-gating data invariant checker.
- `scripts/fetch-aws-icons.ts` — one-shot, re-runnable icon extractor.
- `public/aws-icons/*.svg` + `public/aws-icons/provenance.json` — committed assets.
- `THIRD-PARTY-NOTICES.md` — AWS icon terms and MIT carve-out.

**Modified:**
- `src/types/component.ts` — `AwsCategory`, `Concept`, extended `SystemComponent`.
- `src/data/components.ts` — the catalog itself; `CATEGORY_STYLE` single source of truth. **Loses its store import** so Node can import it.
- `src/components/canvas/nodes/ComponentNode.tsx` — consume `CATEGORY_STYLE`, render AWS icon in chip.
- `src/components/sidebar/ComponentPalette.tsx` — consume `CATEGORY_STYLE`, grouping, alias search, `conceptOf` lookup.
- `src/components/canvas/DesignCanvas.tsx`, `src/lib/loadReference.ts` — repoint `getComponentById` import.
- `src/store/savedDesignsStore.ts` — upgrade-on-load.
- `package.json` — `tsx` devDep, `check:catalog` script, build wiring.
- `CLAUDE.md` — corrections.

**Why `components.ts` splits:** it currently imports `useCustomComponentsStore` at module level, which makes it un-importable from a Node script. The checker must import the real catalog rather than regex it. Moving the one store-dependent function out is the minimum change that achieves this, and it is a genuine responsibility split — pure data vs. runtime merge.

---

## Task 1: Types and single-source category styling

**Files:**
- Modify: `src/types/component.ts`
- Modify: `src/data/components.ts:452-463` (tail: `COMPONENT_CATEGORIES`, `getComponentById`)
- Create: `src/data/componentLookup.ts`
- Modify: `src/components/canvas/nodes/ComponentNode.tsx:18-24`
- Modify: `src/components/sidebar/ComponentPalette.tsx:26-39`
- Modify: `src/components/canvas/DesignCanvas.tsx:21`, `src/lib/loadReference.ts:3`

**Interfaces:**
- Produces: `AwsCategory`, `Concept`, extended `SystemComponent`, `CATEGORY_STYLE`, `COMPONENT_CATEGORIES`, `getComponentById` (moved, same signature `(id: string) => SystemComponent | undefined`).

- [ ] **Step 1: Extend the types**

In `src/types/component.ts`, replace `ComponentCategory` and `SystemComponent`:

```ts
export type AwsCategory =
  | "networking"
  | "compute"
  | "containers"
  | "storage"
  | "database"
  | "integration"
  | "analytics"
  | "security"
  | "observability"
  | "pattern";

/** Legacy category strings kept so pre-AWS persisted nodes still render with color. */
export type LegacyCategory = "messaging" | "infrastructure";

export type ComponentCategory = AwsCategory | LegacyCategory;

/** The generic vocabulary the interview content layer speaks. */
export type Concept =
  | "dns" | "cdn" | "load-balancer" | "api-gateway" | "rate-limiter"
  | "app-server" | "auth-service" | "sql-db" | "nosql-db" | "cache"
  | "object-storage" | "search" | "message-queue" | "service-mesh"
  | "monitoring" | "websocket-server" | "task-scheduler" | "stream-processor"
  | "notification-service" | "graph-db" | "timeseries-db" | "data-warehouse"
  | "service-discovery" | "reverse-proxy" | "distributed-lock"
  | "circuit-breaker" | "file-store" | "origin-shield" | "coordination-service"
  | "id-generator" | "sharded-counter" | "pub-sub" | "vector-db"
  | "geospatial-index" | "config-service";

export interface SystemComponent {
  id: string;
  label: string;
  category: ComponentCategory;
  icon: string; // lucide icon name — fallback when awsIcon is absent
  /** Basename in public/aws-icons/, without extension. Absent for patterns and custom. */
  awsIcon?: string;
  /** Full AWS product name, e.g. "Amazon Elastic Compute Cloud". */
  awsService?: string;
  /** Bridge to the generic vocabulary. Absent for AWS-only services. */
  concept?: Concept;
  /** AWS-managed vs self-run. Consumed by blended scoring in sub-project 7. */
  managed?: boolean;
  maxQPS: number;
  latencyMs: number;
  scalable: boolean;
  stateful: boolean;
  description: string;
}
```

- [ ] **Step 2: Add `CATEGORY_STYLE` to `components.ts` and drop the store import**

At the top of `src/data/components.ts`, delete `import { useCustomComponentsStore } from "@/store/customComponentsStore";`. Delete the `getComponentById` function at the bottom. Replace `COMPONENT_CATEGORIES` with:

```ts
/**
 * Single source of truth for per-category color. ComponentNode and
 * ComponentPalette both render from this — they previously kept separate,
 * drifting copies of the same information.
 */
export const CATEGORY_STYLE: Record<
  ComponentCategory,
  { label: string; chip: string; icon: string; ring: string }
> = {
  networking:    { label: "Networking",    chip: "bg-blue-500/10",    icon: "text-blue-400",    ring: "ring-blue-500/25" },
  compute:       { label: "Compute",       chip: "bg-violet-500/10",  icon: "text-violet-400",  ring: "ring-violet-500/25" },
  containers:    { label: "Containers",    chip: "bg-indigo-500/10",  icon: "text-indigo-400",  ring: "ring-indigo-500/25" },
  storage:       { label: "Storage",       chip: "bg-amber-500/10",   icon: "text-amber-400",   ring: "ring-amber-500/25" },
  database:      { label: "Database",      chip: "bg-sky-500/10",     icon: "text-sky-400",     ring: "ring-sky-500/25" },
  integration:   { label: "Integration",   chip: "bg-emerald-500/10", icon: "text-emerald-400", ring: "ring-emerald-500/25" },
  analytics:     { label: "Analytics",     chip: "bg-teal-500/10",    icon: "text-teal-400",    ring: "ring-teal-500/25" },
  security:      { label: "Security",      chip: "bg-rose-500/10",    icon: "text-rose-400",    ring: "ring-rose-500/25" },
  observability: { label: "Observability", chip: "bg-cyan-500/10",    icon: "text-cyan-400",    ring: "ring-cyan-500/25" },
  pattern:       { label: "Patterns",      chip: "bg-zinc-500/10",    icon: "text-zinc-300",    ring: "ring-zinc-500/25" },
  // Legacy keys — retained so nodes persisted before the AWS catalog keep their color.
  messaging:      { label: "Messaging",      chip: "bg-emerald-500/10", icon: "text-emerald-400", ring: "ring-emerald-500/25" },
  infrastructure: { label: "Infrastructure", chip: "bg-cyan-500/10",    icon: "text-cyan-400",    ring: "ring-cyan-500/25" },
};

/** Categories shown as palette sections, in display order. Legacy keys excluded. */
export const COMPONENT_CATEGORIES = [
  "networking", "compute", "containers", "database", "storage",
  "integration", "analytics", "security", "observability", "pattern",
] as const satisfies readonly AwsCategory[];
```

Add `AwsCategory` and `ComponentCategory` to the type import at the top of the file.

- [ ] **Step 3: Create `src/data/componentLookup.ts`**

```ts
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
```

- [ ] **Step 4: Repoint the three `getComponentById` importers**

In `src/components/canvas/DesignCanvas.tsx:21`, `src/components/sidebar/ComponentPalette.tsx:14`, and `src/lib/loadReference.ts:3`, change the import source from `@/data/components` to `@/data/componentLookup`. In `ComponentPalette.tsx` this means splitting one import statement into two — `SYSTEM_COMPONENTS`/`COMPONENT_CATEGORIES`/`CATEGORY_STYLE` stay on `@/data/components`.

- [ ] **Step 5: Consume `CATEGORY_STYLE` in both renderers**

In `ComponentNode.tsx`, delete the local `CATEGORY_COLORS` map (lines 18-24), import `CATEGORY_STYLE` from `@/data/components`, and change line 36 to:

```ts
const colors = CATEGORY_STYLE[nodeData.category as ComponentCategory] ?? CATEGORY_STYLE.compute;
```

In `ComponentPalette.tsx`, delete `CATEGORY_ACCENT` and `CATEGORY_BG` (lines 26-39). Replace their two usages (lines 181-182) with:

```ts
const style = CATEGORY_STYLE[item.category as ComponentCategory] ?? CATEGORY_STYLE.compute;
```

then use `style.icon` where `accent` was used and `style.chip` where `iconBg` was used. Update the section header loop at line 161 — `COMPONENT_CATEGORIES` is now an array of keys, not objects, so `cat.label` becomes `CATEGORY_STYLE[cat].label` and `cat.key` becomes `cat`.

`CreateComponentDialog.tsx:109` also maps `COMPONENT_CATEGORIES` expecting `{key, label}`. Update it to `{COMPONENT_CATEGORIES.map((c) => (...CATEGORY_STYLE[c].label...))}` with `c` as the value.

- [ ] **Step 6: Verify the build is clean and the app is visually unchanged**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass.

Then `npm run dev`, and confirm: palette renders all five original sections with their original colors; dragging a component onto the canvas still works; node chips are the same colors as before. **This task must produce zero visible change** — it is pure restructuring.

- [ ] **Step 7: Commit**

```bash
git add src/types/component.ts src/data/components.ts src/data/componentLookup.ts src/components/canvas/nodes/ComponentNode.tsx src/components/sidebar/ComponentPalette.tsx src/components/canvas/DesignCanvas.tsx src/components/dialogs/CreateComponentDialog.tsx src/lib/loadReference.ts
git commit -m "refactor: AWS-ready component types, single-source category styling, store-free catalog module"
```

---

## Task 2: The catalog checker, proven red then green

**Files:**
- Create: `scripts/check-catalog.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `SYSTEM_COMPONENTS` from Task 1.
- Produces: `npm run check:catalog`, exit code 1 on any violation. Runs as part of `npm run build`.

- [ ] **Step 1: Add `tsx` and the scripts**

Run: `npm install --save-dev tsx`

In `package.json`, set:

```json
"scripts": {
  "dev": "next dev",
  "check:catalog": "tsx scripts/check-catalog.ts",
  "build": "npm run check:catalog && next build",
  "start": "next start",
  "lint": "eslint"
}
```

- [ ] **Step 2: Write the checker**

Create `scripts/check-catalog.ts`. It parses the content files as source text (they are large TS literals; regex extraction avoids pulling React/Zustand into Node) and imports the catalog directly.

```ts
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SYSTEM_COMPONENTS } from "../src/data/components";

const root = process.cwd();
const errors: string[] = [];
const catalogIds = new Set(SYSTEM_COMPONENTS.map((c) => c.id));

function read(p: string): string {
  return readFileSync(join(root, p), "utf8");
}

// --- 1. Every componentId referenced by content must resolve ---
const problemsSrc = read("src/data/problems.ts");
const conceptSrc = read("src/data/conceptLibrary.ts");

for (const [file, src] of [
  ["problems.ts", problemsSrc],
  ["conceptLibrary.ts", conceptSrc],
] as const) {
  for (const m of src.matchAll(/componentId: "([^"]+)"/g)) {
    if (!catalogIds.has(m[1])) {
      errors.push(`${file}: componentId "${m[1]}" does not resolve to a catalog entry`);
    }
  }
}

// --- 2. No reference solution may contain the same componentId twice ---
const solutions = [...problemsSrc.matchAll(/referenceSolution:\s*\{\s*nodes:\s*\[([\s\S]*?)\]/g)];
solutions.forEach((block, i) => {
  const ids = [...block[1].matchAll(/componentId: "([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(`problems.ts: reference solution #${i} uses "${id}" twice`);
    }
    seen.add(id);
  }
});

// --- 3. Every declared awsIcon must have a file ---
for (const c of SYSTEM_COMPONENTS) {
  if (c.awsIcon && !existsSync(join(root, "public/aws-icons", `${c.awsIcon}.svg`))) {
    errors.push(`${c.id}: awsIcon "${c.awsIcon}" has no file at public/aws-icons/${c.awsIcon}.svg`);
  }
}

// --- 4. Catalog ids must be unique ---
const seenIds = new Set<string>();
for (const c of SYSTEM_COMPONENTS) {
  if (seenIds.has(c.id)) errors.push(`components.ts: duplicate catalog id "${c.id}"`);
  seenIds.add(c.id);
}

if (errors.length > 0) {
  console.error(`\ncheck-catalog: ${errors.length} problem(s)\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`check-catalog: OK — ${SYSTEM_COMPONENTS.length} entries, ${solutions.length} reference solutions`);
```

- [ ] **Step 3: Run it — it must PASS against the current known-good data**

Run: `npm run check:catalog`
Expected: `check-catalog: OK — 36 entries, 36 reference solutions`

If it fails here, the checker is wrong, not the data. Fix the checker.

- [ ] **Step 4: Prove it actually catches things (the red half)**

Temporarily edit `src/data/problems.ts` and change any one `componentId: "cache"` to `componentId: "definitely-not-real"`.

Run: `npm run check:catalog`
Expected: FAIL, exit 1, with `problems.ts: componentId "definitely-not-real" does not resolve to a catalog entry`.

Now temporarily duplicate a `componentId` line inside one reference solution's `nodes` array.

Run: `npm run check:catalog`
Expected: FAIL with `reference solution #N uses "..." twice`.

**Revert both edits** (`git checkout src/data/problems.ts`) and re-run — expected: OK. A checker never observed failing is not known to work.

- [ ] **Step 5: Confirm it gates the build**

Run: `npm run build`
Expected: checker output appears first, then the Next.js build succeeds.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-catalog.ts package.json package-lock.json
git commit -m "build: add catalog invariant checker, gate build on it"
```

---

## Task 3: The concept bridge

**Files:**
- Create: `src/data/conceptMap.ts`
- Modify: `src/data/componentLookup.ts`
- Modify: `src/components/sidebar/ComponentPalette.tsx:183`
- Modify: `scripts/check-catalog.ts`

**Interfaces:**
- Produces: `CONCEPT_DEFAULT: Record<Concept, string | null>`, `resolveComponentId(id: string): string`, `conceptOf(componentId: string): Concept | undefined`, `PATTERN_CONCEPTS: ReadonlySet<Concept>`.
- Consumed by Task 9 (switch-over), Task 11 (migration), and sub-project 7 (scoring).

At this point the catalog is still generic, so every concept maps to itself. That is deliberate: the plumbing ships and is verified *before* the data changes under it, so any breakage in Task 9 is unambiguously the data.

- [ ] **Step 1: Write `src/data/conceptMap.ts`**

```ts
import type { Concept } from "@/types/component";
import { SYSTEM_COMPONENTS } from "@/data/components";

/**
 * Concepts that describe an architectural pattern rather than a purchasable
 * AWS service. They stay first-class catalog entries under category "pattern"
 * and never map to a service.
 */
export const PATTERN_CONCEPTS: ReadonlySet<Concept> = new Set<Concept>([
  "circuit-breaker", "id-generator", "sharded-counter", "distributed-lock",
  "coordination-service", "geospatial-index", "reverse-proxy",
  "origin-shield", "vector-db",
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
```

- [ ] **Step 2: Resolve inside `getComponentById`**

In `src/data/componentLookup.ts`, resolve before lookup so every call site benefits at once — `loadReference.ts` (reference solutions), `DesignCanvas.tsx` (drag-drop), `ComponentPalette.tsx` (tap-to-add):

```ts
import type { SystemComponent } from "@/types/component";
import { SYSTEM_COMPONENTS } from "@/data/components";
import { resolveComponentId } from "@/data/conceptMap";
import { useCustomComponentsStore } from "@/store/customComponentsStore";

export function getComponentById(id: string): SystemComponent | undefined {
  const resolved = resolveComponentId(id);
  const builtin = SYSTEM_COMPONENTS.find((c) => c.id === resolved);
  if (builtin) return builtin;
  // Custom components are looked up by their original id — never resolved.
  return useCustomComponentsStore.getState().getComponent(id);
}
```

- [ ] **Step 3: Route the concept-library lookup through `conceptOf`**

`ComponentPalette.tsx:183` reads `CONCEPT_LIBRARY[item.id]`. Once the catalog holds AWS ids, `CONCEPT_LIBRARY["elasticache"]` misses and every AWS service silently loses its tooltip. Change it to:

```ts
const concept = CONCEPT_LIBRARY[item.concept ?? item.id];
```

- [ ] **Step 4: Extend the checker for bridge invariants**

Add these imports to the top of `scripts/check-catalog.ts`:

```ts
import { CONCEPT_DEFAULT, PATTERN_CONCEPTS } from "../src/data/conceptMap";
import type { Concept } from "../src/types/component";
```

Then add, after the existing checks:

```ts
// --- 5. No two concepts may share a default service ---
const byTarget = new Map<string, string[]>();
for (const [concept, target] of Object.entries(CONCEPT_DEFAULT)) {
  if (target === null) continue;
  byTarget.set(target, [...(byTarget.get(target) ?? []), concept]);
}
for (const [target, concepts] of byTarget) {
  if (concepts.length > 1) {
    errors.push(`conceptMap.ts: concepts [${concepts.join(", ")}] all map to "${target}"`);
  }
}

// --- 6. Every non-pattern default must exist in the catalog ---
for (const [concept, target] of Object.entries(CONCEPT_DEFAULT)) {
  if (target !== null && !catalogIds.has(target)) {
    errors.push(`conceptMap.ts: "${concept}" maps to "${target}", which is not a catalog entry`);
  }
}

// --- 7. Pattern concepts must be null, and only pattern concepts may be ---
for (const [concept, target] of Object.entries(CONCEPT_DEFAULT)) {
  const isPattern = PATTERN_CONCEPTS.has(concept as Concept);
  if (isPattern && target !== null) {
    errors.push(`conceptMap.ts: pattern concept "${concept}" must map to null`);
  }
  if (!isPattern && target === null) {
    errors.push(`conceptMap.ts: "${concept}" maps to null but is not in PATTERN_CONCEPTS`);
  }
}
```

- [ ] **Step 5: Verify green, then prove the collision check bites**

Run: `npm run check:catalog`
Expected: OK.

Temporarily change `CONCEPT_DEFAULT.cache` to `"nosql-db"`.
Run: `npm run check:catalog`
Expected: FAIL with `concepts [nosql-db, cache] all map to "nosql-db"`.
Revert.

- [ ] **Step 6: Verify nothing changed in the app**

Run: `npm run build`, then `npm run dev`. Open any problem, click through to load its reference solution. Expected: identical to before — all nodes present and wired, palette tooltips intact.

- [ ] **Step 7: Commit**

```bash
git add src/data/conceptMap.ts src/data/componentLookup.ts src/components/sidebar/ComponentPalette.tsx scripts/check-catalog.ts
git commit -m "feat: concept bridge mapping generic component ids to catalog entries"
```

---

## Task 4: Fetch and bundle the official AWS icons

**Files:**
- Create: `scripts/fetch-aws-icons.ts`
- Create: `public/aws-icons/*.svg`, `public/aws-icons/provenance.json`
- Create: `THIRD-PARTY-NOTICES.md`

**Interfaces:**
- Produces: SVG files named by catalog service id (`ec2.svg`, `dynamodb.svg`, …), consumed by Task 5's `awsIconUrl`.

- [ ] **Step 1: Terms — RESOLVED 2026-08-28, read before implementing**

The icons are licensed **CC-BY-ND 2.0** (Attribution-NoDerivatives). Precedent: AWS's own
<https://github.com/awslabs/aws-icons-for-plantuml> redistributes these icons in an
open-source repo, icons under CC-BY-ND 2.0 and code under MIT — the exact split this
plan uses. Bundling is permitted. Current pack version: **`07312026`**.

**Three hard constraints follow, and they override anything else in this task:**

1. **Ship the SVGs byte-for-byte unmodified.** NoDerivatives forbids distributing an
   altered work. Do NOT strip `<?xml>` declarations, remove generator comments, run
   SVGO, recolor, re-proportion, or edit the markup in any way. Renaming the *file* is
   fine — the work itself is untouched. Uniform scaling at render time is fine;
   changing proportion or color is not.
2. **Attribution is required**, and the notice must name CC-BY-ND 2.0 specifically —
   not a vague reference to "AWS terms".
3. **Service icons only — never the AWS logo or wordmark.** Architecture service icons
   are the CC-BY-ND asset; the AWS logo and smile mark are trademarks needing written
   permission. Do not import them, and do not display anything implying AWS sponsorship
   or endorsement of SystemForge.

- [ ] **Step 2: Write the extraction script**

Create `scripts/fetch-aws-icons.ts`. It takes the downloaded ZIP as a local path argument (the pack is behind a click-through, so this is not an unattended download). **It copies bytes; it never rewrites SVG content** — see Step 1 constraint 1:

```ts
/**
 * Usage: npx tsx scripts/fetch-aws-icons.ts <path-to-asset-package.zip>
 *
 * Extracts only the icons referenced by the catalog, normalizes their names to
 * our service ids, and records provenance. Re-runnable to refresh the pack.
 *
 * The AWS Architecture Icons are NOT MIT — see THIRD-PARTY-NOTICES.md.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { SYSTEM_COMPONENTS } from "../src/data/components";

const PACK_VERSION = "<version label from Step 1>";
const PACK_URL = "<asset package URL from Step 1>";
const OUT = join(process.cwd(), "public/aws-icons");

// Map our service id -> the icon basename inside the pack, e.g.
// "ec2" -> "Arch_Amazon-EC2_48". Filled in during Step 3 by inspecting the zip.
const PACK_NAMES: Record<string, string> = {};
```

**Expected archive layout** (verify against the actual zip in Step 3, do not assume): AWS ships the pack as `Asset-Package_<date>/Architecture-Service-Icons_<date>/Arch_<Category>/48/Arch_<Service-Name>_48.svg`, alongside `Architecture-Group-Icons` and `Resource-Icons` directories we do not use. So `PACK_NAMES` maps e.g. `ec2 -> "Arch_Amazon-EC2_48"`.

Unzip the archive to a temp dir, glob `**/Architecture-Service-Icons*/**/48/*.svg`, index the results by basename, then for each catalog entry with an `awsIcon` look up its `PACK_NAMES` value and **copy the file verbatim** to `public/aws-icons/${component.awsIcon}.svg`. Use a byte copy (`copyFileSync`), not a read-transform-write — the NoDerivatives term makes any content rewrite a licensing problem, and a byte copy also makes "did we modify it?" trivially auditable.

Fail loudly with the list of unmatched ids rather than writing a partial set — a missing icon is caught by `check-catalog` later, but failing here names the problem where it happened. Write `provenance.json` as:

```json
{ "packVersion": "...", "sourceUrl": "...", "fetchedAt": "2026-08-28", "icons": ["ec2", "dynamodb"] }
```

- [ ] **Step 3: Run it and inspect the output**

Run: `npx tsx scripts/fetch-aws-icons.ts ~/Downloads/<pack>.zip`

Expected: `public/aws-icons/` contains one SVG per AWS service in the catalog. Open three of them directly in a browser. Confirm each renders, is square, and has no white background box that will look wrong on a dark canvas. If icons carry a baked background, prefer the pack's alternate variant.

- [ ] **Step 4: Write the licensing notice**

Create `THIRD-PARTY-NOTICES.md`:

```markdown
# Third-Party Notices

## AWS Architecture Icons — `public/aws-icons/`

The SVG files in `public/aws-icons/` are the official AWS Architecture Icons,
© Amazon Web Services, Inc. They are **not** covered by this repository's MIT
license and are explicitly excluded from its grant.

- Licensed under: **CC-BY-ND 2.0** (Attribution-NoDerivatives)
  <https://creativecommons.org/licenses/by-nd/2.0/>
- Source: <https://aws.amazon.com/architecture/icons/>
- Package version: 07312026

The icons are redistributed **unmodified**, as NoDerivatives requires. They are
rendered inside a neutral container in this application; the icon artwork itself
is never recolored, re-proportioned, or otherwise altered.

SystemForge is not affiliated with, endorsed by, or sponsored by Amazon Web
Services. No AWS logo or wordmark is used — only architecture service icons.

All other files in this repository are MIT licensed. See `LICENSE`.
```

The dual-license split here follows AWS's own
<https://github.com/awslabs/aws-icons-for-plantuml>, which distributes these icons
under CC-BY-ND 2.0 alongside MIT-licensed code.

Add a one-line pointer to `README.md` and to `LICENSE`'s vicinity so the carve-out is discoverable.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-aws-icons.ts public/aws-icons THIRD-PARTY-NOTICES.md README.md
git commit -m "assets: bundle official AWS Architecture Icons with licensing carve-out"
```

---

## Task 5: Render AWS icons inside the category chip

**Files:**
- Create: `src/lib/awsIcon.ts`
- Modify: `src/components/canvas/nodes/ComponentNode.tsx:106-108`
- Modify: `src/components/sidebar/ComponentPalette.tsx` (icon render inside the row)
- Modify: `src/data/components.ts` (two entries only, as a rendering probe)

**Interfaces:**
- Produces: `awsIconUrl(component: Pick<SystemComponent, "awsIcon">): string | undefined`.

- [ ] **Step 1: Write the URL helper**

```ts
import type { SystemComponent } from "@/types/component";

/** Public URL for a component's bundled AWS icon, or undefined to fall back to Lucide. */
export function awsIconUrl(
  component: Pick<SystemComponent, "awsIcon"> | undefined
): string | undefined {
  return component?.awsIcon ? `/aws-icons/${component.awsIcon}.svg` : undefined;
}
```

- [ ] **Step 2: Add `awsIcon` to two existing entries as a probe**

In `src/data/components.ts`, add `awsIcon: "ec2"` and `awsService: "Amazon Elastic Compute Cloud"` to the `app-server` entry, and `awsIcon: "s3"` / `awsService: "Amazon Simple Storage Service"` to `object-storage`. Leave everything else generic. This proves the render path against real assets before the bulk data entry in Tasks 6-8.

- [ ] **Step 3: Render in `ComponentNode.tsx`**

`ComponentNodeData` is a snapshot and does not carry `awsIcon`, so read it from the catalog. Near line 35, add:

```ts
const spec = getComponentById(nodeData.componentId);
const iconUrl = awsIconUrl(spec);
```

Replace the chip contents at line 107:

```tsx
<div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ${colors.chip} ${colors.icon} ${colors.ring}`}>
  {iconUrl ? (
    <img src={iconUrl} alt="" aria-hidden className="h-4 w-4" draggable={false} />
  ) : (
    <Icon className="h-4 w-4" />
  )}
</div>
```

`alt=""` + `aria-hidden` because the node's visible label already names the service — the icon is decorative and a screen reader announcing it twice is noise.

- [ ] **Step 4: Render in `ComponentPalette.tsx`**

Apply the same conditional inside the palette row's `h-6 w-6` chip, using `awsIconUrl(item)` — the palette maps over `SystemComponent` directly, so no catalog lookup is needed there.

- [ ] **Step 5: Verify rendering in both themes**

Run: `npm run dev`. Confirm: App Server and Object Storage show AWS icons inside their tinted chips on canvas and in the palette; every other component still shows its Lucide icon; **toggle light/dark from the top bar** and confirm both icons stay legible against the chip in each theme. If a full-color icon disappears against the light chip, adjust the chip's opacity rather than the icon.

- [ ] **Step 6: Verify PNG export includes the icons**

This is the failure mode nobody notices until a user exports. Place both probe components on the canvas, then use the export-to-PNG action.

Expected: the downloaded PNG contains the AWS icons, not blank chips.

If they are blank, `html-to-image` is not inlining the `<img>`. Fix by passing `fetchRequestInit`/`cacheBust` options in `src/lib/exportCanvas.ts`, or by inlining the SVGs as data URIs at build time. **Do not proceed to Task 6 with a broken export** — the fix gets harder once 45 services depend on it.

- [ ] **Step 7: Commit**

```bash
git add src/lib/awsIcon.ts src/components/canvas/nodes/ComponentNode.tsx src/components/sidebar/ComponentPalette.tsx src/data/components.ts
git commit -m "feat: render AWS service icons inside category chips"
```

---

## Tasks 6-8: The catalog data

These three tasks are the same shape, split by category so each is reviewable. **Every entry must follow this contract:**

```ts
{
  id: "dynamodb",
  label: "DynamoDB",
  category: "database",
  icon: "Database",              // Lucide fallback, must exist in ICON_MAP
  awsIcon: "dynamodb",           // must exist at public/aws-icons/dynamodb.svg
  awsService: "Amazon DynamoDB",
  concept: "nosql-db",           // omit for AWS-only services
  managed: true,
  // Source: AWS DynamoDB service quotas — 40,000 RCU/WCU per table default
  // (soft limit, raisable). https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ServiceQuotas.html
  maxQPS: 40000,
  latencyMs: 5,                  // Source: AWS single-digit ms at any scale
  scalable: true,
  stateful: true,
  description: "…",
}
```

**Non-negotiable for every entry:** `maxQPS` and `latencyMs` carry a `// Source:` comment citing the AWS quota page or documented characteristic they derive from. CLAUDE.md requires every figure be correct — these are numbers a candidate will repeat in an interview. Where AWS publishes no figure, say so in the comment and state the basis for the estimate. **Never copy a number from the Sr. Architect repo.**

Existing generic entries are *converted in place* (keeping their `description` where still accurate, rewritten where AWS-specific) rather than deleted and re-added, so the diff stays reviewable.

### Task 6: Networking, compute, containers (13 services)

**Files:** Modify `src/data/components.ts`

- [ ] **Step 1:** Convert/add — Route 53 (`concept: "dns"`), CloudFront (`cdn`), Elastic Load Balancing (`load-balancer`), API Gateway (`api-gateway`), AWS WAF (`rate-limiter`, `category: "security"`), EC2 (`app-server`), Lambda, Fargate, Auto Scaling — plus AWS-only VPC, NAT Gateway, PrivateLink, Global Accelerator. Containers: ECS, EKS.
- [ ] **Step 2:** Run `npm run check:catalog`. Expected: OK. Any `awsIcon` without a file fails here — that is the check doing its job.
- [ ] **Step 3:** Run `npm run build`, then `npm run dev` and confirm the new services appear in the palette with correct icons in both themes.
- [ ] **Step 4:** Commit: `git commit -m "data: AWS networking, compute, and container services"`

### Task 7: Database, storage, integration (16 services)

**Files:** Modify `src/data/components.ts`

- [ ] **Step 1:** Convert/add — RDS (`sql-db`), DynamoDB (`nosql-db`), ElastiCache (`cache`), Aurora, DocumentDB, Neptune (`graph-db`), Timestream (`timeseries-db`), S3 (`object-storage`), EFS (`file-store`). Integration: SQS (`message-queue`), SNS (`notification-service`), EventBridge (`pub-sub`), EventBridge Scheduler (`task-scheduler`), Step Functions, AppSync (`websocket-server`), App Mesh (`service-mesh`).
- [ ] **Step 2:** Run `npm run check:catalog`. Expected: OK.
- [ ] **Step 3:** Run `npm run build` and spot-check the palette.
- [ ] **Step 4:** Commit: `git commit -m "data: AWS database, storage, and integration services"`

### Task 8: Analytics, security, observability, patterns (16 entries)

**Files:** Modify `src/data/components.ts`

- [ ] **Step 1:** Convert/add — Kinesis Data Streams (`stream-processor`), Kinesis Data Firehose, OpenSearch (`search`), Redshift (`data-warehouse`), Athena, Glue, MSK. Security: Cognito (`auth-service`), IAM, Secrets Manager, KMS. Observability: CloudWatch (`monitoring`), X-Ray, Cloud Map (`service-discovery`), AppConfig (`config-service`).
- [ ] **Step 2:** Recategorize the 9 pattern entries to `category: "pattern"`, set `concept` to their own id, and **leave `awsIcon` absent** so they keep their Lucide icons: `circuit-breaker`, `id-generator`, `sharded-counter`, `distributed-lock`, `coordination-service`, `geospatial-index`, `reverse-proxy`, `origin-shield`, `vector-db`.
- [ ] **Step 3:** Run `npm run check:catalog`. Expected: OK, ~55 entries.
- [ ] **Step 4:** Run `npm run build`; confirm pattern nodes render Lucide icons and AWS services render AWS icons, in both themes.
- [ ] **Step 5:** Commit: `git commit -m "data: AWS analytics, security, observability services and pattern nodes"`

---

## Task 9: Switch the bridge over to AWS defaults

**Files:**
- Modify: `src/data/conceptMap.ts`

**Interfaces:**
- Consumes: the catalog ids created in Tasks 6-8.

This is the moment the 35 reference solutions become AWS diagrams, and it is a data-only change to one file.

- [ ] **Step 1: Point every non-pattern concept at its AWS service**

Update `CONCEPT_DEFAULT` per the spec's mapping table: `dns: "route53"`, `cdn: "cloudfront"`, `"load-balancer": "elb"`, `"api-gateway": "api-gateway"`, `"rate-limiter": "waf"`, `"app-server": "ec2"`, `"auth-service": "cognito"`, `"sql-db": "rds"`, `"nosql-db": "dynamodb"`, `cache: "elasticache"`, `"object-storage": "s3"`, `search: "opensearch"`, `"message-queue": "sqs"`, `"service-mesh": "app-mesh"`, `monitoring: "cloudwatch"`, `"websocket-server": "appsync"`, `"task-scheduler": "eventbridge-scheduler"`, `"stream-processor": "kinesis"`, `"notification-service": "sns"`, `"pub-sub": "eventbridge"`, `"graph-db": "neptune"`, `"timeseries-db": "timestream"`, `"data-warehouse": "redshift"`, `"service-discovery": "cloud-map"`, `"file-store": "efs"`, `"config-service": "appconfig"`. Pattern concepts stay `null`.

- [ ] **Step 2: Run the checker**

Run: `npm run check:catalog`
Expected: OK. Checks 5-7 from Task 3 now do real work — a typo'd service id or an accidental collision fails here.

- [ ] **Step 3: Load all 35 reference solutions and confirm each is intact**

Run `npm run dev`. For **every** problem in the Learn tab, open its reference solution and confirm: the same number of nodes as before, all wired (no orphans), all rendering AWS icons except pattern nodes. This is the single highest-risk step in the plan — the whole design rests on the claim that the content layer needs no edits. Thirty-five checks is tedious and is the point.

Record any problem whose diagram looks wrong. A wrong-looking diagram here means the concept mapping chose a poor default, not that the bridge is broken.

- [ ] **Step 4: Confirm the interview flow still works end to end**

Start a 45-minute interview on one problem, place components, run the simulation, and open the score report. Expected: unchanged behavior — the simulator and scorer were never touched, and this verifies that claim rather than assuming it.

- [ ] **Step 5: Commit**

```bash
git add src/data/conceptMap.ts
git commit -m "feat: point concept bridge at AWS services — reference solutions now render as AWS"
```

---

## Task 10: Palette grouping and alias search

**Files:**
- Modify: `src/components/sidebar/ComponentPalette.tsx`

- [ ] **Step 1: Make sections collapsible**

Ten sections over ~55 entries is too long to scroll. Add per-section open/closed state (`useState<Record<string, boolean>>`), defaulting Networking, Compute, Database, and Integration open and the rest closed. Persist nothing — this is per-session UI state, not worth a store.

The section header at line ~168 becomes a `<button>` with an aria-expanded attribute and a chevron. Keep the existing count badge.

- [ ] **Step 2: Extend search to match concept aliases and AWS names**

Search currently matches `label` and `description`. Extend the predicate so typing `cache` finds ElastiCache and `nosql` finds DynamoDB:

```ts
const q = search.toLowerCase();
const matches = (c: SystemComponent) =>
  c.label.toLowerCase().includes(q) ||
  c.description.toLowerCase().includes(q) ||
  (c.awsService?.toLowerCase().includes(q) ?? false) ||
  (c.concept?.toLowerCase().includes(q) ?? false);
```

When a search is active, show all matches flat and ignore collapsed state — a hidden match is a bug.

- [ ] **Step 3: Verify**

Run `npm run dev`. Confirm: sections collapse and expand; the count badges are right; searching `cache` surfaces ElastiCache; searching `nosql` surfaces DynamoDB; searching with sections collapsed still shows results; on a touch viewport, tap-to-add still works and the grip affordance is still gated on coarse pointer.

- [ ] **Step 4: Commit**

```bash
git add src/components/sidebar/ComponentPalette.tsx
git commit -m "feat: collapsible palette sections and concept-alias search"
```

---

## Task 11: Upgrade saved designs on load

**Files:**
- Modify: `src/store/savedDesignsStore.ts`

**Interfaces:**
- Consumes: `resolveComponentId` from Task 3, `SYSTEM_COMPONENTS` from Task 1.

A design saved before this change holds `componentId: "cache"` with `label: "Cache"` and `icon: "Zap"`. It renders fine untouched — just generic. This upgrades it in place on load without any persisted-schema change.

- [ ] **Step 1: Write the upgrade helper**

In `src/store/savedDesignsStore.ts`:

```ts
/**
 * Refresh a persisted component node against the current catalog.
 *
 * Pre-AWS designs carry generic ids ("cache") and generic presentation
 * ("Cache" / "Zap"). Resolving through the bridge brings them back as AWS
 * nodes. Nodes that do not resolve are user-created custom components and are
 * returned untouched. User-edited `replicas` always survives.
 */
function upgradeComponentData(data: SerializedComponentData): SerializedComponentData {
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
```

- [ ] **Step 2: Apply it on both entry points**

Call `upgradeComponentData` for every node with `type === "component"` inside `loadDesign` and inside `importDesign`, after structural validation passes. Text nodes pass through untouched.

Do **not** apply it at save time — saving an upgraded copy would rewrite the user's stored data as a side effect of loading, which is a surprise. Upgrade is a read-path transform only.

- [ ] **Step 3: Verify with a genuinely old design**

Before rebuilding: `git stash`, run the app at the pre-AWS commit, create a design using Cache + App Server + NoSQL DB, save it, then export it to a `.json` file. `git stash pop`, rebuild, and:

- load the saved design from localStorage → expect ElastiCache, EC2, DynamoDB with AWS icons, edges intact;
- import the exported `.json` → same result;
- create a custom component, save, reload → expect it unchanged with its Lucide icon;
- set replicas to 4 on a node, save, reload → expect replicas still 4.

- [ ] **Step 4: Confirm no schema version changed**

Run: `grep -rn "version:" src/store/*.ts`
Expected: every persisted store still reads `version: 1`.

- [ ] **Step 5: Commit**

```bash
git add src/store/savedDesignsStore.ts
git commit -m "feat: upgrade pre-AWS saved designs to catalog entries on load"
```

---

## Task 12: Documentation corrections

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-08-28-aws-catalog-concept-bridge-design.md`

- [ ] **Step 1: Correct CLAUDE.md**

- Replace "Dark theme only (`<html class="dark">`); there is no theme toggle" with the truth: a light/dark toggle lives in `appStore.ts` and `top-bar.tsx`, and **both themes must be verified** for any UI change.
- Fix the data-conventions bullet: `learningPath.ts` does **not** reference component ids; its `concepts` are topic strings. Scope the invariant to `problems.ts` and `conceptLibrary.ts`.
- Update the component count (`components.ts (30 specs)`) to the real number.
- Document the concept bridge under a new invariant: content speaks `Concept` ids, the catalog speaks AWS service ids, `conceptMap.ts` translates, and no two concepts may share a default.
- Add `npm run check:catalog` to the Commands section and note that `npm run build` gates on it.
- Note the `public/aws-icons/` MIT carve-out and point at `THIRD-PARTY-NOTICES.md`.

- [ ] **Step 2: Correct the spec's two known inaccuracies**

Update the spec so it does not mislead whoever reads it for sub-projects 2-7:

- scope the checker to `problems.ts` + `conceptLibrary.ts` (drop `learningPath.ts`);
- correct the collision rule's rationale from "silently mis-wires" to "renders duplicate identical nodes";
- correct `resolveComponentId`'s signature: the spec declares `(id: string) => string | undefined`, but it is implemented as a total function returning `string` (unknown ids pass through so custom components survive).

- [ ] **Step 3: Final full verification**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass, checker reports the full catalog.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-08-28-aws-catalog-concept-bridge-design.md
git commit -m "docs: correct theme, learning-path, and catalog invariants; document concept bridge"
```

---

## Definition of done

- `npm run build` passes, with `check:catalog` reporting ~55 entries and 35 reference solutions.
- Zero lines changed in `problems.ts`, `conceptLibrary.ts`, `interviewData.ts`, `learningPath.ts`, `simulator.ts`, or any file under `src/scoring/`.
- All 35 reference solutions load as AWS diagrams with no orphan nodes.
- PNG export contains AWS icons.
- A design saved before the change loads as AWS; a custom component survives untouched.
- Both light and dark themes verified.
- Every persisted store still at `version: 1`.
- `THIRD-PARTY-NOTICES.md` records the AWS icon carve-out.
