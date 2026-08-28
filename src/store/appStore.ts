import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeLocalStorage } from "./safeStorage";

export type ToastType = "success" | "error" | "info";
export type Theme = "dark" | "light";

interface ToastData {
  message: string;
  type: ToastType;
}

/** Apply the theme by toggling the `dark` class on <html> (Tailwind dark variant). */
export function applyThemeClass(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

interface AppState {
  selectedProblemId: string;
  theme: Theme;
  leftSidebarOpen: boolean;
  rightPanelOpen: boolean;
  /** Show per-node runtime detail (qps, utilization bar, health dot) on canvas nodes. */
  nodeDetailsVisible: boolean;
  activeLeftTab: "components" | "problems" | "learn";
  activeRightTab: "properties" | "simulation" | "score" | "capacity" | "tradeoffs";
  toast: ToastData | null;
  /**
   * Deployment region, used only for availability warnings in the palette and
   * on nodes. Deliberately does NOT affect simulation, scoring, or cost.
   */
  region: string;

  setSelectedProblem: (id: string) => void;
  setRegion: (region: string) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleLeftSidebar: () => void;
  toggleRightPanel: () => void;
  toggleNodeDetails: () => void;
  setNodeDetailsVisible: (visible: boolean) => void;
  setLeftSidebarOpen: (open: boolean) => void;
  setActiveLeftTab: (tab: AppState["activeLeftTab"]) => void;
  setActiveRightTab: (tab: AppState["activeRightTab"]) => void;
  showToast: (message: string, type: ToastType) => void;
  clearToast: () => void;
}

// Single owner of the toast auto-dismiss timer (4s). showToast resets it,
// clearToast cancels it — no other code should schedule toast dismissal.
let toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedProblemId: "url-shortener",
      theme: "dark",
      leftSidebarOpen: false,
      rightPanelOpen: true,
      nodeDetailsVisible: false,
      activeLeftTab: "components",
      activeRightTab: "properties",
      toast: null,
      region: "us-east-1",

      setSelectedProblem: (id) => set({ selectedProblemId: id }),
      setRegion: (region) => set({ region }),
      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },
      toggleTheme: () =>
        set((s) => {
          const theme: Theme = s.theme === "dark" ? "light" : "dark";
          applyThemeClass(theme);
          return { theme };
        }),
      toggleLeftSidebar: () =>
        set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
      toggleRightPanel: () =>
        set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
      toggleNodeDetails: () =>
        set((s) => ({ nodeDetailsVisible: !s.nodeDetailsVisible })),
      setNodeDetailsVisible: (visible) => set({ nodeDetailsVisible: visible }),
      setLeftSidebarOpen: (open) => set({ leftSidebarOpen: open }),
      setActiveLeftTab: (tab) => set({ activeLeftTab: tab }),
      setActiveRightTab: (tab) => set({ activeRightTab: tab }),
      showToast: (message, type) => {
        if (toastTimeoutId !== null) {
          clearTimeout(toastTimeoutId);
        }
        set({ toast: { message, type } });
        toastTimeoutId = setTimeout(() => {
          set({ toast: null });
          toastTimeoutId = null;
        }, 4000);
      },
      clearToast: () => {
        if (toastTimeoutId !== null) {
          clearTimeout(toastTimeoutId);
          toastTimeoutId = null;
        }
        set({ toast: null });
      },
    }),
    {
      name: "systemsim-app",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        selectedProblemId: state.selectedProblemId,
        theme: state.theme,
        nodeDetailsVisible: state.nodeDetailsVisible,
        region: state.region,
      }),
      // Apply the persisted theme to <html> as soon as the store rehydrates.
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyThemeClass(state.theme);
      },
    }
  )
);
