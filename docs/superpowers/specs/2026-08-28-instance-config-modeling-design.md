# Instance and Config Modeling — Design

- **Date:** 2026-08-28
- **Status:** Approved, implementing
- **Scope:** Sub-project 3 of 7 in the AWS-centric rework of SystemForge
- **Depends on:** sub-project 1 (catalog + concept bridge), shipped
- **Feeds:** sub-project 6 (richer traffic simulation) and sub-project 4 (cost model)

## Context

Every node today exposes exactly one knob: a `replicas` slider from 1 to 20. `maxQPS` and `latencyMs` are fixed catalog constants, and effective capacity is `maxQPS × replicas`. Nothing distinguishes a `t3.micro` from a `c6g.8xlarge`, and nothing gives the cost model anything to price.

This sub-project makes capacity a function of configuration.

## Decisions

### Bespoke schema per service, not shared archetypes

Each service declares its own parameters. DynamoDB exposes capacity mode and provisioned units; EC2 exposes family, size, and count; S3 exposes storage class and volume. The rejected alternative grouped services into ~6 archetypes, which is less data but forces services into shapes that do not fit them.

The cost of per-service schemas is contained by making them **declarative**: a schema is data, rendered by one generic panel, so adding a service's configuration never means writing a component.

### Capacity derives from real vCPU and memory

Instance sizes carry their **published** vCPU and memory. Capacity is `vCPU × (QPS per vCPU) × count`.

The alternatives were per-size capacity tables (hundreds of invented numbers wearing a precise-looking mask) and base × multipliers (invented multipliers that compound unpredictably). Deriving from published specs concentrates the invention into **one estimated constant per service**, documented in one place, rather than smearing guesswork across hundreds of cells. It also stores exactly what sub-project 4 needs, since AWS prices by family, size, and hours.

**Stated limitation:** throughput is not linear in vCPU, and databases usually saturate on IO or connections before CPU. This is a teaching simplification, and the UI must present derived capacity as an estimate rather than a benchmark.

## Design

### 1. Instance families

```ts
export const INSTANCE_FAMILIES: Record<string, {
  label: string;                                            // "General Purpose (m5)"
  sizes: { size: string; vcpu: number; memoryGiB: number }[];
}>;
```

Covers t3, m5, m6g, c5, c6g, r5, r6g and the `db.*` equivalents used by RDS and Aurora. vCPU and memory are published AWS figures.

### 2. Per-service schema

```ts
export type ConfigParam =
  | { id: string; kind: "instance"; label: string; families: string[]; default: string }
  | { id: string; kind: "count";    label: string; default: number; min: number; max: number }
  | { id: string; kind: "choice";   label: string; options: { value: string; label: string; help?: string }[]; default: string }
  | { id: string; kind: "number";   label: string; unit: string; default: number; min: number; max: number }
  | { id: string; kind: "toggle";   label: string; default: boolean };

export const SERVICE_CONFIG: Record<string, {
  params: ConfigParam[];
  /** The one estimated number per service; `note` explains its basis. */
  throughput: { per: "vcpu" | "node" | "unit"; qps: number; note: string };
}>;
```

Services with nothing meaningful to configure — IAM, VPC, KMS, Cloud Map, pattern nodes — declare `params: []`. That is a valid answer, not a gap.

### 3. Where values live

`ComponentNodeData` gains `config?: Record<string, string | number | boolean>`.

**Instance count reuses the existing `replicas` field** rather than becoming a new parameter. Consequently `simulator.ts` keeps computing `maxQPS × replicas` unchanged, and designs saved before this change need no migration — absent `config` means "defaults".

### 4. Derivation

```ts
export function deriveCapacity(componentId, config): { maxQPS: number; latencyMs: number };
```

- instance-shaped services: `vCPU × throughput.qps`
- provisioned services (DynamoDB, Kinesis): units × per-unit rate
- passive services: the catalog constant, unmodified

**Anti-drift invariant:** `deriveCapacity(service, defaults)` must equal `service.maxQPS` for every service. The catalog number *is*, by definition, capacity at default configuration. A wrong throughput constant therefore fails the build rather than silently changing the behaviour of every existing design.

### 5. UI

One `ConfigPanel` maps `ConfigParam[]` to controls, replacing the lone Replicas slider in the node properties panel.

Derived capacity is shown with its arithmetic — *"4 vCPU × 1,250 QPS/vCPU × 3 instances = 15,000 QPS"* — and labelled an **estimate**, with the throughput constant's `note` available. Showing the arithmetic teaches; emitting a confident number pretends to be a benchmark.

Editing config recomputes and writes `maxQPS`/`latencyMs` into node data, which is what keeps `simulator.ts` and all five scoring rules untouched — they keep reading the snapshot fields they already read. A change also calls the existing `resetSimulation()`, since stale metrics would describe a machine that no longer exists.

Reference tabs (`readOnly`) gate config editing like every other mutation.

### 6. Two silent-breakage risks

1. **`SerializedComponentData` must carry `config`**, or configuration is lost on save/load — the same failure CLAUDE.md already records for `SerializedEdge.data`. Additive field; no store version bump.
2. **`upgradeNodeData` would clobber it.** That function overwrites `maxQPS` from the catalog, which is correct for a stale generic node and wrong for a node whose capacity came from custom config. It must recompute from `config` when present. This surfaces only as "my saved design forgot its instance sizes", so it gets an explicit test.

## Invariants preserved

- `simulator.ts` and everything under `src/scoring/` remain read-only.
- Each scoring category still totals exactly 20.
- Persisted stores keep `version: 1`, no-op `migrate`, `skipHydration: true`.
- `SerializedEdge` unchanged; `SerializedComponentData` gains one optional field.
- `nodeTypes` / `edgeTypes` stay module-level.
- Both light and dark themes verified.

## Verification

**Build checks (`check-catalog`):**

- every catalog service has a `SERVICE_CONFIG` entry (`params: []` allowed);
- every param default sits within its own min/max or options; param ids unique per service;
- every referenced instance family exists in `INSTANCE_FAMILIES`;
- `deriveCapacity(service, defaults) === service.maxQPS` for all services.

**Behavioural tests**, as a script:

- changing EC2 from `m5.large` to `m5.4xlarge` scales capacity by the vCPU ratio;
- count of 3 triples capacity;
- a passive service's capacity is unaffected by any config;
- `upgradeNodeData` preserves a configured node's derived capacity.

**Manual:** the panel renders for a spread of services; capacity updates live; a simulation after a change reflects it; **save then reload preserves config**; a pre-config design still loads; reference tabs remain read-only; both themes.

Every check is observed failing before being trusted — that practice has caught four real bugs in this rework so far.

## Documentation to update

- `CLAUDE.md`: the config model, the vCPU derivation and its stated limitation, the anti-drift invariant, and that `config` must survive serialization and `upgradeNodeData`.
