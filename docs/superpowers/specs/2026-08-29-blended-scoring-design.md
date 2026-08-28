# Blended Scoring — Design

- **Date:** 2026-08-29
- **Status:** Approved, implementing
- **Scope:** Sub-project 7 of 7 — the final piece of the AWS-centric rework
- **First sub-project to modify `src/scoring/`**, read-only until now

## Context: scoring is currently broken

Measured before design: **the app's own expert-authored reference solutions average 27.2/100**, most rated "Needs Work".

The cause is 86 hardcoded generic component ids across the five rules — `"cache"`, `"nosql-db"`, `"message-queue"`, `"sql-db"`, `"rate-limiter"`, `"cdn"`, `"load-balancer"`, `"monitoring"`. Since sub-project 1 renamed the catalog to AWS service ids, only `"api-gateway"` still matches anything. Every other presence check silently returns false.

This is the same defect class as `LOAD_BALANCING_COMPONENTS` still listing `"load-balancer"`, an order of magnitude larger. So this sub-project is **repair first, enhancement second**.

## Decisions

### Rules identify components by concept, not by id

`hasConcept(graph, "cache")` matches whatever service carries `concept: "cache"`. The concept bridge built in sub-project 1 exists precisely for this and has been unused by scoring until now.

Swapping in AWS ids was rejected: it hardcodes one blessed service per concept, so a design using DAX or MemoryDB would score zero for caching — the same brittleness that caused this outage, merely re-pointed.

**Closing the gap:** AWS-only services carry no concept, so Aurora is not `sql-db`, MSK is not `message-queue`, and Lambda/ECS/Fargate are not `app-server`. A `satisfies?: Concept[]` field is added to catalog entries, broader than the 1:1 default mapping. A candidate who picks Aurora over RDS should be rewarded, not zeroed.

### AWS judgment folds into the existing five categories

Each category keeps exactly 20 points; no sixth category. The 100-point scale and the five interview dimensions are the product's framing, and a "Well-Architected" bolt-on would break both.

| Category | AWS judgment added |
|---|---|
| Scalability | serverless and auto-scaling services, provisioned capacity matched to load |
| Availability | Multi-AZ, read replicas, managed over self-run |
| Latency | CloudFront in front of origins, cache hit rate actually configured |
| Cost | measured waste (see below) |
| Trade-offs | managed vs self-managed, queue vs stream chosen correctly |

### Cost is scored on measured waste, not dollars

Absolute dollars are not comparable across problems — a URL shortener and a Netflix clone have wildly different legitimate budgets, so any fixed threshold would fail every large problem.

Instead the Cost category scores **waste that the simulation can actually measure**:

- capacity provisioned far above delivered load (utilization under ~10% on a priced node);
- expensive services where a cheaper one suffices at that traffic (API Gateway at very high QPS, where an ALB costs orders of magnitude less);
- Multi-AZ enabled indiscriminately;
- nodes that cost money while receiving no traffic at all.

This is relative by construction, teachable, and grounded in numbers the tool already computes. Replacing today's proxy — three points for having between 3 and 25 components — with real measurement is the single biggest upgrade available to this category.

## Verification

**The regression net is the reference solutions themselves.** They are model answers; a scoring engine that rates them "Needs Work" is broken by definition.

`check-catalog` gains an assertion: **every reference solution must score at or above a floor, and the average must clear a higher bar.** Thresholds are set from measured post-repair values with headroom, not aspirationally. This mechanically prevents the entire bug class from recurring — any future catalog rename that breaks a presence check will fail the build instead of silently degrading every score.

Also verified:

- each category still totals exactly 20 and never goes negative;
- a design with unwired components still scores poorly (presence must require reachability);
- an empty canvas scores 0 without throwing.

## Documentation to update

- `CLAUDE.md`: rules match by concept via `satisfies`, never by raw id; the reference-solution score floor.
- `README.md`: refresh the scoring section for AWS-aware criteria.
