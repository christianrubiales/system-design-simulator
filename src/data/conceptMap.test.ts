import { describe, it, expect } from "vitest";
import { CONCEPT_DEFAULT, PATTERN_CONCEPTS, resolveComponentId, conceptOf } from "@/data/conceptMap";
import { rolesOf, nodeIs, isManaged } from "@/scoring/concepts";
import { SYSTEM_COMPONENTS } from "@/data/components";
import type { Concept } from "@/types/component";

describe("resolveComponentId", () => {
  it("maps a generic concept to its AWS service", () => {
    expect(resolveComponentId("cache")).toBe("elasticache");
    expect(resolveComponentId("nosql-db")).toBe("dynamodb");
    expect(resolveComponentId("load-balancer")).toBe("alb");
  });

  it("passes an AWS id through unchanged", () => {
    expect(resolveComponentId("dynamodb")).toBe("dynamodb");
  });

  it("passes an unknown id through — custom components must survive", () => {
    expect(resolveComponentId("my-custom-thing")).toBe("my-custom-thing");
  });

  it("resolves a pattern concept to itself", () => {
    expect(resolveComponentId("circuit-breaker")).toBe("circuit-breaker");
  });

  it("is total — never returns undefined", () => {
    for (const id of ["", "???", "cache", "ec2"]) {
      expect(typeof resolveComponentId(id)).toBe("string");
    }
  });
});

describe("conceptOf", () => {
  it("inverts the bridge for a concept-mapped service", () => {
    expect(conceptOf("elasticache")).toBe("cache");
  });

  it("returns undefined for an AWS-only service", () => {
    expect(conceptOf("aurora")).toBeUndefined();
  });
});

describe("bridge integrity", () => {
  // Check 6 verifies concept -> service. This is the reverse direction, which
  // is what went unnoticed when App Mesh lost `concept: "service-mesh"`:
  // references still resolved, but scoring could never credit a service mesh.
  it("every default target declares the role it is default for", () => {
    for (const [concept, target] of Object.entries(CONCEPT_DEFAULT)) {
      if (target === null) continue;
      const spec = SYSTEM_COMPONENTS.find((c) => c.id === target);
      expect(spec, `${concept} -> ${target}`).toBeDefined();
      expect(rolesOf(target), `${target} should fill "${concept}"`).toContain(concept as Concept);
    }
  });

  it("leaves no concept that no service can satisfy", () => {
    const fillable = new Set<string>();
    for (const c of SYSTEM_COMPONENTS) for (const r of rolesOf(c.id)) fillable.add(r);
    for (const concept of Object.keys(CONCEPT_DEFAULT)) {
      expect(fillable.has(concept), `nothing satisfies "${concept}"`).toBe(true);
    }
  });

  it("maps no two concepts onto the same service", () => {
    const seen = new Map<string, string>();
    for (const [concept, target] of Object.entries(CONCEPT_DEFAULT)) {
      if (target === null) continue;
      expect(seen.get(target), `${seen.get(target)} and ${concept} both -> ${target}`).toBeUndefined();
      seen.set(target, concept);
    }
  });

  it("maps every pattern concept to null and nothing else", () => {
    for (const [concept, target] of Object.entries(CONCEPT_DEFAULT)) {
      expect(target === null, concept).toBe(PATTERN_CONCEPTS.has(concept as Concept));
    }
  });
});

describe("rolesOf", () => {
  it("includes both the concept and everything satisfied", () => {
    // Aurora is not `concept: sql-db` — it satisfies it. Without this, choosing
    // a better database than the default would score zero.
    expect(rolesOf("aurora")).toContain("sql-db");
    expect(rolesOf("msk")).toContain("message-queue");
    expect(rolesOf("msk")).toContain("pub-sub");
    expect(rolesOf("elasticache")).toContain("cache");
  });

  it("resolves through the bridge, so a generic id works too", () => {
    expect(rolesOf("cache")).toContain("cache");
  });

  it("returns an empty set for an unknown id rather than throwing", () => {
    expect(rolesOf("not-a-service").size).toBe(0);
  });

  it("leaves genuinely role-free infrastructure role-free", () => {
    // IAM and KMS have no generic analogue; that is correct, not a gap.
    expect(rolesOf("iam").size).toBe(0);
    expect(rolesOf("kms").size).toBe(0);
  });
});

describe("nodeIs / isManaged", () => {
  const node = (componentId: string) =>
    ({ id: "n", position: { x: 0, y: 0 }, data: { componentId } }) as never;

  it("matches a node against a role", () => {
    expect(nodeIs(node("aurora"), "sql-db")).toBe(true);
    expect(nodeIs(node("aurora"), "cache")).toBe(false);
  });

  it("distinguishes managed services from self-run ones", () => {
    expect(isManaged(node("dynamodb"))).toBe(true);
    expect(isManaged(node("ec2"))).toBe(false);
  });
});
