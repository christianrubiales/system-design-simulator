"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useSimulationStore } from "@/store/simulationStore";
import { useCanvasStore } from "@/store/canvasStore";
import { SCENARIOS, type ScenarioId, type TickSnapshot } from "@/engine/ticks";

const ORDER: ScenarioId[] = ["steady", "spike", "ramp", "outage"];

/**
 * Load profile, feedback toggles, and a timeline scrubber over the ticked run.
 *
 * Scrubbing writes the selected tick's metrics back into node data, so the
 * canvas animates through the incident using the rendering path it already has.
 */
export function ScenarioControls() {
  const config = useSimulationStore((s) => s.config);
  const setConfig = useSimulationStore((s) => s.setConfig);
  const result = useSimulationStore((s) => s.result);
  const updateAllNodeData = useCanvasStore((s) => s.updateAllNodeData);
  const [tick, setTick] = useState<number | null>(null);

  const series = (result as { series?: TickSnapshot[] } | null)?.series;
  const retryStorm = (result as { retryStorm?: boolean } | null)?.retryStorm === true;

  function scrubTo(t: number) {
    setTick(t);
    const snap = series?.[t];
    if (!snap) return;
    const updates = new Map<string, Record<string, unknown>>();
    for (const [nodeId, m] of snap.nodeMetrics) {
      updates.set(nodeId, {
        utilization: m.utilization,
        status: m.status,
        isBottleneck: m.isBottleneck,
      });
    }
    updateAllNodeData(updates);
  }

  const current = tick !== null && series ? series[tick] : series?.[series.length - 1];
  const peakOffered = series ? Math.max(...series.map((s) => s.offeredQPS)) : 0;
  const peakBacklog = series ? Math.max(...series.map((s) => s.backlogTotal)) : 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs text-zinc-400">Load profile</p>
        <div className="flex flex-wrap gap-1">
          {ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setConfig({ scenario: id })}
              className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                config.scenario === id
                  ? "border-cyan-500/30 bg-cyan-600/20 text-cyan-400"
                  : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {SCENARIOS[id].label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          {SCENARIOS[config.scenario].description}
        </p>
        {config.scenario !== "steady" && (
          <p className="mt-1 text-[11px] text-amber-500/80">
            Scoring always uses Steady, so results stay comparable between designs.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setConfig({ autoscaling: !config.autoscaling })}
          aria-pressed={config.autoscaling}
          className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
            config.autoscaling
              ? "border-cyan-500/30 bg-cyan-600/20 text-cyan-400"
              : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
        >
          Autoscaling
        </button>
        <button
          type="button"
          onClick={() => setConfig({ retryRate: config.retryRate > 0 ? 0 : 0.5 })}
          aria-pressed={config.retryRate > 0}
          className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
            config.retryRate > 0
              ? "border-cyan-500/30 bg-cyan-600/20 text-cyan-400"
              : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
        >
          Client retries
        </button>
      </div>

      {retryStorm && (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-[11px] text-rose-200/90">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          <span className="font-medium text-rose-300">Retry storm.</span> Clients retrying into
          a saturated service more than doubled the offered load. This is how a partial outage
          becomes a total one — the fixes are exponential backoff, jitter, and a circuit breaker.
        </p>
      )}

      {series && series.length > 0 && current && (
        <div className="rounded-md border border-zinc-700 bg-zinc-800/50 px-2.5 py-2">
          <Sparkline series={series} active={tick ?? series.length - 1} />
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3 bg-zinc-500" /> Offered
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3 bg-cyan-400" /> Delivered
            </span>
            {peakBacklog > 0 && (
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 bg-amber-400" /> Queue backlog
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">t = {current.t}s</span>
            <span className="font-mono tabular-nums text-zinc-400">
              {Math.round(current.deliveredQPS).toLocaleString()} /{" "}
              {Math.round(current.offeredQPS).toLocaleString()} QPS
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={series.length - 1}
            value={tick ?? series.length - 1}
            onChange={(e) => scrubTo(Number(e.target.value))}
            aria-label="Timeline"
            className="mt-1 w-full accent-cyan-500"
          />
          {peakBacklog > 0 && (
            <p className="mt-1 text-[11px] text-zinc-500">
              Peak queue backlog {Math.round(peakBacklog).toLocaleString()} requests
              {current.backlogTotal < peakBacklog * 0.1 && " — fully drained by the end"}
            </p>
          )}
          {peakOffered > 0 && (
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Peak offered load {Math.round(peakOffered).toLocaleString()} QPS
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Offered (grey) vs delivered (cyan) load, with the scrubbed tick marked. */
function Sparkline({ series, active }: Readonly<{ series: TickSnapshot[]; active: number }>) {
  const w = 240;
  const h = 44;
  const max = Math.max(1, ...series.map((s) => s.offeredQPS));
  const maxBacklog = Math.max(0, ...series.map((s) => s.backlogTotal));
  const path = (pick: (s: TickSnapshot) => number) =>
    series
      .map((s, i) => {
        const x = (i / Math.max(1, series.length - 1)) * w;
        const y = h - (pick(s) / max) * h;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" role="img" aria-label="Load over time">
      <path d={path((s) => s.offeredQPS)} fill="none" stroke="rgb(113 113 122)" strokeWidth="1.5" />
      <path d={path((s) => s.deliveredQPS)} fill="none" stroke="rgb(34 211 238)" strokeWidth="1.5" />
      {/* Backlog is a count of queued requests, not a rate — it shares no unit
          with the two QPS lines, so it gets its own scale. Showing its SHAPE
          (build during the burst, drain afterwards) is the point. */}
      {maxBacklog > 0 && (
        <path
          d={series
            .map((s, i) => {
              const x = (i / Math.max(1, series.length - 1)) * w;
              const y = h - (s.backlogTotal / maxBacklog) * h;
              return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ")}
          fill="none"
          stroke="rgb(251 191 36)"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
      )}
      <line
        x1={(active / Math.max(1, series.length - 1)) * w}
        x2={(active / Math.max(1, series.length - 1)) * w}
        y1={0}
        y2={h}
        stroke="rgb(161 161 170)"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
    </svg>
  );
}
