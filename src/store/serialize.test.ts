import { describe, it, expect } from "vitest";
import { serializeNodes, serializeEdges, type SerializedComponentData } from "@/store/savedDesignsStore";
import { upgradeNodeData } from "@/data/upgradeNodeData";
import { testNode } from "@/engine/testFixtures";
import type { Edge } from "@xyflow/react";

/**
 * Serialization has produced two silent data-loss bugs already: dropping
 * `edge.data` lost every label and async flag, and omitting `config` lost every
 * instance-size choice. Both are invisible until a user reloads a saved design.
 */
describe("node serialization", () => {
  it("carries config through — losing it silently discards instance sizing", () => {
    const node = testNode("a", "ec2", { replicas: 3, config: { size: "m5.4xlarge" } });
    const [out] = serializeNodes([node]);
    const data = out.data as SerializedComponentData;
    expect(data.config).toEqual({ size: "m5.4xlarge" });
    expect(data.replicas).toBe(3);
    expect(data.maxQPS).toBe(40000);
  });

  it("round-trips through upgradeNodeData without losing derived capacity", () => {
    const node = testNode("a", "ec2", { replicas: 3, config: { size: "m5.4xlarge" } });
    const [out] = serializeNodes([node]);
    const restored = upgradeNodeData(out.data as SerializedComponentData);
    expect(restored.maxQPS).toBe(40000);
    expect(restored.replicas).toBe(3);
    expect(restored.config).toEqual({ size: "m5.4xlarge" });
  });

  it("keeps text nodes intact", () => {
    const text = {
      id: "t",
      type: "text",
      position: { x: 5, y: 6 },
      data: { text: "note", fontSize: "lg" },
    } as never;
    const [out] = serializeNodes([text]);
    expect(out.type).toBe("text");
    expect((out.data as { text: string }).text).toBe("note");
  });

  it("preserves position exactly", () => {
    const node = { ...testNode("a", "ec2"), position: { x: -12.5, y: 340 } };
    expect(serializeNodes([node])[0].position).toEqual({ x: -12.5, y: 340 });
  });
});

describe("edge serialization", () => {
  it("carries data — losing it discards labels, protocol, and async flags", () => {
    const edges: Edge[] = [
      {
        id: "e1",
        source: "a",
        target: "b",
        type: "animated",
        data: { label: "/api/users", protocol: "grpc", async: true },
      },
    ];
    const [out] = serializeEdges(edges);
    expect(out.data).toEqual({ label: "/api/users", protocol: "grpc", async: true });
    expect(out.source).toBe("a");
    expect(out.target).toBe("b");
    expect(out.type).toBe("animated");
  });

  it("survives an edge with no data", () => {
    const [out] = serializeEdges([{ id: "e", source: "a", target: "b" }]);
    expect(out.id).toBe("e");
  });
});
