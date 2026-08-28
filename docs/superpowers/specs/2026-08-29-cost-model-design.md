# Cost Model — Design

- **Date:** 2026-08-29
- **Status:** Approved, implementing
- **Scope:** Sub-project 4 of 7 in the AWS-centric rework of SystemForge
- **Depends on:** sub-project 3 (config modeling) for its inputs, sub-project 5 (regions) for the multiplier, sub-project 6 (simulation) for delivered QPS

## Context

The catalog now carries per-service configuration — instance sizes, provisioned capacity units, storage class and volume — and the simulator reports delivered QPS per node. Everything needed to price a design exists; nothing prices it.

## Decisions

### Full cost coverage including data transfer

The bill covers instance hours, provisioned capacity, stored data, requests, **and data transfer**.

Data transfer was the contested one. It cannot be computed from anything the model knows — it needs bytes per request. The resolution is not to invent a hidden constant but to make it a **visible config parameter**: services that produce egress (CloudFront, S3, ALB, NAT Gateway) expose `payloadKB` in the properties panel with a default and help text. The assumption that often drives the largest line on the bill is therefore on screen and editable, rather than buried where it would silently dominate the total.

### Regional multipliers, not per-region price sets

One instance type is fetched across all 34 regions and each region's ratio to `us-east-1` becomes a whole-bill multiplier.

Per-region price sets would be exact, but EC2's `us-east-1` offer file alone is 458 MB; across 34 regions that is an ETL project whose committed output would be tens of megabytes shipped to a browser. `us-east-1` only was rejected because the region selector shipped in sub-project 5 would then have no effect on cost, which reads as a bug however well documented.

The multiplier is exact for compute within the sampled family and approximate for storage and requests. It is **derived from real AWS data**, and the UI states it ("Sydney ≈ 1.24x us-east-1") so the approximation is declared rather than implied away.

### Compute pricing is exact, not estimated

AWS on-demand prices scale linearly with size inside a family: `m5.4xlarge` is precisely 8x `m5.large`. One anchor price per family therefore reproduces every size exactly. ~12 family constants replace ~80 hand-copied prices, and the derivation is exact.

This premise is asserted against the fetched data itself — if `m5.xlarge / m5.large != 2`, the approach is wrong and must be revisited rather than quietly approximated.

## Design

### 1. Generated pricing data

`scripts/fetch-pricing.ts` pulls the AWS Price List API offline and emits a committed `src/data/pricing.ts`. The app never calls AWS at runtime — same posture as the region data and the icon pack.

```ts
export const PRICING_VERSION: string;                     // AWS offer version, e.g. "20260819"
export const FAMILY_VCPU_HOUR: Record<string, number>;    // "m5" -> 0.048 USD per vCPU-hour
export const REGION_MULTIPLIER: Record<string, number>;   // "sa-east-1" -> 1.52
export const SERVICE_PRICING: Record<string, ServicePricing>;
```

Extracting the EC2 anchor prices from a 458 MB file is a streaming filter in the generator, run once.

### 2. Cost dimensions

| Dimension | Driven by | Applies to |
|---|---|---|
| Instance hours | instance size x count x 730h | EC2, RDS, Aurora, ElastiCache, OpenSearch, MSK, DocumentDB, Neptune, Redshift |
| Provisioned capacity | `capacityUnits`, `shards` | DynamoDB, Kinesis |
| Stored data | `storageGB` x `storageClass` rate | S3, EFS |
| Requests | delivered QPS x 2.59M/month | API Gateway, Lambda, S3, DynamoDB on-demand |
| Data transfer | delivered QPS x `payloadKB` | CloudFront, S3, ALB, NAT Gateway |

Every input already exists in the `serviceConfig` schemas except `payloadKB`, which this sub-project adds.

### 3. Computation

`estimateCost(nodes, simResult, region): CostBreakdown` — pure, in `src/lib/cost.ts`. Per-node line items summing to a monthly total.

**Instance hours and storage need only the design. Requests and data transfer need delivered QPS**, which exists only after a simulation. The panel therefore shows compute and storage immediately and prompts to run a simulation for the rest, rather than reporting a total silently missing its largest component.

### 4. UI

A **Cost** tab in the right panel: monthly total, per-node rows with each node's dominant dimension, and a **largest line item** callout. When NAT Gateway data processing outranks the EC2 fleet, that is the lesson.

The panel states plainly:

- **on-demand pricing only** — no Reserved Instances or Savings Plans, which move real bills 30-70%;
- **no free tier**;
- the region multiplier and its basis;
- the pricing data version and date, so staleness is visible.

A confident wrong number is worse than a hedged right one.

## Invariants preserved

- `simulator.ts` is read-only in this sub-project; cost consumes its output.
- Scoring untouched; each category still totals exactly 20.
- Persisted stores keep `version: 1`. `payloadKB` is an additive config param, carried by the existing `config` field.
- The anti-drift invariant (`deriveCapacity(service, defaults) === service.maxQPS`) still holds: `payloadKB` does not drive capacity.
- No runtime network calls.

## Verification

**The generator is the risk, not the arithmetic.** A price-list filter can silently select the wrong SKU — Windows rather than Linux, dedicated rather than shared tenancy, a reserved term rather than on-demand — producing figures that look plausible and are multiples off.

1. **Spot-check generated prices against AWS's published pricing pages** for `m5.large`, `db.m5.large`, `cache.r6g.large`, and S3 Standard. Four matches means the SKU filter is right; one mismatch means it is wrong everywhere.
2. **Assert linearity in the fetched data**: `m5.xlarge / m5.large` must equal 2. If not, the family-constant premise is false and the approach needs revisiting.
3. **Build checks:** every catalog service has pricing or is explicitly declared free; every `INSTANCE_FAMILIES` family has a rate; every `AWS_REGIONS` region has a multiplier.
4. **Behavioural tests:** `m5.4xlarge` costs 8x `m5.large`; doubling instances doubles cost; the region multiplier applies; DynamoDB on-demand and provisioned differ; an idle node still costs its instance hours.
5. **Sanity check:** price two reference solutions and judge plausibility at their stated scale. A URL shortener at ~$200/month and a Netflix clone at ~$80k/month is believable; the reverse means something is inverted.

## Documentation to update

- `README.md` — a cost section covering what is priced, what is excluded (Reserved Instances, Savings Plans, free tier), and the regional-multiplier approximation.
- `CLAUDE.md` — pricing is generated, never hand-edited; the linearity premise; on-demand only.
