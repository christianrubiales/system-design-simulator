import { describe, it, expect, beforeEach } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { useCanvasStore } from "@/store/canvasStore";
import { testNode } from "@/engine/testFixtures";

/**
 * canvasStore holds the undo/redo history and the tab system — real logic that
 * had no coverage. Zustand stores are plain objects outside React, so these
 * drive them directly via getState().
 */
const reset = () => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    history: [],
    future: [],
    tabs: [{ id: "my-design", label: "My Design", nodes: [], edges: [] }],
    activeTabId: "my-design",
  });
};

const s = () => useCanvasStore.getState();
const node = (id: string) => testNode(id, "ec2") as Node;

describe("undo / redo", () => {
  beforeEach(reset);

  it("starts with nothing to undo or redo", () => {
    expect(s().canUndo()).toBe(false);
    expect(s().canRedo()).toBe(false);
  });

  it("undoes an added node", () => {
    s().addNode(node("a"));
    expect(s().nodes).toHaveLength(1);
    s().undo();
    expect(s().nodes).toHaveLength(0);
  });

  it("redoes what was undone", () => {
    s().addNode(node("a"));
    s().undo();
    s().redo();
    expect(s().nodes).toHaveLength(1);
  });

  it("clears the redo stack once new work happens", () => {
    s().addNode(node("a"));
    s().undo();
    expect(s().canRedo()).toBe(true);
    s().addNode(node("b"));
    expect(s().canRedo()).toBe(false);
  });

  it("caps history at 50 entries so it cannot grow without bound", () => {
    for (let i = 0; i < 70; i++) s().addNode(node(`n${i}`));
    expect(s().history.length).toBeLessThanOrEqual(50);
  });

  it("undoes a deletion, restoring the node and its edges", () => {
    s().addNode(node("a"));
    s().addNode(node("b"));
    s().onConnect({ source: "a", target: "b", sourceHandle: null, targetHandle: null });
    expect(s().edges).toHaveLength(1);
    s().deleteNode("a");
    expect(s().nodes).toHaveLength(1);
    s().undo();
    expect(s().nodes).toHaveLength(2);
    expect(s().edges).toHaveLength(1);
  });

  it("is a no-op when there is nothing to undo", () => {
    expect(() => s().undo()).not.toThrow();
    expect(s().nodes).toHaveLength(0);
  });
});

describe("deleting", () => {
  beforeEach(reset);

  it("removes edges attached to a deleted node", () => {
    s().addNode(node("a"));
    s().addNode(node("b"));
    s().onConnect({ source: "a", target: "b", sourceHandle: null, targetHandle: null });
    s().deleteNode("b");
    expect(s().edges).toHaveLength(0);
  });

  it("deletes an edge without touching its nodes", () => {
    s().addNode(node("a"));
    s().addNode(node("b"));
    s().onConnect({ source: "a", target: "b", sourceHandle: null, targetHandle: null });
    s().deleteEdge(s().edges[0].id);
    expect(s().edges).toHaveLength(0);
    expect(s().nodes).toHaveLength(2);
  });
});

describe("connecting", () => {
  beforeEach(reset);

  it("gives a new edge the animated type and default data", () => {
    s().addNode(node("a"));
    s().addNode(node("b"));
    s().onConnect({ source: "a", target: "b", sourceHandle: null, targetHandle: null });
    const e = s().edges[0] as Edge;
    expect(e.type).toBe("animated");
    // SerializedEdge must carry data or labels and async flags are lost on save.
    expect(e.data).toMatchObject({ label: "", protocol: "http", async: false });
  });

  it("creates the edge even when the connection is architecturally odd", () => {
    // Connection rules are advisory: a wrong validator must never block drawing.
    useCanvasStore.setState({ nodes: [testNode("r", "route53"), testNode("d", "rds")] as Node[] });
    s().onConnect({ source: "r", target: "d", sourceHandle: null, targetHandle: null });
    expect(s().edges).toHaveLength(1);
  });
});

describe("node data updates", () => {
  beforeEach(reset);

  it("merges partial updates rather than replacing data", () => {
    s().addNode(node("a"));
    s().updateNodeData("a", { replicas: 7 });
    const d = s().nodes[0].data as { replicas: number; componentId: string };
    expect(d.replicas).toBe(7);
    expect(d.componentId).toBe("ec2");
  });

  it("ignores an unknown node id", () => {
    s().addNode(node("a"));
    expect(() => s().updateNodeData("ghost", { replicas: 2 })).not.toThrow();
  });
});

describe("tabs", () => {
  beforeEach(reset);

  it("switching tabs preserves each tab's own canvas", () => {
    s().addNode(node("a"));
    s().addTab({ id: "t2", label: "Second", nodes: [], edges: [] });
    s().switchTab("t2");
    expect(s().nodes).toHaveLength(0);
    s().switchTab("my-design");
    expect(s().nodes).toHaveLength(1);
  });

  it("never closes the last remaining tab", () => {
    s().closeTab("my-design");
    expect(s().tabs.length).toBeGreaterThanOrEqual(1);
  });
});
