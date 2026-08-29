import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useAppStore } from "@/store/appStore";
import { usePenStore, type Stroke } from "@/store/penStore";
import { useTradeoffStore } from "@/store/tradeoffStore";
import { useCustomComponentsStore } from "@/store/customComponentsStore";
import { safeLocalStorage } from "@/store/safeStorage";

/**
 * The remaining stores. Most are thin state containers, but three carry real
 * logic worth pinning: the toast auto-dismiss timer, the pen eraser's hit test,
 * and custom-component id collision handling.
 */

describe("appStore toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.getState().clearToast();
  });
  afterEach(() => vi.useRealTimers());

  it("shows a toast and auto-dismisses it after 4s", () => {
    useAppStore.getState().showToast("saved", "success");
    expect(useAppStore.getState().toast).toEqual({ message: "saved", type: "success" });
    vi.advanceTimersByTime(4000);
    expect(useAppStore.getState().toast).toBeNull();
  });

  it("resets the countdown when a second toast arrives", () => {
    // A single owner of the timer: the second showToast must cancel the first
    // one's dismissal, or the new message vanishes early.
    useAppStore.getState().showToast("first", "info");
    vi.advanceTimersByTime(3000);
    useAppStore.getState().showToast("second", "info");
    vi.advanceTimersByTime(3000);
    expect(useAppStore.getState().toast?.message).toBe("second");
    vi.advanceTimersByTime(1000);
    expect(useAppStore.getState().toast).toBeNull();
  });

  it("clearToast cancels the pending dismissal", () => {
    useAppStore.getState().showToast("x", "info");
    useAppStore.getState().clearToast();
    expect(useAppStore.getState().toast).toBeNull();
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
  });
});

describe("appStore settings", () => {
  it("toggles the theme between light and dark", () => {
    useAppStore.getState().setTheme("dark");
    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe("light");
    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe("dark");
  });

  it("stores the selected region", () => {
    useAppStore.getState().setRegion("eu-west-1");
    expect(useAppStore.getState().region).toBe("eu-west-1");
    useAppStore.getState().setRegion("us-east-1");
  });
});

describe("pen eraser", () => {
  const stroke = (id: string, points: [number, number][]): Stroke => ({
    id,
    points,
    color: "#fff",
    width: 4,
  });

  beforeEach(() => usePenStore.setState({ strokes: [] }));

  it("erases a stroke when any point falls inside the radius", () => {
    usePenStore.getState().setStrokes([stroke("a", [[0, 0], [100, 100]])]);
    usePenStore.getState().eraseAt(102, 98, 10);
    expect(usePenStore.getState().strokes).toHaveLength(0);
  });

  it("leaves a stroke alone when every point is outside the radius", () => {
    usePenStore.getState().setStrokes([stroke("a", [[0, 0], [100, 100]])]);
    usePenStore.getState().eraseAt(500, 500, 10);
    expect(usePenStore.getState().strokes).toHaveLength(1);
  });

  it("uses a circular hit test, not a bounding box", () => {
    // (7,7) is ~9.9 away from the origin: inside a 10x10 box, outside r=8.
    usePenStore.getState().setStrokes([stroke("a", [[7, 7]])]);
    usePenStore.getState().eraseAt(0, 0, 8);
    expect(usePenStore.getState().strokes).toHaveLength(1);
    usePenStore.getState().eraseAt(0, 0, 11);
    expect(usePenStore.getState().strokes).toHaveLength(0);
  });

  it("erases only the strokes it touches", () => {
    usePenStore.getState().setStrokes([stroke("near", [[0, 0]]), stroke("far", [[900, 900]])]);
    usePenStore.getState().eraseAt(1, 1, 5);
    expect(usePenStore.getState().strokes.map((s) => s.id)).toEqual(["far"]);
  });

  it("clearAll removes everything", () => {
    usePenStore.getState().setStrokes([stroke("a", [[0, 0]]), stroke("b", [[1, 1]])]);
    usePenStore.getState().clearAll();
    expect(usePenStore.getState().strokes).toHaveLength(0);
  });
});

