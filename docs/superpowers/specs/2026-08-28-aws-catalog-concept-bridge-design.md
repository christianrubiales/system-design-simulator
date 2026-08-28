# AWS Catalog + Concept Bridge — Design

- **Date:** 2026-08-28
- **Status:** Approved, ready for implementation planning
- **Scope:** Sub-project 1 of 7 in the AWS-centric rework of SystemForge

## Context

SystemForge (this repo, MIT, © Vijay Gupta) is a system-design interview simulator with 36 generic components, 35 problems, a traffic simulator, and 5-dimension interview scoring. A second project — Sushant Kumar's "Sr. Architect" (Angular, **GPL v3**) — covers similar ground with an AWS-centric catalog of 74 services, typed connection rules, per-service instance configuration, a benchmarked cost model, and regional availability data.

The goal is to make SystemForge AWS-centric while keeping the interview experience, the 45-minute workflow, and the 35 problems that are its main asset.

### Licensing decision (settled)

GPL v3 is copyleft and incompatible with keeping this repo MIT. **No file, code, or data from the Sr. Architect repo is copied into this tree.** It is a reading reference only. Every artifact is rebuilt clean-room from AWS primary sources: pricing pages and the AWS Price List for costs, the AWS regional services list for availability, AWS service documentation for quotas and connectivity, and the official AWS Architecture Icons pack for graphics.

Ideas, architecture, and facts (an on-demand price, which regions lack a service) are not copyrightable; their expression is. This design reimplements ideas and re-derives facts.

## Decomposition

Seven sub-projects, each with its own spec, plan, and shippable end state:

1. **AWS catalog + icons + concept bridge** ← this document
2. Ports + connection rules
3. Instance / config modeling
4. Cost model
5. Regional availability
6. Richer traffic simulation
7. Blended scoring

Build order: 1 → 5 → 2 → 3 → 6 → 4 → 7. Regions early because it is small and validates the catalog metadata shape; cost late because it is the heaviest data-gathering work and depends on config modeling being settled.

## Goals

- Replace the generic catalog with ~45 AWS services plus pattern nodes.
- Render official AWS Architecture Icons on canvas and in the palette.
- **Change zero content in `problems.ts`, `conceptLibrary.ts`, or `learningPath.ts`.**
- Leave `simulator.ts` and all five scoring rules untouched.
- Keep designs saved before this change loading correctly.
- Keep the repo MIT, with third-party asset terms recorded explicitly.

## Non-goals (deferred to later sub-projects)

