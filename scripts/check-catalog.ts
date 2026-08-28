/**
 * Catalog invariant checker.
 *
 * Mechanizes the data conventions that CLAUDE.md otherwise enforces by
 * convention alone. Runs as part of `npm run build`, so a broken reference
 * fails the build instead of silently dropping a node on the canvas.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SYSTEM_COMPONENTS, COMPONENT_CATEGORIES } from "../src/data/components";
import { CONCEPT_DEFAULT, PATTERN_CONCEPTS, resolveComponentId } from "../src/data/conceptMap";
import type { Concept } from "../src/types/component";

const root = process.cwd();
const errors: string[] = [];
const catalogIds = new Set(SYSTEM_COMPONENTS.map((c) => c.id));

function read(p: string): string {
  return readFileSync(join(root, p), "utf8");
}

const problemsSrc = read("src/data/problems.ts");
const conceptSrc = read("src/data/conceptLibrary.ts");

// --- 1. Every componentId referenced by content must resolve ---
// learningPath.ts is deliberately NOT checked: its `concepts` are topic
// strings ("caching", "quadtree"), not component ids.
for (const [file, src] of [
  ["problems.ts", problemsSrc],
  ["conceptLibrary.ts", conceptSrc],
] as const) {
  for (const m of src.matchAll(/componentId: "([^"]+)"/g)) {
    // Content speaks the generic vocabulary; the bridge translates it.
    const resolved = resolveComponentId(m[1]);
    if (!catalogIds.has(resolved)) {
      const via = resolved === m[1] ? "" : ` (via concept bridge -> "${resolved}")`;
      errors.push(`${file}: componentId "${m[1]}"${via} does not resolve to a catalog entry`);
    }
  }
}

// --- 2. No reference solution may contain the same componentId twice ---
const solutions = [
  ...problemsSrc.matchAll(/referenceSolution:\s*\{\s*nodes:\s*\[([\s\S]*?)\]/g),
];
solutions.forEach((block, i) => {
  // Compare RESOLVED ids: two different generic ids collapsing onto one AWS
  // service is the failure that renders duplicate identical nodes.
  const raw = [...block[1].matchAll(/componentId: "([^"]+)"/g)].map((m) => m[1]);
  const seen = new Map<string, string>();
  for (const id of raw) {
    const resolved = resolveComponentId(id);
    const prior = seen.get(resolved);
    if (prior !== undefined) {
      const how = prior === id ? `"${id}" twice` : `"${prior}" and "${id}" both -> "${resolved}"`;
      errors.push(`problems.ts: reference solution #${i} uses ${how}`);
    }
    seen.set(resolved, id);
  }
});

// --- 3. Every declared awsIcon must have a file ---
for (const c of SYSTEM_COMPONENTS) {
  if (c.awsIcon && !existsSync(join(root, "public/aws-icons", `${c.awsIcon}.svg`))) {
    errors.push(
      `${c.id}: awsIcon "${c.awsIcon}" has no file at public/aws-icons/${c.awsIcon}.svg`,
    );
  }
}

// --- 4. Catalog ids must be unique ---
const seenIds = new Set<string>();
for (const c of SYSTEM_COMPONENTS) {
  if (seenIds.has(c.id)) errors.push(`components.ts: duplicate catalog id "${c.id}"`);
  seenIds.add(c.id);
}

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
    errors.push(
      `conceptMap.ts: "${concept}" maps to "${target}", which is not a catalog entry`,
    );
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

// --- 8. Every entry's category must be a palette section ---
// An entry in an unlisted category compiles, builds, and then is invisible in
// the palette. Only this check catches it.
const paletteCategories = new Set<string>(COMPONENT_CATEGORIES);
for (const c of SYSTEM_COMPONENTS) {
  if (!paletteCategories.has(c.category)) {
    errors.push(
      `${c.id}: category "${c.category}" is not in COMPONENT_CATEGORIES, so it would not appear in the palette`,
    );
  }
}

// --- Report ---
// Every check must run before this block, or its failures are unreachable.
if (errors.length > 0) {
  console.error(`\ncheck-catalog: ${errors.length} problem(s)\n`);
  for (const e of errors) console.error(`  x ${e}`);
  process.exit(1);
}

// The empty `{ nodes: [], edges: [] }` default used for custom problems also
// matches the block regex; count only solutions that actually place components.
const populatedSolutions = solutions.filter((b) =>
  /componentId: "/.test(b[1]),
).length;

console.log(
  `check-catalog: OK - ${SYSTEM_COMPONENTS.length} entries, ${populatedSolutions} reference solutions`,
);