describe("custom components", () => {
  beforeEach(() => useCustomComponentsStore.setState({ components: [] }));

  const base = {
    label: "My Widget",
    category: "compute" as const,
    icon: "Box",
    maxQPS: 1000,
    latencyMs: 5,
    scalable: true,
    stateful: false,
    description: "d",
  };

  it("derives a slug id from the label", () => {
    expect(useCustomComponentsStore.getState().addComponent(base)).toBe("custom-my-widget");
  });

  it("suffixes on collision instead of overwriting", () => {
    const a = useCustomComponentsStore.getState().addComponent(base);
    const b = useCustomComponentsStore.getState().addComponent(base);
    expect(b).not.toBe(a);
    expect(useCustomComponentsStore.getState().components).toHaveLength(2);
  });

  it("falls back to a usable id when the label has no alphanumerics", () => {
    const id = useCustomComponentsStore.getState().addComponent({ ...base, label: "!!!" });
    expect(id).toBe("custom-component");
  });

  it("finds, updates, and deletes by id", () => {
    const id = useCustomComponentsStore.getState().addComponent(base);
    useCustomComponentsStore.getState().updateComponent(id, { maxQPS: 9999 });
    expect(useCustomComponentsStore.getState().getComponent(id)?.maxQPS).toBe(9999);
    useCustomComponentsStore.getState().deleteComponent(id);
    expect(useCustomComponentsStore.getState().getComponent(id)).toBeUndefined();
  });
});

describe("tradeoff log", () => {
  beforeEach(() => useTradeoffStore.setState({ entries: [] }));

  it("stamps each entry with an id and timestamp", () => {
    useTradeoffStore.getState().addEntry({ decision: "Chose DynamoDB", rationale: "scale" } as never);
    const [e] = useTradeoffStore.getState().entries;
    expect(e.id).toBeTruthy();
    expect(e.timestamp).toBeTruthy();
  });

  it("removes a single entry and clears them all", () => {
    useTradeoffStore.getState().addEntry({ decision: "a", rationale: "x" } as never);
    useTradeoffStore.getState().addEntry({ decision: "b", rationale: "y" } as never);
    const id = useTradeoffStore.getState().entries[0].id;
    useTradeoffStore.getState().removeEntry(id);
    expect(useTradeoffStore.getState().entries).toHaveLength(1);
    useTradeoffStore.getState().clearEntries();
    expect(useTradeoffStore.getState().entries).toHaveLength(0);
  });
});

describe("safeLocalStorage", () => {
  // The whole point of this wrapper is that a persist write can never crash the
  // state update that triggered it.
  const original = globalThis.window;
  afterEach(() => {
    if (original === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = original;
  });

  it("returns null and stays silent when there is no window", () => {
    delete (globalThis as { window?: unknown }).window;
    expect(safeLocalStorage.getItem("k")).toBeNull();
    expect(() => safeLocalStorage.setItem("k", "v")).not.toThrow();
    expect(() => safeLocalStorage.removeItem("k")).not.toThrow();
  });

  it("swallows a QuotaExceededError rather than propagating it", () => {
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => { throw new Error("denied"); },
        setItem: () => { throw new Error("QuotaExceededError"); },
        removeItem: () => { throw new Error("denied"); },
      },
    };
    expect(() => safeLocalStorage.setItem("k", "v")).not.toThrow();
    expect(safeLocalStorage.getItem("k")).toBeNull();
    expect(() => safeLocalStorage.removeItem("k")).not.toThrow();
  });

  it("reads and writes normally when storage works", () => {
    const store = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
    safeLocalStorage.setItem("k", "v");
    expect(safeLocalStorage.getItem("k")).toBe("v");
    safeLocalStorage.removeItem("k");
    expect(safeLocalStorage.getItem("k")).toBeNull();
  });
});

describe("hydration", () => {
  // Every persisted store uses skipHydration:true so SSR and the first client
  // render agree. rehydrateAllStores() must therefore cover ALL of them —
  // a store omitted here silently never loads its persisted state.
  it("rehydrates every persisted store", async () => {
    const { rehydrateAllStores } = await import("@/store/hydration");
    await expect(rehydrateAllStores()).resolves.toBeUndefined();
  });

  it("covers each store that declares persistence", async () => {
    // A store that persists but is missing from rehydrateAllStores silently
    // never loads its saved state — invisible until a user reports "my work
    // disappeared". This derives the list from disk rather than restating it.
    const fs = await import("node:fs");
    const source = fs.readFileSync("src/store/hydration.ts", "utf8");
    const persisted = fs
      .readdirSync("src/store")
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "hydration.ts")
      .filter((f) => fs.readFileSync(`src/store/${f}`, "utf8").includes("skipHydration: true"))
      .map((f) => f.replace(/\.ts$/, ""));

    for (const name of persisted) {
      expect(source, `${name} is persisted but missing from rehydrateAllStores`).toContain(
        `./${name}`,
      );
    }
    expect(persisted.length).toBeGreaterThan(5);
  });
});
