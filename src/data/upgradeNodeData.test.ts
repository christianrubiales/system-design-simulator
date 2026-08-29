import { describe, it, expect } from "vitest";
import { upgradeNodeData } from "@/data/upgradeNodeData";

/** A node as persisted before the catalog moved to AWS service ids. */
const legacy = {
  componentId: "cache",
  label: "Cache / Redis",
  icon: "Zap",
  category: "storage",
  maxQPS: 100000,
  latencyMs: 1,
  scalable: true,
  replicas: 4,
};

describe("upgrading saved designs", () => {
  it("resolves a pre-AWS generic node to its AWS service", () => {
    const up = upgradeNodeData(legacy);
    expect(up.componentId).toBe("elasticache");
    expect(up.label).toBe("ElastiCache");
    expect(up.category).toBe("database");
  });

  it("preserves user edits that are not catalog-owned", () => {
    expect(upgradeNodeData(legacy).replicas).toBe(4);
  });

  it("leaves a custom component completely alone", () => {
    const custom = { ...legacy, componentId: "my-own-thing", label: "My Thing" };
    expect(upgradeNodeData(custom)).toEqual(custom);
  });

  it("recomputes capacity from config rather than resetting to the catalog default", () => {
    // Resetting maxQPS here would look like "my saved design forgot its
    // instance types" — the failure mode this guards.
    const configured = {
      componentId: "ec2",
      label: "EC2",
      icon: "Server",
      category: "compute",
      maxQPS: 40000,
      latencyMs: 20,
      scalable: true,
      replicas: 3,
      config: { size: "m5.4xlarge" },
    };
    const up = upgradeNodeData(configured);
    expect(up.maxQPS).toBe(40000);
    expect(up.replicas).toBe(3);
  });

  it("uses the catalog default when there is no config", () => {
    const plain = { ...legacy, componentId: "app-server", label: "App Server" };
    const up = upgradeNodeData(plain);
    expect(up.componentId).toBe("ec2");
    expect(up.maxQPS).toBe(5000);
  });

  it("recategorises a pattern node without giving it an AWS identity", () => {
    const pattern = { ...legacy, componentId: "circuit-breaker", label: "Circuit Breaker" };
    const up = upgradeNodeData(pattern);
    expect(up.componentId).toBe("circuit-breaker");
    expect(up.category).toBe("pattern");
  });
});
