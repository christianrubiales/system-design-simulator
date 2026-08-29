import { describe, it, expect } from "vitest";
import { SERVICE_CONFIG, deriveCapacity, defaultConfig } from "@/data/serviceConfig";
import { INSTANCE_FAMILIES } from "@/data/instanceFamilies";
import { SYSTEM_COMPONENTS } from "@/data/components";

describe("capacity derivation", () => {
  it("scales with vCPU within a family", () => {
    const small = deriveCapacity("ec2", { size: "m5.large" }).maxQPS; // 2 vCPU
    const big = deriveCapacity("ec2", { size: "m5.4xlarge" }).maxQPS; // 16 vCPU
    expect(big).toBe(small * 8);
  });

  it("handles fractional vCPU (Fargate task sizes)", () => {
    expect(deriveCapacity("fargate", { size: "0.25 vCPU" }).maxQPS).toBe(1250);
  });

  it("uses provisioned units where AWS defines them exactly", () => {
    // Not estimates: one DynamoDB capacity unit IS one request/second, and a
    // Kinesis shard IS 1,000 records/second.
    expect(deriveCapacity("dynamodb", { capacityUnits: 40000 }).maxQPS).toBe(40000);
    expect(deriveCapacity("kinesis", { shards: 100 }).maxQPS).toBe(100000);
  });

  it("lets a choice pin capacity outright", () => {
    expect(deriveCapacity("sqs", { queueType: "standard" }).maxQPS).toBe(100000);
    expect(deriveCapacity("sqs", { queueType: "fifo" }).maxQPS).toBe(300);
  });

  it("ignores configuration on passive services", () => {
    expect(deriveCapacity("iam", { size: "m5.24xlarge" }).maxQPS).toBe(1000000);
  });

  it("resolves concept aliases through the bridge", () => {
    expect(deriveCapacity("app-server", {}).maxQPS).toBe(deriveCapacity("ec2", {}).maxQPS);
    expect(deriveCapacity("cache", {}).maxQPS).toBe(deriveCapacity("elasticache", {}).maxQPS);
  });
});

describe("anti-drift invariant", () => {
  // The catalog figure IS capacity at default configuration. If these can drift
  // apart, every existing design silently changes behaviour.
  it("derives exactly the catalog maxQPS at default config", () => {
    for (const c of SYSTEM_COMPONENTS) {
      if (c.id === "custom" || c.category === "pattern") continue;
      expect(deriveCapacity(c.id, defaultConfig(c.id)).maxQPS, c.id).toBe(c.maxQPS);
    }
  });
});

describe("config schemas", () => {
  it("gives every non-pattern service an entry", () => {
    for (const c of SYSTEM_COMPONENTS) {
      if (c.id === "custom" || c.category === "pattern") continue;
      expect(SERVICE_CONFIG[c.id], c.id).toBeDefined();
    }
  });

  it("keeps every default within its own bounds", () => {
    for (const [id, spec] of Object.entries(SERVICE_CONFIG)) {
      for (const p of spec.params) {
        if (p.kind === "number") {
          expect(p.default, `${id}.${p.id}`).toBeGreaterThanOrEqual(p.min);
          expect(p.default, `${id}.${p.id}`).toBeLessThanOrEqual(p.max);
        } else if (p.kind === "choice") {
          expect(p.options.map((o) => o.value), `${id}.${p.id}`).toContain(p.default);
        } else if (p.kind === "instance") {
          const sizes = p.families.flatMap((f) => INSTANCE_FAMILIES[f]?.sizes.map((s) => s.size) ?? []);
          expect(sizes, `${id}.${p.id}`).toContain(p.default);
        }
      }
    }
  });

  it("uses unique param ids within a service", () => {
    for (const [id, spec] of Object.entries(SERVICE_CONFIG)) {
      const ids = spec.params.map((p) => p.id);
      expect(new Set(ids).size, id).toBe(ids.length);
    }
  });
});
