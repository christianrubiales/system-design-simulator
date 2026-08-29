import { create } from "zustand";
import type { SimulationResult, SimulationConfig } from "@/types/simulation";
import type { ScoreResult } from "@/types/scoring";

interface SimulationState {
  isRunning: boolean;
  config: SimulationConfig;
  result: SimulationResult | null;
  scoreResult: ScoreResult | null;
  showScore: boolean;

  setRunning: (running: boolean) => void;
  setConfig: (config: Partial<SimulationConfig>) => void;
  setResult: (result: SimulationResult | null) => void;
  setScoreResult: (result: ScoreResult | null) => void;
  setShowScore: (show: boolean) => void;
  reset: () => void;
}

const defaultConfig: SimulationConfig = {
  requestsPerSec: 10000,
  durationSec: 10,
  rampUp: true,
  scenario: "steady",
  autoscaling: false,
  retryRate: 0,
  // Read-heavy by default; overridden from the selected problem's
  // readsPerSec / writesPerSec when one is chosen.
  readRatio: 0.9,
};

export const useSimulationStore = create<SimulationState>((set) => ({
  isRunning: false,
  config: defaultConfig,
  result: null,
  scoreResult: null,
  showScore: false,

  setRunning: (running) => set({ isRunning: running }),
  setConfig: (config) =>
    set((s) => ({ config: { ...s.config, ...config } })),
  setResult: (result) => set({ result }),
  setScoreResult: (result) => set({ scoreResult: result }),
  setShowScore: (show) => set({ showScore: show }),
  reset: () =>
    set({
      isRunning: false,
      config: defaultConfig,
      result: null,
      scoreResult: null,
      showScore: false,
    }),
}));
