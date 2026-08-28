# Two-Channel Traffic Simulation — Design

- **Date:** 2026-08-29
- **Status:** Approved, implementing
- **Scope:** Sub-project 6 of 7 in the AWS-centric rework of SystemForge
- **Depends on:** sub-project 3 (config modeling), shipped — this is the first consumer of its schemas
- **First sub-project to modify `src/engine/simulator.ts`**, which has been read-only until now

## Context

`runSimulation` currently pushes a single undifferentiated QPS number through a topological pass. It is a careful piece of code: Kahn's algorithm, cycle detection by peeling zero-out-degree nodes within the unresolved subgraph, async edges excluded from user-facing latency, saturation treated as a black hole rather than "healthy", throughput capped at offered load.

All of that must survive.

Meanwhile `problems.ts` declares `readsPerSec` and `writesPerSec` for all 35 problems, and the simulator has never read either. The single most common interview mistake — "we'll put Redis in front" with no reasoning about what fraction of reads it absorbs or what the database still sees — is invisible in the current model.

## Decisions

### Steady-state now, time-stepped later

The simulation stays a single-pass snapshot. Time-stepping — queue backlog accumulating and draining, autoscaling reacting to sustained load, bursts absorbed then worked off — is deferred to its own future sub-project.

Rationale: the highest-value lesson (cache hit ratio and its effect on downstream capacity) is fully expressible in one pass, whereas time-stepping is an engine rewrite plus a timeline UI, and every existing invariant would have to be re-established per tick. The current engine handles cycles and disconnected subgraphs correctly; re-deriving that per tick is exactly where subtle regressions hide.

This limitation is documented in the README rather than left for a user to discover.

### Two channels, not one number or arbitrary classes

Traffic flows as `{ reads, writes }`.

A single number with per-node absorption factors was rejected because a cache would "absorb" writes, teaching something false. Arbitrary request classes were rejected as unused generality — nothing in the product needs more than reads and writes, and every node would need a policy per class.

Two channels also connect the problems' existing `readsPerSec`/`writesPerSec` to the simulation for the first time, making the read-heavy vs write-heavy distinction — which decides whether caching or sharding is the answer — visible on the canvas.

### Retry amplification is out of scope

A retry storm is a feedback loop: load causes failures, failures cause retries, retries cause load. That is inherently temporal. Modelling it in steady state collapses it to a fixed multiplier that teaches the arithmetic without the lesson. It belongs with time-stepping.

## Design

### 1. Traffic model

Everywhere the engine moves a `number`, it moves `{ reads: number; writes: number }`.

Capacity remains a single number — a node's ceiling does not care which kind of request it is — so utilization is `(reads + writes) / capacity`, unchanged in spirit. Throughput still never exceeds offered load.

### 2. Node behaviours

| Node | Behaviour |
|---|---|
| Cache (ElastiCache, CloudFront) | Absorbs `reads x hitRate`. Passes remaining reads and **all writes** downstream. |
| Database with read replicas | Reads divided across `replicas + 1`; writes only ever reach the primary. |
| Everything else | Passes both channels through unchanged. |

Hit rate and replica count come from the `serviceConfig` schemas built in sub-project 3. This is the first consumer of that data, which is what the build order was for.

### 3. New config params

None affect capacity, so the anti-drift invariant (`deriveCapacity(service, defaults) === service.maxQPS`) is untouched.

- `elasticache` — cache hit rate, default 85%
- `cloudfront` — cache hit rate, default 90%
- `rds`, `documentdb`, `neptune` — read replicas (Aurora already has one)

Each carries help text explaining the lever, because the ratio between hit rate and surviving database load is usually the difference between one instance and ten.

### 4. Latency gains a tail

`NodeMetrics` reports `latencyP50` and `latencyP99`. p99 derives from utilization using the existing spike curve, sharpened: queueing delay is where tail latency comes from, and "what is your p99?" is a question every interviewer asks.

### 5. Controls and readouts

The Simulate panel keeps its total-QPS slider and gains a **read/write ratio**, seeded from the selected problem's `readsPerSec`/`writesPerSec` and labelled as coming from the brief, so the control is tied to the requirements rather than free-floating.

Metrics show incoming reads vs writes per node, plus p50 and p99. The most instructive readout is on a cache: *"absorbs 42,500 reads/s; 7,500 reads/s and all 5,000 writes/s continue to DynamoDB."*

## Invariants preserved

- Entry nodes: in-degree 0 **with** outgoing edges; disconnected nodes receive no traffic.
- Kahn ordering, and the cycle/downstream-of-cycle peeling pass.
- Edges whose endpoints are not component nodes are skipped; parallel edges deduped.
- Async edges carry QPS but are excluded from user-facing latency.
- `maxQPS` and `replicas` sanitized before use; capacity is `maxQPS x replicas`.
- Reported throughput never exceeds offered load.
- Scoring untouched; each category still totals exactly 20.
- Persisted stores keep `version: 1`.

## Verification

**The regression net comes first.** Before modifying `simulator.ts`, snapshot the full simulation output for all 35 reference solutions at a fixed QPS. After the change, re-run and diff. With reads + writes summing to today's single QPS and hit rates forced to zero, results must be **identical**; only then is the new behaviour enabled deliberately. This converts "did I break the topology handling?" from a hope into a diff.

**Behavioural tests:**

- a cache at 85% hit rate cuts downstream reads by 85% and leaves writes untouched;
- a cache at 0% hit rate is a pass-through;
- read replicas divide reads and never divide writes;
- p99 >= p50 always, and both rise with utilization;
- entry detection, cycles, and disconnected nodes unchanged (covered by the snapshot diff).

**Manual:** the ratio control moves the numbers; the cache readout reads correctly; both themes.

## Documentation to update

- **`README.md`** — how the simulation works (steady-state single pass, two-channel traffic, what each node type does to traffic), and a plain statement that time-stepped simulation with queue backlog, autoscaling response, and retry storms is a planned follow-up. Declare the model's limits rather than letting users discover them.
- `CLAUDE.md` — the two-channel invariant and the cache/replica routing rules.
