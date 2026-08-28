"use client";

import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Play, Loader2 } from "lucide-react";
import { useSimulationStore } from "@/store/simulationStore";
import { useAppStore } from "@/store/appStore";
import { getProblemById } from "@/data/problems";

const PRESETS = [
  { label: "Light", value: 1000 },
  { label: "Medium", value: 10000 },
  { label: "Heavy", value: 100000 },
  { label: "Stress", value: 500000 },
];

interface SimulationControlsProps {
  onSimulate: () => void;
}

export function SimulationControls({ onSimulate }: SimulationControlsProps) {
  const config = useSimulationStore((s) => s.config);
  const setConfig = useSimulationStore((s) => s.setConfig);
  const selectedProblemId = useAppStore((s) => s.selectedProblemId);
  const problem = getProblemById(selectedProblemId);
  // The problem's own requirements define the expected mix.
  const problemRatio = (() => {
    if (!problem) return null;
    const { readsPerSec, writesPerSec } = problem.requirements;
    const sum = readsPerSec + writesPerSec;
    return sum > 0 ? Math.round((readsPerSec / sum) * 100) : null;
  })();
  const isRunning = useSimulationStore((s) => s.isRunning);

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Simulation Config
      </p>

      {/* Presets */}
      <div className="flex gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => setConfig({ requestsPerSec: preset.value })}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              config.requestsPerSec === preset.value
                ? "bg-cyan-500/15 text-cyan-500"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs text-zinc-400">Requests/sec</label>
            <span className="font-mono text-xs text-cyan-500">
              {new Intl.NumberFormat("en-US").format(config.requestsPerSec)}
            </span>
          </div>
          <Slider
            value={[config.requestsPerSec]}
            onValueChange={(v) => setConfig({ requestsPerSec: Array.isArray(v) ? v[0] : v })}
            min={100}
            max={500000}
            step={100}
            className=""
          />
        </div>

        {/* Read/write mix — seeded from the selected problem's stated
            readsPerSec / writesPerSec, so the control is tied to the brief
            rather than being a free-floating knob. Caches serve reads only, so
            this ratio decides how much load ever reaches the database. */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs text-zinc-400">Read / write mix</label>
            <span className="font-mono text-xs text-cyan-500">
              {Math.round(config.readRatio * 100)}% reads
            </span>
          </div>
          <Slider
            aria-label="Read ratio"
            value={[Math.round(config.readRatio * 100)]}
            onValueChange={(v) =>
              setConfig({ readRatio: (Array.isArray(v) ? v[0] : v) / 100 })
            }
            min={0}
            max={100}
            step={1}
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            {problemRatio !== null ? (
              <>
                This problem states {problemRatio}% reads.{" "}
                {Math.abs(Math.round(config.readRatio * 100) - problemRatio) > 1 && (
                  <button
                    type="button"
                    onClick={() => setConfig({ readRatio: problemRatio / 100 })}
                    className="text-cyan-400 underline-offset-2 hover:underline"
                  >
                    Reset
                  </button>
                )}
              </>
            ) : (
              "Reads can be served by a cache; writes always reach the database."
            )}
          </p>
        </div>

        {/* Duration slider removed: the simulation engine performs a single-snapshot
            calculation (not a time-series simulation), so durationSec has no effect. */}
      </div>

      <Separator className="bg-zinc-800" />

      <Button
        onClick={onSimulate}
        disabled={isRunning}
        className="w-full gap-2 bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50"
        size="sm"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Simulating...
          </>
        ) : (
          <>
            <Play className="h-3 w-3" />
            Run Simulation
          </>
        )}
      </Button>
    </div>
  );
}
