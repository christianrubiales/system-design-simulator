import { SYSTEM_COMPONENTS } from "../src/data/components";
import { CONCEPT_DEFAULT, PATTERN_CONCEPTS, conceptOf } from "../src/data/conceptMap";
import { CONCEPT_LIBRARY } from "../src/data/conceptLibrary";
import { rolesOf } from "../src/scoring/concepts";

const allConcepts = Object.keys(CONCEPT_DEFAULT);
console.log(`concepts: ${allConcepts.length}  (${PATTERN_CONCEPTS.size} pattern)`);

// 1. Does every concept have educational content?
const noContent = allConcepts.filter((c) => !CONCEPT_LIBRARY[c]);
console.log(`\nconcepts with NO library entry: ${noContent.length}${noContent.length ? " -> " + noContent.join(", ") : ""}`);

// 2. Library entries that no longer correspond to a concept
const orphanLib = Object.keys(CONCEPT_LIBRARY).filter((k) => !allConcepts.includes(k));
console.log(`library entries with no concept: ${orphanLib.length}${orphanLib.length ? " -> " + orphanLib.join(", ") : ""}`);

// 3. Services with NO role at all — invisible to every scoring rule
const roleless = SYSTEM_COMPONENTS.filter(
  (c) => c.id !== "custom" && c.category !== "pattern" && rolesOf(c.id).size === 0,
);
console.log(`\nAWS services filling NO architectural role (invisible to scoring): ${roleless.length}`);
console.log("  " + roleless.map((c) => c.id).join(", "));

// 4. Which concepts are reachable from more than one service?
const byConcept: Record<string, string[]> = {};
for (const c of SYSTEM_COMPONENTS) {
  for (const r of rolesOf(c.id)) (byConcept[r] ??= []).push(c.id);
}
const unfilled = allConcepts.filter((c) => !byConcept[c]);
console.log(`\nconcepts NO service can satisfy: ${unfilled.length}${unfilled.length ? " -> " + unfilled.join(", ") : ""}`);
