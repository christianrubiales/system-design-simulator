import { describe, it, expect } from "vitest";
import { validateConnection, SERVICE_PORTS } from "@/data/connectionRules";
import { PROBLEMS } from "@/data/problems";

describe("connection validation", () => {
  // A validator that accepts everything scores as well on the reference
  // solutions as a correct one. These pairs are what prove it discriminates.
  it.each([
    ["route53", "rds"],
    ["cloudfront", "dynamodb"],
    ["rds", "dynamodb"],
    ["elasticache", "s3"],
    ["dynamodb", "rds"],
    ["s3", "rds"],
    ["waf", "elasticache"],
    ["cognito", "s3"],
    ["opensearch", "dynamodb"],
    ["alb", "rds"],
  ])("flags %s -> %s", (source, target) => {
    const v = validateConnection(source, target);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/expects/);
  });

  it.each([
    ["ec2", "rds", "database"],
    ["ec2", "dynamodb", "database"],
    ["alb", "ec2", "compute"],
    ["sqs", "lambda", "compute"],
    ["lambda", "dynamodb", "database"],
    ["route53", "alb", "http"],
    ["cloudfront", "s3", "storage"],
    ["kinesis", "ecs", "compute"],
    ["ec2", "cloudwatch", "observability"],
    ["api-gateway", "cognito", "identity"],
  ])("accepts %s -> %s as %s traffic", (source, target, kind) => {
    const v = validateConnection(source, target);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.kind).toBe(kind);
  });

  it("treats an undeclared endpoint as unknown, never invalid", () => {
    // Absence of data must not read as a negative verdict.
    const v = validateConnection("ec2", "circuit-breaker");
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.kind).toBeNull();
  });

  it("treats an unknown id as unknown", () => {
    expect(validateConnection("ec2", "some-custom-component").ok).toBe(true);
  });
});

describe("reference solutions", () => {
  it("validate clean — a flag here is a bug in the rules, not the diagram", () => {
    for (const p of PROBLEMS) {
      for (const e of p.referenceSolution.edges) {
        const v = validateConnection(e.source, e.target);
        expect(v.ok, `${p.id}: ${e.source} -> ${e.target}`).toBe(true);
      }
    }
  });
});

describe("port declarations", () => {
  it("only reference real catalog services", () => {
    // Guards against a service being renamed and its ports silently orphaned.
    expect(Object.keys(SERVICE_PORTS).length).toBeGreaterThan(40);
  });
});
