"use client";

import { useMemo } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { useCanvasStore, type ComponentNodeData } from "@/store/canvasStore";
import { useSimulationStore } from "@/store/simulationStore";
import { useAppStore } from "@/store/appStore";
import { estimateCost, type CostDimension } from "@/lib/cost";
import { PRICING_VERSION, PRICING_FETCHED } from "@/data/pricing";
import { AWS_REGIONS } from "@/data/regionAvailability";
import type { Node } from "@xyflow/react";

const DIMENSION_LABEL: Record<CostDimension, string> = {
  instances: "Instances",
  provisioned: "Provisioned",
  storage: "Storage",
  requests: "Requests",
  transfer: "Data transfer",
};

const usd = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString()}` : `$${n.toFixed(2)}`;

export function CostReport() {
  const nodes = useCanvasStore((s) => s.nodes);
  const result = useSimulationStore((s) => s.result);
  const region = useAppStore((s) => s.region);

  const componentNodes = useMemo(
    () => nodes.filter((n) => n.type !== "text") as Node<ComponentNodeData>[],
    [nodes],
  );
  const cost = useMemo(
    () => estimateCost(componentNodes, result?.nodeMetrics ?? null, region),
    [componentNodes, result, region],
  );

  if (componentNodes.length === 0) {
    return <p className="text-xs text-zinc-500">Add components to estimate a monthly bill.</p>;
  }

  const regionLabel = AWS_REGIONS.find((r) => r.code === region)?.label ?? region;
  const largest = cost.lines[0];
  // When one assumption-driven line dominates, say so — a bill whose biggest
  // number comes from a guess is worse than one that admits it.
  const transferDominates =
    largest?.dimension === "transfer" && largest.monthly > cost.monthlyTotal * 0.5;

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-3">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">Estimated monthly</p>
        <p className="mt-0.5 font-mono text-2xl tabular-nums text-cyan-400">
          {usd(cost.monthlyTotal)}
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">
          {regionLabel}
          {cost.regionMultiplier !== 1 && ` · ${cost.regionMultiplier}x us-east-1 pricing`}
        </p>
      </div>

      {cost.needsSimulation && (
        <p className="rounded-md border border-zinc-700 bg-zinc-800/40 px-2.5 py-2 text-[11px] text-zinc-400">
          <Info className="mr-1 inline h-3 w-3" />
          Showing instances and storage only. Run a simulation to price requests and data
          transfer.
        </p>
      )}

      {transferDominates && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200/90">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          Data transfer is over half this bill, and it is driven entirely by the{" "}
          <span className="font-medium">average response size</span> you set on{" "}
          {largest.label}. Set it to your real payload — the default is a placeholder, not a
          measurement.
        </p>
      )}

      <div className="space-y-1">
        {cost.lines.map((l, i) => (
          <div
            key={`${l.nodeId}-${l.dimension}`}
            className="rounded-md border border-zinc-800 bg-zinc-800/30 px-2.5 py-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs text-zinc-200">
                {l.label}
                {i === 0 && (
                  <span className="ml-1.5 rounded bg-cyan-500/15 px-1 text-[10px] font-medium uppercase tracking-wider text-cyan-400">
                    largest
                  </span>
                )}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-200">
                {usd(l.monthly)}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {DIMENSION_LABEL[l.dimension]} · {l.detail}
            </p>
          </div>
        ))}
      </div>

      {cost.unpriced.length > 0 && (
        <p className="text-[11px] text-zinc-500">
          Not priced: {cost.unpriced.join(", ")}. These are excluded from the total rather
          than guessed at.
        </p>
      )}

      <div className="space-y-1 border-t border-zinc-800 pt-2 text-[11px] text-zinc-500">
        <p>
          <span className="text-zinc-400">On-demand pricing only.</span> Reserved Instances
          and Savings Plans typically cut real bills by 30–70%.
        </p>
        <p>Free tier is not applied. 730 hours per month.</p>
        <p>
          AWS Price List offer {PRICING_VERSION.slice(0, 8)}, fetched {PRICING_FETCHED}.
          Regional pricing is scaled by a single multiplier sampled on one instance class.
        </p>
      </div>
    </div>
  );
}
