/**
 * Catalog invariant checker.
 *
 * Mechanizes the data conventions that CLAUDE.md otherwise enforces by
 * convention alone. Runs as part of `npm run build`, so a broken reference
 * fails the build instead of silently dropping a node on the canvas.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SYSTEM_COMPONENTS } from "../src/data/components";

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
    if (!catalogIds.has(m[1])) {
      errors.push(`${file}: componentId "${m[1]}" does not resolve to a catalog entry`);
    }
  }
}

// --- 2. No reference solution may contain the same componentId twice ---
const solutions = [
  ...problemsSrc.matchAll(/referenceSolution:\s*\{\s*nodes:\s*\[([\s\S]*?)\]/g),
];
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
