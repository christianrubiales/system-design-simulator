import { describe, it, expect, beforeEach } from "vitest";
import { useSavedDesignsStore } from "@/store/savedDesignsStore";
import { useCanvasStore } from "@/store/canvasStore";

/**
 * importDesign is the only place this app parses input it did not produce.
 * It must reject malformed files with a reason rather than throwing or, worse,
 * half-loading a broken canvas.
 */
const s = () => useSavedDesignsStore.getState();

const validDesign = {
  schemaVersion: 1,
  name: "Test design",
  problemId: "url-shortener",
  nodes: [
    {
      id: "n1",
      type: "component",
      position: { x: 0, y: 0 },
      data: {
        componentId: "ec2",
        label: "EC2",
        icon: "Server",
        category: "compute",
        replicas: 1,
        maxQPS: 5000,
        latencyMs: 20,
        scalable: true,
      },
    },
  ],
  edges: [],
  strokes: [],
};

beforeEach(() => {
  useSavedDesignsStore.setState({ designs: [] });
  useCanvasStore.setState({ nodes: [], edges: [] });
});

describe("importDesign", () => {
  it("accepts a well-formed design", () => {
    expect(s().importDesign(JSON.stringify(validDesign)).ok).toBe(true);
    expect(s().designs).toHaveLength(1);
  });

  it("rejects malformed JSON with a reason, not an exception", () => {
    const r = s().importDesign("{ not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeTruthy();
    expect(s().designs).toHaveLength(0);
  });

  it.each([
    ["null", "null"],
    ["a bare array", "[]"],
    ["a string", '"hello"'],
    ["a number", "42"],
    ["an empty object", "{}"],
    ["nodes not an array", JSON.stringify({ ...validDesign, nodes: "nope" })],
    ["edges not an array", JSON.stringify({ ...validDesign, edges: 7 })],
  ])("rejects %s", (_label, payload) => {
    expect(s().importDesign(payload).ok).toBe(false);
    expect(s().designs).toHaveLength(0);
  });

  it("does not throw on deeply malformed node entries", () => {
    const junk = JSON.stringify({ ...validDesign, nodes: [null, 5, { id: 1 }] });
    expect(() => s().importDesign(junk)).not.toThrow();
  });

  it("leaves the canvas untouched when an import is rejected", () => {
    s().importDesign("{ broken");
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
  });
});

describe("save and load", () => {
  it("round-trips a design through save then load", () => {
    useCanvasStore.setState({
      nodes: [
        {
          id: "n1",
          type: "component",
          position: { x: 10, y: 20 },
          data: {
            componentId: "ec2",
            label: "EC2",
            icon: "Server",
            category: "compute",
            replicas: 4,
            maxQPS: 5000,
            latencyMs: 20,
            scalable: true,
            config: { size: "m5.4xlarge" },
          },
        },
      ] as never,
      edges: [],
    });
    s().saveDesign("My design");
    expect(s().designs).toHaveLength(1);

    useCanvasStore.setState({ nodes: [], edges: [] });
    s().loadDesign(s().designs[0].id);

    const restored = useCanvasStore.getState().nodes[0];
    expect(restored.position).toEqual({ x: 10, y: 20 });
    // Config must survive the round trip, or instance sizing is silently lost.
    expect((restored.data as { config?: unknown }).config).toEqual({ size: "m5.4xlarge" });
    expect((restored.data as { replicas: number }).replicas).toBe(4);
  });

  it("ignores a load for an id that does not exist", () => {
    expect(() => s().loadDesign("nope")).not.toThrow();
  });
});
