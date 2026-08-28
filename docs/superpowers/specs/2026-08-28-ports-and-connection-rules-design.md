# Ports and Connection Rules — Design

- **Date:** 2026-08-28
- **Status:** Approved, ready for implementation planning
- **Scope:** Sub-project 2 of 7 in the AWS-centric rework of SystemForge
- **Depends on:** `2026-08-28-aws-catalog-concept-bridge-design.md` (shipped) and
  `2026-08-28-reference-solution-topology-design.md` (**must land first** — until the
  reference solutions are corrected, this spec's acceptance criterion "all 35 validate
  clean" is unachievable, because some of them are genuinely wrong in AWS terms)

**Amendment (2026-08-28):** an earlier draft of this design proposed distinguishing
"consult" edges from "transition" edges, so that `alb → waf` could be modelled as a
side-call. **Dropped.** An edge means traffic flows between two components — the same
meaning `simulator.ts` already gives it. `waf.accepts` including `http` makes
`alb → waf` valid with no special case, removing an edge-kind subsystem, a
`CustomEdgeData` field, and a rendering mode.

## Context

The catalog now holds 46 AWS services, 9 pattern nodes, and `custom`. Connections between them are currently unconstrained: every node has one target handle and one source handle, `onConnect` accepts any pair, and every edge is created as `animated` with `protocol: "http"`. Route 53 can be wired directly to RDS with no objection.

For an interview simulator this is a missed teaching opportunity — knowing what can legitimately talk to what is a large part of what an AWS system-design interview probes.

Sushant's "Sr. Architect" (GPL v3) covers similar ground with per-service typed ports and explicit per-pair rules. As with everything else in this rework, **no code or data is copied**; this is an independent construction, and it deliberately uses a different and much smaller formulation.

## Goals

- Flag connections that do not make architectural sense, with a readable reason.
- Give valid edges a semantic kind (`database`, `queue`, `storage`, …) usable as a label.
- Do not change persistence, simulation, or scoring.
- Do not make the canvas harder to draw on.

## Non-goals

- Blocking invalid connections (see "Advisory, not enforcing" below).
- Per-port handles on nodes.
- Scoring consequences — that is sub-project 7.
- Changing `simulator.ts` or anything under `src/scoring/`.

## Key decisions

### Single handle pair, not per-port handles

Nodes keep exactly one target handle (left) and one source handle (right). Port types live in data and decide validity, but are not individually clickable.

The rejected alternative was one handle per port type, faithful to a literal port model. EC2 would render roughly five input and nine output handles; a twelve-node canvas becomes a thicket, the node design is wrecked, and every existing edge — all of which have `null` handles — would need migrating. The value of this feature is *"this connection doesn't make sense, and here's why"*: a validation and teaching problem, not a hit-target problem.

### Advisory, not enforcing

An invalid connection is created, then marked — amber, dashed, with the reason available. It is not blocked.

The reason is specific rather than philosophical: the rule data is hand-authored across 56 entries, so early on it **will** produce false negatives. A wrong validator that blocks makes the app look broken and leaves the user no recourse — they cannot draw the design they intend. A wrong validator that warns costs an ignorable amber edge. Blocking is only safe once the rules are proven, which the reference-solution check below begins to establish.

This also matches the region-availability decision in sub-project 5, giving the product one consistent rule: **the tool tells you what's wrong; it does not take the pen out of your hand.**

Promoting unambiguous nonsense to a hard block is a reasonable follow-up once the model has proven itself. It is not in this scope.

### Capability intersection, not a pair matrix

Each catalog entry declares two short arrays; a connection is valid when the source's outbound set intersects the target's inbound set, and the intersection names the connection.

An explicit per-pair rule table over 56 entries is up to 3,136 rules to author and maintain. The intersection formulation is 56 pairs of short arrays with the same expressive power for this purpose, and it yields the edge's semantic kind as a by-product rather than requiring a separate field per rule.

## Design

### 1. Port vocabulary

Sixteen types, describing **kinds of traffic**, not wire protocols:

`http` · `dns` · `database` · `cache` · `storage` · `queue` · `topic` · `event` · `stream` · `search` · `analytics` · `identity` · `observability` · `workflow` · `compute` · `network`

### 2. Catalog declarations

`SystemComponent` gains two optional fields:

```ts
accepts?: PortType[];  // traffic kinds this service can receive
emits?: PortType[];    // traffic kinds this service can send
```

Examples:

```ts
ec2:   { accepts: ["http", "compute"],
         emits: ["http","database","cache","storage","queue","topic","event",
                 "stream","search","identity","observability","workflow"] }
rds:   { accepts: ["database"], emits: ["observability"] }
s3:    { accepts: ["storage","http"], emits: ["event","observability"] }
alb:   { accepts: ["http"], emits: ["http"] }
sqs:   { accepts: ["queue"], emits: ["http","compute"] }
```

**Absence means unknown, never invalid.** Pattern nodes, `custom`, and any entry without declarations are never flagged. This mirrors `UNKNOWN_AVAILABILITY` in the region work: the tool must not present missing data as a negative verdict.

Precisely: if **either** endpoint lacks the relevant declaration — the source has no `emits`, or the target has no `accepts` — the verdict is `{ ok: true, kind: null }`. Only when both sides declare, and the intersection is empty, is a connection flagged. An unknown id (a custom component, or a node whose catalog entry has since been removed) is likewise treated as undeclared.

### 3. Flow semantics, not initiator semantics

Ports describe **which way traffic flows**, not which side opens the TCP connection.

A consumer polls SQS, but every architecture diagram draws SQS → consumer. Initiator semantics would flag a large share of the reference solutions as backwards. Flow semantics also match `simulator.ts`, which already pushes QPS along edges — so ports and simulation agree on what an arrow means instead of contradicting each other.

This is why `sqs.emits` includes `http`/`compute`: it describes delivery to consumers.

### 4. The rule module

New file `src/data/connectionRules.ts`, pure, importing only the catalog:

```ts
export type PortType = /* the sixteen above */;

export type ConnectionVerdict =
  | { ok: true; kind: PortType | null }   // null = undeclared, no claim made
  | { ok: false; reason: string };

export function validateConnection(sourceId: string, targetId: string): ConnectionVerdict;
```

`reason` is written for a candidate to read, naming both sides' capabilities — e.g. *"Route 53 sends dns, http; RDS only accepts database."*

### 5. Derived at render, never persisted

Validity is computed from the edge's source and target node ids each time it renders. Nothing is added to `CustomEdgeData` or `SerializedEdge`.

Consequences, all of them wanted:

- no persistence change, no store version bump, no migration;
- **improving the rules re-evaluates every existing design automatically**, rather than leaving a stale verdict baked into files saved earlier — which matters precisely because we expect the rules to be wrong at first;
- the cost is a 56-entry lookup per edge render, which is negligible.

`protocol` is left alone. It is a different vocabulary (`grpc`, `websocket`, `tcp`), it is user-editable, and conflating it with port kinds would fight the user's own edits.

### 6. Surfaces

1. **At connection time** — a toast naming the reason. Feedback where the mistake happens.
2. **On the edge** — amber, dashed, with a `?` badge in `AnimatedEdge`'s existing badge slot.
3. **In the properties panel** — selecting a flagged edge explains what was expected and what the source could legitimately connect to.

Valid edges gain a quiet benefit: the inferred kind becomes the edge's default label, so a correct diagram self-annotates.

Reference tabs (`tab.readOnly`) already gate connecting; nothing changes there.

## Invariants preserved

- `simulator.ts` and everything under `src/scoring/` are read-only in this sub-project.
- Each scoring category still totals exactly 20.
- Persisted stores keep `version: 1`, no-op `migrate`, `skipHydration: true`.
- `SerializedEdge` keeps carrying `data`, unchanged in shape.
- `nodeTypes` / `edgeTypes` stay module-level.
- Hover-only affordances stay gated on `useIsCoarsePointer()`.
- Both light and dark themes verified.

## Verification

**1. All 35 reference solutions must validate clean.** Every edge in every reference solution is run through `validateConnection`; zero flags expected. Reference solutions speak the generic vocabulary, so each endpoint is passed through `resolveComponentId` first — the check validates the AWS services the diagram actually renders. These are expert-authored correct architectures, so a warning there is a bug in the rule data, not in the design. Roughly 350 edges of mechanical checking. This becomes **check-catalog rule #10**, so a later edit to `accepts`/`emits` that breaks a reference solution fails the build.

**2. The validator must be observed rejecting something.** A red/green test that a known-nonsense pair (Route 53 → RDS) is flagged, and that a known-good pair (EC2 → RDS) is not. A validator never seen refusing anything is not known to work — this repo has already produced two checks that silently passed everything.

**3. Manual browser checks:** toast on an invalid connection; amber dashed rendering in both themes; the properties-panel explanation; a valid edge picking up its inferred label; connecting still gated on reference tabs.

## Documentation to update

- `CLAUDE.md`: the port model, flow-vs-initiator semantics, the advisory-not-enforcing rule, absence-means-unknown, and check rule #10.
