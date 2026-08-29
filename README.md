<div align="center">

<a href="https://github.com/vijaygupta18/system-design-simulator">
  <img src="public/banner.svg" alt="SystemForge" width="900"/>
</a>

<br/><br/>

**The open-source system design interview simulator.**

Build real architectures on a canvas · simulate production traffic · get scored like a real interview.

<br/>

[![Next.js](https://img.shields.io/badge/Next.js_16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![ReactFlow](https://img.shields.io/badge/ReactFlow_v12-FF0072?style=for-the-badge)](https://reactflow.dev)

[![License: MIT](https://img.shields.io/github/license/vijaygupta18/system-design-simulator?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-22c55e.svg?style=flat-square)](#contributing)
[![Stars](https://img.shields.io/github/stars/vijaygupta18/system-design-simulator?style=flat-square)](https://github.com/vijaygupta18/system-design-simulator/stargazers)

<br/>

[**Quick Start**](#-quick-start) · [**Features**](#-features) · [**35 Problems**](#-35-design-problems) · [**Tech Stack**](#-tech-stack) · [**Contributing**](#-contributing)

</div>

---

## Overview

Most system design prep is passive — reading articles, watching videos, memorizing diagrams. **SystemForge makes it active.**

You drag real AWS services onto a canvas, wire them into an architecture, run production-scale traffic through it, see the monthly bill, and get scored across the five dimensions an interviewer actually evaluates. Think of it as a **flight simulator for system design interviews** — a safe place to fail, iterate, and build the intuition that reading alone can't give you.

It runs entirely in your browser. No account, no backend, no data leaves your machine.

```
  Pick a problem  →  Drag & wire components  →  Simulate traffic  →  Get scored  →  Iterate
```

---

## Table of Contents

- [Features](#-features)
  - [46 AWS Services + 9 Patterns](#46-aws-services--9-architectural-patterns)
  - [Traffic Simulation](#traffic-simulation)
  - [Cost Estimates](#-cost-estimates)
  - [Connectivity-Aware Scoring](#connectivity-aware-scoring)
  - [Interview Practice Mode](#interview-practice-mode)
  - [Concept Library & Trade-off Cards](#concept-library--trade-off-cards)
  - [Learning Path](#learning-path)
  - [Mobile & Tablet](#mobile--tablet)
- [35 Design Problems](#-35-design-problems)
- [How the Simulation Works](#-how-the-simulation-works)
- [Quick Start](#-quick-start)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Tech Stack](#-tech-stack)
- [Project Structure](#project-structure)
- [Contributing](#-contributing)
- [Support](#-support)
- [License](#-license)

---

## ✨ Features

<div align="center">
  <img src="public/features.svg" alt="Features overview" width="800"/>
</div>

<br/>

### 46 AWS Services + 9 Architectural Patterns

A real AWS toolbox — **46 services** with their official architecture icons, plus **9 pattern nodes** for the things that are techniques rather than products.

| Category | Services |
|----------|-----------|
| **Networking** | Route 53 · CloudFront · ALB · NLB · API Gateway · VPC · NAT Gateway · PrivateLink · Global Accelerator |
| **Compute** | EC2 · Lambda · Fargate |
| **Containers** | ECS · EKS |
| **Database** | RDS · Aurora · DynamoDB · ElastiCache · DocumentDB · Neptune · Timestream |
| **Storage** | S3 · EFS |
| **Integration** | SQS · SNS · EventBridge · EventBridge Scheduler · Step Functions · AppSync · App Mesh |
| **Analytics** | Kinesis · Firehose · MSK · OpenSearch · Redshift · Athena · Glue |
| **Security** | WAF · Cognito · IAM · Secrets Manager · KMS |
| **Observability** | CloudWatch · X-Ray · Cloud Map · AppConfig |
| **Patterns** | Circuit Breaker · ID Generator · Sharded Counter · Distributed Lock · Coordination Service · Geospatial Index · Reverse Proxy · Origin Shield · Vector DB |

Pattern nodes exist because rate limiting, sharded counters, and distributed locks are *techniques* — in AWS you enable API Gateway throttling or use a DynamoDB conditional write, not drag a box called "Rate Limiter".

**Every service carries real AWS figures**, each with a source comment in the code. Some are exact published quotas rather than estimates:

| Service | Capacity | Basis |
|---|---|---|
| DynamoDB | 40,000 units | AWS default table quota — 1 unit *is* 1 req/s by definition |
| Kinesis | 1,000 records/s per shard | Documented AWS limit |
| SQS FIFO | 300 msg/s | Documented cap (3,000 batched) |
| API Gateway | 10,000 req/s | Default account throttle |
| S3 | 5,500 GET/s per prefix | AWS quota — which is why key design matters |
| EC2 | vCPU × 2,500 req/s | **Estimate**, stated as such in the UI |

You configure them like real infrastructure — instance family and size, DynamoDB capacity mode, ElastiCache hit rate, S3 storage class — and capacity is derived from **published vCPU and memory specs**, not invented numbers.

#### Connection rules

Wire Route 53 straight into RDS and the edge turns amber with a reason: *"RDS expects database traffic."* Services declare what traffic they accept and emit, and connections are validated against that.

It **warns rather than blocks**. A hand-authored rule set will be wrong sometimes, and a validator that's wrong *and* blocking leaves you unable to draw the design you intend.

#### Region awareness

Pick from 34 AWS regions. Services unavailable there are flagged — DocumentDB isn't in N. California, Neptune isn't in Milan — and the region scales the cost estimate.

---

### Traffic Simulation

<div align="center">
  <img src="public/traffic-sim.svg" alt="Animated traffic simulation" width="800"/>
</div>

<br/>

Push 1K–500K requests/sec through your design and watch it behave like a real system:

- **Reads and writes flow separately**, seeded from the problem's own stated requirements. A cache serves reads at its hit rate; **writes always reach the database**. That single distinction is what turns "we'll put Redis in front" from hand-waving into arithmetic.
- **Correct fan-in accumulation** via Kahn's topological sort — QPS adds up exactly where it should.
- **Traffic splitting** — load balancers divide across targets; when a node fans out to both a cache and a datastore, reads split by hit rate and only the misses reach the store.
- **Read replicas add read capacity only** — every write still hits the single primary.
- **p50 and p99 latency**, with the tail widening as a node approaches saturation.
- **Honest throughput** — capped at offered load and collapsing through saturated nodes. No phantom over-capacity numbers.
- **Disconnected-node aware** — a stray, unwired node never steals traffic from the real request path.
- **Async-edge aware** — connections marked async are excluded from user-facing latency.
- **Bottleneck & cascading-failure** visualization, plus cycle detection that separates true cycle members from nodes merely downstream of one.

See [How the Simulation Works](#-how-the-simulation-works) for the model and its declared limits.

---

### Connectivity-Aware Scoring

<div align="center">
  <img src="public/scoring.svg" alt="Animated scoring engine" width="800"/>
</div>

<br/>

SystemForge scores the **wired request path**, not a parts bin. Drop a cache on the canvas but never connect it, and you get no credit — with feedback telling you exactly why. A pile of disconnected components scores *"Needs Work,"* just like it would in a real interview.

Scoring matches **architectural roles**, not service names: choose Aurora instead of RDS, or Fargate instead of EC2, and you still get credit for having a relational database or an application tier.

Five categories, each capped at exactly **20 points**:

| Category | What it checks |
|----------|---------------|
| **Scalability** | Load balancing, horizontal scaling, caching, async processing |
| **Availability** | No SPOFs, replica redundancy, monitoring, overload protection |
| **Latency** | CDN in front of origins, cache-before-DB patterns, minimal hop count |
| **Cost Efficiency** | Measured over-provisioning, per-request billing on bulk traffic, idle resources |
| **Trade-offs** | Read/write separation, defense in depth, architecture breadth |

Cost is scored on **measured waste**, not dollar totals — a URL shortener and a video platform have wildly different legitimate budgets, but "this node is at 3% utilization" and "API Gateway is carrying 200k req/s where an ALB would cost orders of magnitude less" are comparable across every problem.

**Verdicts:** Needs Work `<31` · Decent `<51` · Good `<71` · Excellent `<86` · Architect Level `86+`


---

### Interview Practice Mode

<div align="center">
  <img src="public/interview-flow.svg" alt="6-phase interview flow" width="800"/>
</div>

<br/>

Run a full, timed 45-minute mock with a wall-clock-accurate timer (it keeps counting even if you switch tabs) and a phase-by-phase guide:

| # | Phase | Time | Focus |
|---|-------|------|-------|
| 1 | **Requirements** | 5 min | Clarify functional & non-functional requirements |
| 2 | **Estimation** | 5 min | Back-of-the-envelope capacity math |
| 3 | **API Design** | 5 min | Define core endpoints |
| 4 | **Data Model** | 5 min | Entities, relationships, access patterns |
| 5 | **High-Level Design** | 15 min | Build the architecture on the canvas |
| 6 | **Deep Dive** | 10 min | Trade-offs and failure modes |

A color-coded timer keeps you honest: green (on track) · yellow (over target) · red (significantly over).

---

### Concept Library & Trade-off Cards

**Concept Library** — select any component to get interview-ready notes: when to use it, when *not* to, key trade-offs, common patterns (cache-aside, write-through, …), what to say to impress an interviewer, and verified real-world examples from Netflix, Uber, Twitter, and more.

**Edge labels** — click any connection to set its protocol (HTTP · gRPC · WebSocket · pub/sub · TCP) and sync/async mode, rendered with distinct line styles and badges.

**21 Trade-off Cards** — side-by-side comparisons of the decisions interviewers love to probe, with a "when to choose which" for each:

> SQL vs NoSQL · Push vs Pull · Sync vs Async · Strong vs Eventual Consistency · Monolith vs Microservices · REST vs gRPC · Cache-aside vs Write-through · Vertical vs Horizontal Scaling · Polling vs WebSocket · Single vs Multi-leader · Hash vs Range Partitioning · CDN Push vs Pull · Token Bucket vs Sliding Window · At-least-once vs Exactly-once Processing · Optimistic vs Pessimistic Locking · Long-polling vs SSE vs WebSocket · Kafka vs RabbitMQ · JWT vs Session Tokens · Normalization vs Denormalization · Batch vs Stream Processing · Active-active vs Active-passive

You can also log your **own** trade-off decisions with rationale as you design.

---

### Learning Path

A structured progression from your first easy problem to architect-level systems, with concept prerequisites shown per problem and completion tracking.

| Tier | Sample Problems | Focus |
|------|----------------|-------|
| **Foundations** | URL Shortener, Rate Limiter, Parking Lot | Core building blocks |
| **Intermediate** | Notification System, Autocomplete, Instagram, Reddit, Tinder | Combining systems |
| **Advanced** | Twitter, Chat, Web Crawler, Dropbox, WhatsApp, Code Editor | Complex distributed systems |
| **Expert** | Uber, YouTube, Payments, Netflix, Zoom, Google Maps, Kafka, Digital Wallet | Multi-concern architectures |

---

### Mobile & Tablet

Genuinely usable on phones and tablets — not just a shrunk desktop:

- **Tap-to-add** components (HTML5 drag-and-drop doesn't work on touch — tap the row or the `+`).
- Left **library drawer** + right **bottom sheet**; the canvas stays full-bleed.
- Finger-friendly wiring (enlarged connection handles + generous hit areas) and a **Remove Connection** button so edges are deletable without a keyboard.
- Two-row interview bar with controls always on screen; tap-to-edit text notes.
- Safe-area insets respected; **no horizontal overflow at 375 / 768 / 1024px+**.

---

## 📋 35 Design Problems

Every problem includes scale requirements (QPS, storage, latency), constraints, progressive hints, tags, a reference architecture you can load onto the canvas, and a full interview guide (requirements checklist, estimation math, API design, and data model).

<details>
<summary><strong>Click to expand all 35 problems</strong></summary>

<br/>

| # | Problem | Difficulty | Key Concepts |
|---|---------|-----------|-------------|
| 1 | URL Shortener | Easy | Hashing, caching, 100:1 read/write |
| 2 | Rate Limiter | Easy | Token bucket, sliding window, Redis |
| 3 | Parking Lot | Easy | IoT events, availability tracking |
| 4 | Twitter / News Feed | Hard | Fan-out, timeline, hybrid approach |
| 5 | Chat System | Hard | WebSocket, presence, message ordering |
| 6 | Uber / Ride Sharing | Hard | Geohash, location streaming, matching |
| 7 | YouTube / Video Streaming | Hard | CDN, transcoding, tiered storage |
| 8 | Notification System | Medium | Priority queues, multi-channel delivery |
| 9 | Typeahead / Autocomplete | Medium | Trie, prefix search, offline aggregation |
| 10 | Web Crawler | Medium | URL frontier, politeness, dedup |
| 11 | Distributed Cache | Medium | Consistent hashing, eviction, hot keys |
| 12 | Payment System | Hard | Idempotency, saga pattern, double-entry ledger |
| 13 | Ticket Booking | Hard | Virtual queue, seat locking, flash sales |
| 14 | Google Docs | Hard | OT/CRDT, WebSocket, version history |
| 15 | Dropbox / File Storage | Hard | Block chunking, delta sync, dedup |
| 16 | Instagram | Medium | Media pipeline, feed gen, CDN strategy |
| 17 | Spotify | Medium | Adaptive bitrate, pre-fetch, collab filtering |
| 18 | Amazon / E-Commerce | Hard | Microservices, inventory, event sourcing |
| 19 | Slack / Team Messaging | Hard | Channel model, search, connection gateway |
| 20 | Metrics / Monitoring | Hard | Time-series ingestion, downsampling, alerting |
| 21 | Netflix | Hard | Recommendation engine, adaptive streaming, DRM |
| 22 | Tinder / Dating App | Medium | Geospatial matching, ELO scoring, Bloom filters |
| 23 | Google Maps | Hard | Map tiles, Dijkstra/A*, real-time traffic |
| 24 | Zoom | Hard | WebRTC/SFU, simulcast, screen sharing |
| 25 | DoorDash / Food Delivery | Hard | Driver dispatch, ETA prediction, order tracking |
| 26 | Reddit | Medium | Ranking algorithms, comment trees, moderation |
| 27 | Airbnb | Hard | Search + booking, pricing, bilateral reviews |
| 28 | WhatsApp | Hard | E2E encryption (Signal Protocol), offline delivery |
| 29 | Google Search | Hard | Inverted index, PageRank, query parsing |
| 30 | Yelp / Location Service | Medium | QuadTree/Geohash, proximity search, reviews |
| 31 | TikTok | Hard | Recommendation (two-tower), video transcoding |
| 32 | Distributed Message Queue | Hard | Partitioning, consumer groups, exactly-once |
| 33 | Digital Wallet / UPI | Hard | P2P transfers, idempotency, compliance |
| 34 | Online Code Editor | Medium | Sandboxed execution, LSP, real-time collab |
| 35 | CI/CD Pipeline | Medium | Build DAGs, artifact storage, canary deploys |

</details>

---

## 🔬 How the Simulation Works

The simulator computes a **steady-state snapshot**, not a time series. It answers *"at this sustained load, where does this design break?"* — one pass, deterministic, no clock.

### Traffic flows as reads and writes

Load is split into two channels, seeded from the problem's own `readsPerSec` / `writesPerSec` and adjustable in the Simulate panel. This matters because the two are not interchangeable:

| Node | What it does to traffic |
|------|-------------------------|
| **Cache** (ElastiCache, CloudFront) | Serves `reads × hitRate`. **Writes always pass through** — a cache can never absorb a write. |
| **Database with read replicas** | Replicas add **read** capacity only; every write still hits the single primary. |
| **Load balancer** (ALB, NLB, API Gateway) | Divides traffic evenly across its targets. |
| **Everything else** | Passes both channels through to each child. |

When a node fans out to *both* a cache and a datastore — the shape almost every real diagram uses — reads split by the cache's hit rate, and only the misses reach the store. That's the lever the tool exists to teach: at an 85% hit rate your database sees 15% of reads, and that ratio is usually the difference between one instance and ten.

### Capacity comes from real instance specs

A node's ceiling is `vCPU × throughput-per-vCPU × instances`, where vCPU and memory are **published AWS figures** for the chosen instance type. Some values are exact AWS quotas rather than estimates — a DynamoDB capacity unit is one request per second by definition, a Kinesis shard is 1,000 records per second, an SQS FIFO queue is capped at 300 messages per second. Where a number *is* estimated, the properties panel says so and states the assumption.

### Latency reports p50 and p99

Tail latency comes from queueing, so the gap between p50 and p99 widens as a node approaches saturation rather than being a fixed multiple. Async hops — queues, notifications, monitoring — are excluded from user-facing latency.

### Time-stepped: scenarios, backlog, and feedback

The simulation runs **120 one-second ticks**, not a single snapshot, so behaviour that only exists over time becomes visible:

| Scenario | What it shows |
|---|---|
| **Steady** | Constant load. The assessment scenario — converges to the steady-state answer. |
| **Spike** | A sudden 4× burst. Does your queue absorb it? Autoscaling won't — it arrives too late. |
| **Ramp** | Gradual growth to 3×. Slow enough for autoscaling to keep up, if you have it. |
| **Consumer outage** | A downstream service goes dark. A queue retains the work; without one it's lost. |

Three feedback mechanisms, all with a deliberate **one-tick lag** — which is the physical truth, and the reason autoscaling can't rescue a sudden spike:

- **Queue backlog.** A queue drains at the rate its *consumer* can absorb, not its own ceiling. SQS accepts 100k msg/s happily; the backlog forms because the Lambda behind it takes 2k/s. Scrub the timeline and watch it build and drain.
- **Autoscaling.** Capacity grows under sustained high utilization and shrinks when load falls, damped by a moving average.
- **Retry amplification.** Shed requests retry, adding load to an already-saturated service. Load climbing to 4.6× baseline from a single failing node is flagged as a **retry storm** — the failure mode that turns a partial outage into a total one.

Scrubbing the timeline replays each tick onto the canvas, so you can watch utilization spread through the design.

**Scoring always uses Steady**, so grades stay comparable between designs regardless of which scenario you were exploring.

### Known limits

- **Throughput is not linear in vCPU**, and databases usually saturate on IO or connections before CPU. Derived capacity is a teaching estimate, not a benchmark — the UI says so.
- **Autoscaling is modelled generically**, not as a specific AWS Auto Scaling or Application Auto Scaling policy, and ignores instance warm-up time.
- **Retry behaviour is a single global rate**, not per-client policies with jitter and backoff.

---

## 💰 Cost Estimates

The Cost tab prices a design against **real AWS on-demand rates**, pulled from the AWS Price List API by  and committed as generated data — the app makes no network calls.

**Priced:** instance hours (EC2, RDS, ElastiCache, OpenSearch, MSK and friends), provisioned capacity (DynamoDB units, Kinesis shards), stored data by S3 storage class, requests (API Gateway, Lambda, S3), and data transfer (CloudFront egress, NAT Gateway processing).

**Deliberately excluded, and stated in the panel:**

- **Reserved Instances and Savings Plans** — real bills with commitments run 30–70% lower.
- **The free tier.**
- Services we have no pricing source for; these are listed as *not priced* rather than guessed at.

**Two approximations you should know about:**

- **Regional pricing is a single multiplier** sampled on one instance class against . Exact for compute in that family, approximate for storage and requests.
- **Data transfer depends on your average response size**, which nothing in a diagram can know. It is a config parameter you set per node, shown in the properties panel — not a hidden constant. When transfer exceeds half the bill, the panel says so explicitly, because a total dominated by an assumption should announce itself.

---

## 🚀 Quick Start

> **Prerequisites:** Node.js 18.18+ and npm.

```bash
git clone https://github.com/vijaygupta18/system-design-simulator.git
cd system-design-simulator
npm install
npm run dev
```

Open **http://localhost:3000** — that's it. Everything runs client-side; your designs are saved to `localStorage`.

### Keyboard Shortcuts

| Shortcut | Action | | Shortcut | Action |
|----------|--------|---|----------|--------|
| `Ctrl/⌘ + Enter` | Run simulation | | `Ctrl/⌘ + S` | Save design |
| `Ctrl/⌘ + Shift + S` | Score design | | `Ctrl/⌘ + O` | Load design |
| `Ctrl/⌘ + Z` | Undo | | `Ctrl/⌘ + E` | Export as PNG |
| `Ctrl/⌘ + Shift + Z` / `Ctrl + Y` | Redo | | `Delete` | Remove selected node/edge |
| `Escape` | Deselect | | | |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, fully static) |
| Language | React 19 + TypeScript |
| Canvas | [@xyflow/react](https://reactflow.dev) (ReactFlow v12) |
| State | Zustand v5, persisted to `localStorage` |
| Styling | Tailwind CSS v4 + shadcn-style components on Base UI |
| Animation | Framer Motion |
| Freehand pen | perfect-freehand |
| Icons | Lucide React |
| Export | html-to-image (PNG / SVG / JSON) |

No backend, no database, no telemetry — the entire app ships as a static bundle.

### Project Structure

```
src/
├── app/                  # Next.js App Router — layout, single route, globals.css
├── components/
│   ├── canvas/           # ReactFlow host, Component/Text nodes, edges, pen overlay
│   ├── dialogs/          # ModalShell + Save / Load / Confirm / Support / Create
│   ├── interview/        # Interview bar, phase guides, start dialog
│   ├── layout/           # AppShell, TopBar, SupportFAB
│   ├── panel/            # Right panel: Props · Simulate · Score · Capacity · Cost · Trade-offs
│   ├── sidebar/          # Component palette, problem selector, learning path
│   └── ui/               # Base UI primitives, Toast
├── data/
│   ├── components.ts     # 35 components (+ custom) with verified specs
│   ├── problems.ts       # 35 design problems with reference architectures
│   ├── conceptLibrary.ts # Educational content for every component
│   ├── interviewData.ts  # Requirements, APIs & data models for all 35 problems
│   ├── tradeoffCards.ts  # 21 trade-off comparisons
│   └── learningPath.ts   # 4-tier progression with prerequisites
├── engine/
│   └── simulator.ts      # Traffic simulation (Kahn's topological sort)
├── scoring/
│   ├── scorer.ts         # Orchestrator — builds the shared scoring graph
│   └── rules/            # 5 rule modules, 20 pts each
├── store/                # Zustand stores (canvas, app, interview, saved designs, …)
├── lib/                  # cost estimation, exportCanvas, loadReference, icons
├── scripts/              # Generators: AWS icons, pricing, region data, catalog checks
└── types/                # Shared TypeScript interfaces
```

---

## 🤝 Contributing

Contributions are welcome — new problems, components, trade-off cards, bug fixes, and UX polish all help. Please open an issue first to discuss larger changes.

```bash
npm run dev       # Start the dev server
npm run build     # Production build (also type-checks)
npm run lint      # Run ESLint
```

**Good first contributions:** add a design problem to `src/data/problems.ts` (+ its `interviewData.ts` entry), author a trade-off card, or improve concept-library content. Every formula, figure, and real-world attribution should be technically correct — this content teaches people preparing for real interviews.

---

## ☕ Support

If SystemForge helped you prep for a system design interview, a chai goes a long way toward keeping it alive and open-source. No pressure — no ads, no paywalls, ever.

[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-UPI-06B6D4?style=for-the-badge&logo=buymeacoffee&logoColor=white)](#-support)

<details>
<summary><b>Click to reveal the UPI QR</b></summary>

<br/>

<p align="center">
  <img src="public/support-upi-qr.jpg" alt="UPI QR code — vijaygupta1818@ptyes" width="280"/>
</p>

<p align="center">
  Scan with any UPI app — Paytm · PhonePe · GPay · BHIM<br/>
  UPI ID: <code>vijaygupta1818@ptyes</code>
</p>

</details>

> Prefer the in-app flow? Open the deployed site with <code>?support=1</code> and the support dialog opens automatically.

---

## 📄 License

[MIT](LICENSE) © [@vijaygupta18](https://github.com/vijaygupta18)

The AWS Architecture Icons in `public/aws-icons/` are © Amazon Web Services and
licensed separately under CC-BY-ND 2.0 — see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
SystemForge is not affiliated with or endorsed by AWS.

<div align="center">
<br/>

**If SystemForge helps your interview prep, consider giving it a ⭐ — it genuinely helps.**

<br/>

Built with care for everyone grinding system design interviews.

</div>
