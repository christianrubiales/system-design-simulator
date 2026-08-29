# Time-Stepped Simulation — Design

- **Date:** 2026-08-29
- **Status:** Approved, implementing
- **Scope:** Follow-up sub-project, deferred out of sub-project 6 by design
- **Depends on:** sub-project 6 (two-channel steady-state simulation), which becomes this one's correctness oracle

## Context

`runSimulation` computes a steady-state snapshot: one pass, no clock. It answers "at this sustained load, where does this design break?" — but it cannot show a queue absorbing a burst and working it off, autoscaling arriving too late, or a retry storm compounding, because none of those exist without time.

Sub-project 6 deliberately deferred these, and the README already documents them as planned. This builds them.

## Decisions

### Replace the snapshot, with the snapshot as oracle

One engine, not two. A second parallel engine would drift from the first, and users would have no principled answer to "which one is right?".

The rewrite is de-risked by assertion rather than by hope: **under constant load, run to convergence, the time-stepped engine must reproduce the snapshot's answer for all 35 reference solutions.** Queues drain, autoscaling settles, and the resulting steady state is by definition what the snapshot computes.

This is the same instrument that caught the ALB splitting bug in sub-project 6, pointed at a harder target. If convergence does not match, that is a bug in the tick model — not a tolerance to loosen.

### All three dynamics, including retries

Queue backlog, autoscaling response, and retry amplification.

Retries were deferred once already, on the grounds that they belong here; deferring them twice would be avoiding the hard part. They are the riskiest to model because they form a positive feedback loop, but **divergence is the lesson**: a simulator showing offered load climb from 100k to 400k because a saturated service is being retried into teaches exactly what causes real outages, and motivates backoff and circuit breakers — both already concepts in the catalog. The engineering answer is a hard cap plus a "retry storm" verdict, not pretending the loop is absent.

## Design

### 1. Tick model

A tick is **one second** — QPS is already per-second, so no scaling factor can be got wrong. Default run: **120 ticks**.

Per-node state the snapshot does not carry: `backlog` (queues only), `scaledReplicas` (autoscaling), and a utilization EMA to damp scaling decisions.

### 2. Ordering within a tick

Decided explicitly rather than emerging from code order, because this is where simulators of this kind go wrong:

1. **Arrivals** — scenario load at time *t*, plus retries carried from tick *t-1*
2. **Propagate and serve**, using the capacity tick *t* began with
3. **Queues absorb** what their consumer could not take, into `backlog`; non-queues **shed**
4. **Record metrics** for the tick
5. **Autoscaling** adjusts capacity, applied to tick *t+1*
6. **Shed requests become retries**, applied to tick *t+1*

Both feedback paths act with a **one-tick lag**. This is not a simplification to apologise for: it is the physical truth, it is *why* autoscaling cannot rescue a sudden spike, and it removes any within-tick circularity.

### 3. Queues

A queue's consumer pulls `min(capacity, backlog + arrivals)` per tick; the remainder accumulates. Backlog is what makes a queue structurally different from a node that merely has capacity — with it, SQS in front of a slow consumer visibly protects the upstream, which the snapshot could never show.

### 4. Retries, bounded

Shed requests retry at a configurable rate. Compounding is capped, and when offered load exceeds a multiple of baseline the run sets `retryStorm` and amplification stops. An unbounded loop is a hang, not a lesson.

### 5. Scenarios

`steady` (the convergence oracle), `spike`, `ramp`, `consumer outage`.

### 6. Result contract

`SimulationResult` keeps every existing field, now describing the **final tick**, and gains `series`, `scenario`, and `retryStorm`. All existing consumers — metrics panel, cost report, scoring — keep working untouched.

```ts
export interface TickSnapshot {
  t: number;
  offeredQPS: number;   // includes retries
  deliveredQPS: number;
  backlogTotal: number;
  nodeMetrics: Map<string, NodeMetrics>;
}
```

### 7. Scoring always uses `steady`

Scoring is graded, so it must be comparable between designs and across sessions. Scoring whatever tick a user scrubbed to, or the recovery tail of a spike, would make the number meaningless. Spike, ramp, and outage are exploration; steady is the assessment.

### 8. UI

Scenario selector and timeline scrubber in the Simulate panel, with a chart of offered vs delivered load and total backlog. Scrubbing writes that tick's metrics into node data via the existing `updateAllNodeData` path, so the canvas animates through the incident without new canvas code.

## Invariants preserved

- Entry detection, Kahn ordering, cycle peeling, and disconnected-node handling — per tick.
- Delivered never exceeds offered, per tick.
- Async edges excluded from user-facing latency.
- Two-channel `{ reads, writes }` traffic; caches serve reads only.
- Scoring categories still total exactly 20.
- Persisted stores stay at `version: 1`.

## Verification

**Convergence oracle, built before any UI.** Under `steady`, all 35 reference solutions must converge to the snapshot's answer within tolerance. If this fails, the tick model is wrong and nothing built on top is worth having.

**One test per mechanism, each observed failing before being trusted:**

- **Queue** — a spike into a queue with a slow consumer: backlog rises, drains to zero, upstream never sheds. The same spike without a queue does shed. That contrast is the feature.
- **Autoscaling** — sustained load raises capacity after a lag; a short spike is *not* rescued. If scaling absorbs a sudden spike, the lag is wrong.
- **Retries** — a saturated service with retries shows offered load climbing, the cap engaging, and `retryStorm` set; with retries off, offered load stays flat.
- **Per-tick invariants** — delivered <= offered, backlog never negative, disconnected nodes receive nothing, cycles terminate.

**Performance:** 120 ticks x 35 solutions is roughly 4,200 traversals inside `check-catalog`, which runs on every build. Measure first; if slow, shorten the oracle run or sample problems rather than letting the build crawl.

## Documentation to update

- `README.md` — replace the "Known limits" section, which currently states these as absent.
- `CLAUDE.md` — the tick ordering and the one-tick lag rule; scoring uses `steady`.
