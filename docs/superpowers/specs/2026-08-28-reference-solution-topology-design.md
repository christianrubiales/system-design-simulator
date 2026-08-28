# Reference Solution Topology Corrections — Design

- **Date:** 2026-08-28
- **Status:** Approved in principle, pending spec review
- **Scope:** Sub-project 2a of the AWS-centric rework — must land **before** ports and connection rules (2b)

## Context

Sub-project 1 mapped the generic component vocabulary onto AWS services without editing `problems.ts`. Every reference node resolves, and the resulting node *sets* are sound. Designing the connection rules (2b) revealed that some resulting **topologies** are not.

Three classes of defect, found by enumerating the 52 distinct resolved pairs across 376 reference edges:

1. **`rate-limiter` is not an AWS service.** 12 problems place it as a hop. In AWS, rate limiting is a capability of API Gateway (usage plans and throttling), WAF (rate-based rules), or application code backed by ElastiCache — not a box traffic routes through.
2. **Queues connect straight to datastores.** 26 problems draw `message-queue → nosql-db` and similar, omitting the consumer that actually drains the queue and performs the write. 31 edges.
3. **Task queues used for event streams.** `message-queue → stream-processor` (7 edges) resolves to SQS → Kinesis, which is not a real pattern. An event stream's producers write to the log directly.

These are content-correctness defects. CLAUDE.md requires every figure and attribution be correct because candidates repeat them in interviews; a diagram is a claim too.

## Decision: content may now name AWS services directly

Reference solutions have spoken the generic vocabulary exclusively. That constraint existed to avoid rewriting content during the catalog migration, and it succeeded. It is now retired: where the correct answer *is* a specific AWS service — Lambda as a queue consumer, Kinesis versus MSK — the solution names it directly. Catalog ids resolve to themselves through the bridge, so both vocabularies coexist and `check-catalog` validates both.

Generic ids stay wherever the generic concept is what is being taught.

## Non-decision: no new edge kind

An earlier draft proposed distinguishing "consult" edges (ALB consults WAF) from "transition" edges. **Dropped.** An edge means traffic flows between two components — the same meaning `simulator.ts` already gives it, and the same meaning `EC2 → ElastiCache → RDS` already carries. `alb → waf` is simply traffic reaching WAF and needs no special case. This removes an edge-kind subsystem, a `CustomEdgeData` field, and a rendering mode from the design.

## Correction rules

### R1 — Rate limiter (12 problems)

| Case | Problems | Action |
|---|---|---|
| Solution already contains API Gateway | chat-system, ride-sharing, video-streaming, notification-system, payment-system, ticket-booking, ecommerce, team-messaging, digital-wallet | Delete the `rate-limiter` node. Reconnect its inbound sources to `api-gateway`, and its outbound targets from `api-gateway`. Deduplicate resulting edges. Throttling is an API Gateway usage plan. |
| No API Gateway, public web path | url-shortener | Replace `rate-limiter` with `waf` in place, keeping its edges. A WAF rate-based rule is the AWS answer at the edge. |
| No API Gateway, internal politeness limiting | web-crawler | Delete the node and its edges. Crawler politeness is application logic over ElastiCache, already represented in that solution. |
| The limiter **is** the system under design | rate-limiter | Hand-treated. The limiter becomes EC2 executing token-bucket logic against ElastiCache, with API Gateway throttling as the outer layer. Requires reading the existing solution rather than applying a rule. |

### R2 — Queue semantics versus stream semantics

- **Tasks** — discrete units of work with one logical consumer (send a notification, resize an image, settle a payment, index a document): **SQS**.
- **Events** — an append-only log with replay and multiple independent readers (clickstream, telemetry, activity feeds, CDC): **Kinesis Data Streams**, or **MSK** where the Kafka ecosystem, high fan-out, or long retention is the point.

Consequently the 7 `message-queue → stream-processor` edges are removed: an event stream's producers write to the log directly, so the application tier connects to Kinesis/MSK, not through a queue.

Assignments:

| Problem | Stream choice | Rationale |
|---|---|---|
| ride-sharing, food-delivery, tinder | Kinesis | High-volume location and matching telemetry, single processing pipeline |
| video-streaming, netflix, tiktok | Kinesis | Playback and engagement events feeding recommendations |
| search-engine | MSK | Crawl and index pipeline with multiple independent consumers and replay |

### R3 — Queue and stream consumers (26 problems, 31 edges)

Every `queue → datastore` or `stream → datastore` edge gains a consumer between them.

- **Lambda** — short, per-message work: writes, fan-out, notifications, counter updates, index updates.
- **ECS** — long-running or resource-heavy work: media transcoding, chunk processing, ML inference, crawling.

Inserted nodes are positioned between the queue and its sink so the diagram stays readable.

## Invariants preserved

- `simulator.ts` and everything under `src/scoring/` remain read-only.
- Persisted stores keep `version: 1`, no-op `migrate`, `skipHydration: true`.
- `CustomEdgeData` and `SerializedEdge` are unchanged — no new edge kind.
- A reference solution still must not contain two ids that resolve to the same component. Inserting Lambda or ECS as a consumer is safe precisely because neither collides with `app-server`/EC2.
- All 35 problems keep a populated reference solution.

## Verification

1. **`check-catalog` must stay green** — every id resolves, no resolved-id collisions within a solution.
2. **No `rate-limiter` node remains** in any reference solution; a check asserts this so it cannot creep back.
3. **No queue or stream connects directly to a datastore** — a check enumerates `queue/stream → datastore` pairs and fails if any survive. This is the mechanical form of defect 2 and prevents regression.
4. **Every reference solution stays connected** — no orphan nodes introduced by rewiring. A check asserts every node is reachable from an entry node, which is also what the simulator and scorer assume.
5. **Manual review of the rendered diagrams** for a sample of the rewritten problems, since "connected and valid" is not the same as "reads well".

## Follow-on

With the content corrected, sub-project 2b's acceptance criterion — all 35 reference solutions validate clean against the port rules — becomes achievable and meaningful. Before this work it was not.

## Documentation to update

- `CLAUDE.md`: content may name AWS services directly; queue-versus-stream guidance; the new checks.
- `2026-08-28-ports-and-connection-rules-design.md`: note the dependency and that the consult/transition edge kind was dropped.
