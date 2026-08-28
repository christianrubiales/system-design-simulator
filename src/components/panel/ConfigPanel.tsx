"use client";

import { Slider } from "@/components/ui/slider";
import { useCanvasStore, type ComponentNodeData } from "@/store/canvasStore";
import {
  SERVICE_CONFIG,
  defaultConfig,
  deriveCapacity,
  type ConfigParam,
} from "@/data/serviceConfig";
import { INSTANCE_FAMILIES } from "@/data/instanceFamilies";
import { resolveComponentId } from "@/data/conceptMap";

/**
 * Renders a service's configuration schema. The schema is data, so adding a
 * service's configuration never means writing a component.
 *
 * Editing writes `config` AND the recomputed `maxQPS`/`latencyMs` into node
 * data — that is what keeps simulator.ts and the scoring rules untouched, since
 * they keep reading the snapshot fields they already read.
 */
export function ConfigPanel({
  nodeId,
  data,
  readOnly,
}: Readonly<{ nodeId: string; data: ComponentNodeData; readOnly: boolean }>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const resolved = resolveComponentId(data.componentId);
  const spec = SERVICE_CONFIG[resolved];

  const config = { ...defaultConfig(resolved), ...(data.config ?? {}) };
  const derived = deriveCapacity(resolved, config);
  const replicas = data.replicas ?? 1;

  function setParam(id: string, value: string | number | boolean) {
    if (readOnly) return;
    const next = { ...config, [id]: value };
    const capacity = deriveCapacity(resolved, next);
    updateNodeData(nodeId, {
      config: next,
      maxQPS: capacity.maxQPS,
      latencyMs: capacity.latencyMs,
    });
  }

  return (
    <div className="space-y-3">
      {spec?.params.map((p) => (
        <ParamControl
          key={p.id}
          param={p}
          value={config[p.id]}
          readOnly={readOnly}
          onChange={(v) => setParam(p.id, v)}
        />
      ))}

      {/* Instance count stays `replicas` so the simulator's maxQPS x replicas is unchanged. */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs text-zinc-400">Instances</label>
          <span className="font-mono text-xs text-cyan-500">{replicas}</span>
        </div>
        <Slider
          aria-label="Instances"
          value={[replicas]}
          onValueChange={(v) =>
            !readOnly && updateNodeData(nodeId, { replicas: Array.isArray(v) ? v[0] : v })
          }
          min={1}
          max={20}
          step={1}
        />
      </div>

      {/* Show the arithmetic: a simulator that hides its working pretends to be a benchmark. */}
      <div className="rounded-md border border-zinc-700 bg-zinc-800/50 px-2.5 py-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-zinc-400">Effective capacity</span>
          <span className="font-mono text-xs text-cyan-400">
            {(derived.maxQPS * replicas).toLocaleString()} QPS
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          {derived.explanation}
          {replicas > 1 && ` x ${replicas} instances`}
        </p>
        {spec && (
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            <span className="text-amber-500/80">Estimate.</span> {spec.throughput.note}
          </p>
        )}
      </div>
    </div>
  );
}

function ParamControl({
  param,
  value,
  readOnly,
  onChange,
}: Readonly<{
  param: ConfigParam;
  value: string | number | boolean | undefined;
  readOnly: boolean;
  onChange: (v: string | number | boolean) => void;
}>) {
  const label = (
    <label className="mb-1 block text-xs text-zinc-400">{param.label}</label>
  );

  if (param.kind === "instance") {
    const current = String(value ?? param.default);
    return (
      <div>
        {label}
        <select
          value={current}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
        >
          {param.families.map((famKey) => {
            const fam = INSTANCE_FAMILIES[famKey];
            if (!fam) return null;
            return (
              <optgroup key={famKey} label={fam.label}>
                {fam.sizes.map((s) => (
                  <option key={s.size} value={s.size}>
                    {s.size} — {s.vcpu} vCPU, {s.memoryGiB} GiB
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {param.help && <p className="mt-1 text-[11px] text-zinc-500">{param.help}</p>}
      </div>
    );
  }

  if (param.kind === "choice") {
    const current = String(value ?? param.default);
    const chosen = param.options.find((o) => o.value === current);
    return (
      <div>
        {label}
        <div className="flex flex-wrap gap-1">
          {param.options.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(o.value)}
              className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                current === o.value
                  ? "border-cyan-500/30 bg-cyan-600/20 text-cyan-400"
                  : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {(chosen?.help ?? param.help) && (
          <p className="mt-1 text-[11px] text-zinc-500">{chosen?.help ?? param.help}</p>
        )}
      </div>
    );
  }

  if (param.kind === "number") {
    const current = Number(value ?? param.default);
    return (
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-zinc-400">{param.label}</span>
          <span className="font-mono text-xs text-cyan-500">
            {current.toLocaleString()} {param.unit}
          </span>
        </div>
        <input
          type="number"
          value={current}
          min={param.min}
          max={param.max}
          disabled={readOnly}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(param.max, Math.max(param.min, n)));
          }}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
        />
        {param.help && <p className="mt-1 text-[11px] text-zinc-500">{param.help}</p>}
      </div>
    );
  }

  const current = Boolean(value ?? param.default);
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">{param.label}</span>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onChange(!current)}
          aria-pressed={current}
          className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
            current
              ? "border-cyan-500/30 bg-cyan-600/20 text-cyan-400"
              : "border-zinc-700 bg-zinc-800 text-zinc-400"
          }`}
        >
          {current ? "Enabled" : "Disabled"}
        </button>
      </div>
      {param.help && <p className="mt-1 text-[11px] text-zinc-500">{param.help}</p>}
    </div>
  );
}