Connection rules and typed ports (#2), per-node instance configuration (#3), cost (#4), region selection (#5), simulator changes (#6), scoring changes (#7).

## Design

### 1. Data model

`SystemComponent` is extended, not replaced. Every new field is optional, so the change is non-breaking and nothing downstream needs to compile differently.

```ts
export type AwsCategory =
  | "networking" | "compute" | "containers" | "storage" | "database"
  | "integration" | "analytics" | "security" | "observability" | "pattern";

export interface SystemComponent {
  id: string;            // AWS service id: "ec2" | "dynamodb" | "elasticache"
  label: string;         // "EC2", "DynamoDB"
  category: AwsCategory;
  icon: string;          // lucide name — retained as fallback
  awsIcon?: string;      // -> public/aws-icons/<name>.svg ; absent for patterns
  awsService?: string;   // "Amazon Elastic Compute Cloud" — full name for tooltips
  concept?: Concept;     // the bridge; absent for AWS-only services
  managed?: boolean;     // AWS-managed vs self-run; consumed by scoring in #7
  maxQPS: number;
  latencyMs: number;
  scalable: boolean;
  stateful: boolean;
  description: string;
}
```

`Concept` is a union of the 36 existing component ids. Old ids never disappear — they become the vocabulary the interview layer speaks.

Each service's `maxQPS` and `latencyMs` carries a source comment citing the AWS published service quota or documented characteristic it derives from. These are figures a candidate will quote in an interview; CLAUDE.md requires they be correct. They remain static until sub-project 3 makes them config-driven.

### 2. The concept bridge

New file `src/data/conceptMap.ts`:

```ts
export const CONCEPT_DEFAULT: Record<Concept, string | null>; // null = pattern node
export function resolveComponentId(id: string): string;       // total: unknown ids pass through
export function conceptOf(componentId: string): Concept | undefined;
export const PATTERN_CONCEPTS: ReadonlySet<Concept>;
```

`resolveComponentId` returns the argument if it is already a catalog id, the mapped AWS service if it is a concept alias, and `undefined` otherwise. `loadReference.ts` resolves through it, so all 35 reference solutions keep their existing `componentId: "cache"` literals and render as ElastiCache nodes.

`conceptOf` is the inverse and is what sub-project 7 uses so that "is there a cache on the request path?" is satisfied by ElastiCache, DAX, or MemoryDB alike.

#### Collision rule

Two concepts must never map to the same default service. **Corrected during implementation:** the original rationale here claimed a collision "silently mis-wires" a diagram. It does not — `loadReference.ts` round-robins duplicate ids, so a collision renders *two identical-looking nodes* in a reference solution. That reads as a mistake to the candidate, so the rule stands, but it is a content-quality rule rather than a correctness one.

Where two concepts would collide and no genuinely distinct AWS service exists, the second concept becomes a **pattern node** instead of getting a default.

#### Concept mapping

| Concept | Default AWS service |
|---|---|
| dns | Route 53 |
| cdn | CloudFront |
| load-balancer | ALB (NLB ships alongside as an AWS-only entry) |
| api-gateway | API Gateway |
| rate-limiter | AWS WAF |
| app-server | EC2 |
| auth-service | Cognito |
| sql-db | RDS |
| nosql-db | DynamoDB |
| cache | ElastiCache |
| object-storage | S3 |
| search | OpenSearch |
| message-queue | SQS |
| service-mesh | App Mesh |
| monitoring | CloudWatch |
| websocket-server | AppSync |
| task-scheduler | EventBridge Scheduler |
| stream-processor | Kinesis Data Streams |
| notification-service | SNS |
| pub-sub | EventBridge |
| graph-db | Neptune |
| timeseries-db | Timestream |
| data-warehouse | Redshift |
| service-discovery | Cloud Map |
| file-store | EFS |
| config-service | AppConfig |

EventBridge Scheduler and the EventBridge bus are modeled as distinct catalog entries specifically to keep `task-scheduler` and `pub-sub` from colliding.

#### AWS-only services (19, no `concept`)

These have no generic analogue in the existing vocabulary; they exist because they change the answer to an interview question:

Lambda, ECS, EKS, Fargate, Aurora, Step Functions, MSK, Kinesis Data Firehose, Athena, Glue, DocumentDB, VPC, NAT Gateway, PrivateLink, Global Accelerator, IAM, Secrets Manager, KMS, X-Ray.

26 concept-mapped + 19 AWS-only = **45 AWS services**.

#### The extensible tail (not built now)

Deliberately excluded from the initial catalog, addable later as pure data entry with no engine change: Shield, SES, Amazon MQ, AWS Backup, FSx, ECR, Auto Scaling Group, Certificate Manager, Systems Manager, CloudTrail, Organizations, Transit Gateway, Direct Connect, App Runner, Elastic Beanstalk, Amplify, Lightsail, Batch, EMR, QuickSight, Bedrock, SageMaker, Rekognition, Textract, IoT Core, MediaConvert, CodePipeline, CodeBuild, CodeDeploy.

This is the constraint the catalog schema must honor: adding any of these must require touching `components.ts` and `public/aws-icons/` only.

#### Pattern nodes (9)

`circuit-breaker`, `id-generator`, `sharded-counter`, `distributed-lock`, `coordination-service`, `geospatial-index`, `reverse-proxy`, `origin-shield`, `vector-db`.

These are architectural patterns, not purchasable services. Origin shield is a CloudFront feature; vector search is a capability of OpenSearch and Aurora, not a product; a reverse proxy in AWS is whatever ALB or CloudFront already covers. They remain first-class catalog entries under `category: "pattern"`, with `concept` set to themselves, no `awsIcon`, and their current Lucide icon.

Catalog total as built: **46 AWS services + 9 pattern nodes + `custom` = 56 entries.** (46 rather than 45 because the single Elastic Load Balancing entry was split into ALB and NLB during implementation.)

**Labels use short AWS service names** — `EC2`, `S3`, `ALB`, `NLB`, `DynamoDB`, `ElastiCache`, `CloudFront` — in AWS's own casing, with the full product name in `awsService` for tooltips.

### 3. Icons

`scripts/fetch-aws-icons.ts` pulls the official AWS Architecture Icons pack, extracts only the services in the catalog, renames files to our service ids (`ec2.svg`, `dynamodb.svg`), and writes `public/aws-icons/` plus a `provenance.json` recording pack version, source URL, and fetch date. SVG contents are copied **byte-for-byte** — see the licensing posture below. Output is committed; the script is re-runnable to refresh.

`src/lib/awsIcon.ts` exports `awsIconUrl(component)`. Rendering is a fallback chain: `awsIcon` present renders `<img src="/aws-icons/x.svg">`; absent falls back to today's Lucide chip. Custom components and pattern nodes are therefore untouched by this change.

**Licensing posture (verified 2026-08-28).** The icons are licensed **CC-BY-ND 2.0** (Attribution-NoDerivatives). They are **not** MIT and never become MIT; they are recorded in `THIRD-PARTY-NOTICES.md` and explicitly carved out of the repo's MIT grant.

Precedent for this exact arrangement is AWS's own <https://github.com/awslabs/aws-icons-for-plantuml>, which redistributes these icons in an open-source repo under CC-BY-ND 2.0 with its code under MIT.

Three constraints follow from the license and the AWS Trademark Guidelines:

1. **Unmodified redistribution only.** NoDerivatives forbids shipping an altered work — no metadata stripping, no SVGO, no recoloring, no re-proportioning. Renaming a file is fine; editing its contents is not.
2. **Attribution required**, naming CC-BY-ND 2.0 specifically.
3. **Service icons only.** Architecture service icons are the CC-BY-ND asset; the AWS logo and wordmark are trademarks requiring written permission. Nothing may imply AWS sponsorship or endorsement of SystemForge.

Constraint 1 is why the chip-plus-icon rendering below is not merely an aesthetic preference: tinting a container around an untouched icon is compliant, whereas restyling icons for dark mode would not be.

Current pack version: `07312026`.

### 4. Palette and node rendering

**Chip-plus-icon.** Today's nodes use tinted monochrome chips, one accent per category, tuned for the dark theme. Official AWS icons are full-color with AWS-assigned hues. Rendering 45 of them bare would override that palette. The AWS icon is therefore placed *inside* the existing category-tinted chip, so the canvas keeps its visual rhythm and per-category color coding while each node stays instantly recognizable.

This is also the licensing-safe option: the chip is our artwork, the icon inside it is untouched. Adapting the icons themselves to the theme is not available to us under NoDerivatives. Reverting to *bare* unmodified icons stays a one-line change if the chip reads badly; recoloring them does not.

**Both themes.** CLAUDE.md claims dark-only with no toggle. This is stale — a working light/dark toggle shipped in `c8b456c` and `e86cbf0`, and lives in `appStore.ts` and `top-bar.tsx`. Icons must be verified in both. **Correct CLAUDE.md as part of this work.**

**Category expansion.** `CATEGORY_COLORS` in `ComponentNode.tsx` and `CATEGORY_ACCENT` / `CATEGORY_BG` in `ComponentPalette.tsx` are hardcoded to the old five categories and duplicate the same information across two files. They are consolidated into a single exported map in `data/components.ts` and extended to all ten categories. This is in-scope cleanup of files the work already touches, not unrelated refactoring. The old five category strings are retained as keys so that any un-upgraded persisted node still renders with color.

**Palette UX.** 55 entries in a flat list is unusable. Entries are grouped by the ten categories with collapsible sections. Search matches AWS service names *and* concept aliases — typing "cache" finds ElastiCache, "nosql" finds DynamoDB. The existing search box, drag, and tap-to-add behavior are otherwise unchanged.

### 5. Migration of saved designs

`SerializedComponentData` snapshots `label`, `icon`, `category`, and `maxQPS` alongside `componentId`, so designs saved before this change are self-contained and render correctly afterward — merely generic-looking.

The rule is **upgrade-on-load, non-destructive**: on `loadDesign`, `importDesign`, and rehydrate, each `componentId` is run through `resolveComponentId`. If it lands on a catalog entry, presentational fields are refreshed so the design returns as AWS. If it does not resolve — custom components — the node is left entirely alone. User-edited `replicas` always survive.

Consequently **no persisted-schema change is required**: every store keeps `version: 1`, its no-op `migrate`, and `skipHydration: true`, exactly as CLAUDE.md requires. No new QuotaExceeded surface, no new failure mode.

## Invariants preserved

- `simulator.ts` and all five scoring rules are read-only in this sub-project.
- Each scoring category still totals exactly 20; scoring is untouched until #7.
- `nodeTypes` / `edgeTypes` remain module-level.
- Reference-tab `readOnly` gating is unchanged.
- `SerializedEdge` continues to carry `data`.
- Persisted stores keep `version: 1`, no-op `migrate`, `skipHydration: true`.
- Hover-only affordances stay gated on `useIsCoarsePointer()`.

## Verification

The repo has no test framework, and a browser click-through does not cover a 55-entry catalog behind a resolution layer.

**1. `scripts/check-catalog.ts`, wired into `npm run build`.** Fails the build if:

- any `componentId` in `problems.ts` or `conceptLibrary.ts` fails to resolve. **Corrected during implementation:** `learningPath.ts` is *not* checked — it contains no component ids at all; its `concepts` field holds topic strings like `"caching"`. CLAUDE.md was wrong about this and has been fixed;
- any single reference solution resolves two entries to the same id (the collision rule, enforced mechanically);
- any `awsIcon` has no corresponding file in `public/aws-icons/`;
- any `Concept` lacks a `CONCEPT_DEFAULT` entry or a pattern-node declaration.

This mechanizes the data conventions CLAUDE.md currently enforces by convention alone.

**2. Manual browser checks** for what a script cannot see:

- AWS icon renders inside the category chip, in both light and dark themes;
- palette grouping, collapse, and alias search;
- **PNG export contains the icons** — `exportCanvas.ts` uses `html-to-image`, which must inline `<img>` sources as data URIs. Same-origin SVGs are expected to work, but this is verified explicitly, not assumed;
- a design saved *before* this change loads and upgrades correctly;
- a custom component still renders with its Lucide icon.

No test framework is added. These are pure data invariants; a build-failing script is the right tool.

## Documentation to update

- `CLAUDE.md`: correct the dark-only claim; document the concept bridge, the collision rule, and `check-catalog.ts`; update the component count.
- `NOTICE` / `THIRD-PARTY-NOTICES`: AWS Architecture Icons terms and carve-out.
