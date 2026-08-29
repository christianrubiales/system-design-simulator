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
import {
  AWS_REGIONS,
  UNAVAILABLE_REGIONS,
  UNKNOWN_AVAILABILITY,
} from "../src/data/regionAvailability";
import { PROBLEMS } from "../src/data/problems";
import { validateConnection, SERVICE_PORTS } from "../src/data/connectionRules";
import { SERVICE_CONFIG, deriveCapacity, defaultConfig } from "../src/data/serviceConfig";
import { INSTANCE_FAMILIES } from "../src/data/instanceFamilies";

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

// --- 9. Region data must stay consistent with the catalog ---
const regionCodes = new Set(AWS_REGIONS.map((r) => r.code));
for (const [serviceId, regions] of Object.entries(UNAVAILABLE_REGIONS)) {
  if (!catalogIds.has(serviceId)) {
    errors.push(`regionAvailability.ts: "${serviceId}" is not a catalog entry`);
  }
  for (const r of regions) {
    if (!regionCodes.has(r)) {
      errors.push(`regionAvailability.ts: "${serviceId}" references unknown region "${r}"`);
    }
  }
}
for (const id of UNKNOWN_AVAILABILITY) {
  if (!catalogIds.has(id)) {
    errors.push(`regionAvailability.ts: UNKNOWN_AVAILABILITY "${id}" is not a catalog entry`);
  }
}

// --- 10-12. Reference solution topology (see the topology-corrections spec) ---
// These encode three defect classes found in the shipped content: a
// `rate-limiter` hop that is not an AWS service, queues wired straight into
// datastores with no consumer, and nodes orphaned by rewiring.
// Queues, streams, and routing/fan-out services all invoke or are drained by a
// consumer; none of them writes to a datastore itself.
const QUEUE_OR_STREAM = new Set([
  "message-queue", "stream-processor", "msk", "sqs", "kinesis",
  "notification-service", "sns",
  "pub-sub", "eventbridge",
  "task-scheduler", "eventbridge-scheduler",
]);
const DATASTORES = new Set([
  "nosql-db", "sql-db", "object-storage", "search", "timeseries-db",
  "sharded-counter", "notification-service", "task-scheduler", "graph-db",
  "data-warehouse", "geospatial-index",
  "dynamodb", "rds", "s3", "opensearch", "timestream", "redshift", "neptune",
]);

for (const p of PROBLEMS) {
  const ids = p.referenceSolution.nodes.map((n) => n.componentId);

  // 10. Rate limiting is a capability of API Gateway / WAF / app code, not a hop.
  if (ids.includes("rate-limiter")) {
    errors.push(`problems.ts: "${p.id}" still places a rate-limiter node`);
  }

  // 11. A queue or stream never writes to a datastore itself — a consumer does.
  for (const e of p.referenceSolution.edges) {
    if (QUEUE_OR_STREAM.has(e.source) && DATASTORES.has(e.target)) {
      errors.push(
        `problems.ts: "${p.id}" wires ${e.source} -> ${e.target} with no consumer between`,
      );
    }
  }

  // 12. Rewiring must not strand a node with no edges at all.
  const touched = new Set(p.referenceSolution.edges.flatMap((e) => [e.source, e.target]));
  for (const id of ids) {
    if (!touched.has(id)) {
      errors.push(`problems.ts: "${p.id}" leaves "${id}" unconnected`);
    }
  }
}

// --- 13. Every reference-solution edge must validate against the port model ---
// The reference solutions are expert-authored correct architectures, so a flag
// here is a bug in SERVICE_PORTS, not in the diagram.
for (const p of PROBLEMS) {
  for (const e of p.referenceSolution.edges) {
    const verdict = validateConnection(e.source, e.target);
    if (!verdict.ok) {
      errors.push(
        `connectionRules.ts: "${p.id}" edge ${e.source} -> ${e.target} is flagged — ${verdict.reason}`,
      );
    }
  }
}

// --- 14. Port declarations must refer to real catalog services ---
for (const id of Object.keys(SERVICE_PORTS)) {
  if (!catalogIds.has(id)) {
    errors.push(`connectionRules.ts: "${id}" is not a catalog entry`);
  }
}

// --- 15-18. Config schemas ---
for (const c of SYSTEM_COMPONENTS) {
  if (c.id === "custom" || c.category === "pattern") continue;
  const spec = SERVICE_CONFIG[c.id];

  // 15. Every configurable service needs a schema (`params: []` is valid).
  if (!spec) {
    errors.push(`serviceConfig.ts: "${c.id}" has no SERVICE_CONFIG entry`);
    continue;
  }

  // 16. Defaults must be valid, and param ids unique within a service.
  const seenParams = new Set<string>();
  for (const p of spec.params) {
    if (seenParams.has(p.id)) {
      errors.push(`serviceConfig.ts: "${c.id}" has duplicate param id "${p.id}"`);
    }
    seenParams.add(p.id);

    if (p.kind === "instance") {
      // 17. Referenced families must exist, and the default must be one of their sizes.
      const sizes: string[] = [];
      for (const fam of p.families) {
        const family = INSTANCE_FAMILIES[fam];
        if (!family) {
          errors.push(`serviceConfig.ts: "${c.id}.${p.id}" references unknown family "${fam}"`);
          continue;
        }
        sizes.push(...family.sizes.map((s) => s.size));
      }
      if (sizes.length > 0 && !sizes.includes(p.default)) {
        errors.push(
          `serviceConfig.ts: "${c.id}.${p.id}" default "${p.default}" is not in its families`,
        );
      }
    } else if (p.kind === "choice") {
      if (!p.options.some((o) => o.value === p.default)) {
        errors.push(`serviceConfig.ts: "${c.id}.${p.id}" default "${p.default}" is not an option`);
      }
    } else if (p.kind === "number") {
      if (p.default < p.min || p.default > p.max) {
        errors.push(
          `serviceConfig.ts: "${c.id}.${p.id}" default ${p.default} is outside ${p.min}..${p.max}`,
        );
      }
    }
  }

  // 18. ANTI-DRIFT: the catalog figure IS capacity at default configuration.
  const derived = deriveCapacity(c.id, defaultConfig(c.id));
  if (derived.maxQPS !== c.maxQPS) {
    errors.push(
      `serviceConfig.ts: "${c.id}" derives ${derived.maxQPS} QPS at defaults but the catalog says ${c.maxQPS} (${derived.explanation})`,
    );
  }
}

// NOTE: behavioural assertions (scoring floors, tick convergence) live in
// vitest suites, not here. This script validates DATA invariants — ids resolve,
// nothing collides, icons exist, schemas are well-formed. Keeping the two apart
// stops this file becoming the place every check lands.

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
