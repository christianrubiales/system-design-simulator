import type { ComponentCategory, SystemComponent } from "@/types/component";

export const SYSTEM_COMPONENTS: SystemComponent[] = [
  // Networking
  {
    id: "route53",
    label: "Route 53",
    category: "networking",
    icon: "Globe",
    awsIcon: "route53",
    awsService: "Amazon Route 53",
    concept: "dns",
    managed: true,
    // Source: Route 53 is designed for effectively unlimited authoritative DNS
    // query volume and carries a 100% availability SLA; the figure below is a
    // modeling ceiling, not a published per-account quota.
    maxQPS: 1000000,
    // Source: resolution is typically single-digit to low-tens of ms depending on
    // resolver caching; 10ms models an uncached authoritative lookup.
    latencyMs: 10,
    scalable: true,
    stateful: false,
    description:
      "Managed authoritative DNS — resolves domain names to your AWS endpoints and is the first hop in almost every request path. Supports latency-based, geolocation, weighted, and failover routing with health checks, so it doubles as a coarse global traffic manager. Backs a 100% availability SLA, the only AWS service that does.",
  },
  {
    id: "cloudfront",
    label: "CloudFront",
    satisfies: ["reverse-proxy", "origin-shield"],
    category: "networking",
    icon: "Cloudy",
    awsIcon: "cloudfront",
    awsService: "Amazon CloudFront",
    concept: "cdn",
    managed: true,
    // Source: CloudFront's default quota is 250,000 requests/second per
    // distribution (raisable on request).
    maxQPS: 250000,
    // Source: edge-cache hits typically serve in tens of ms; a miss pays the
    // origin round trip instead.
    latencyMs: 15,
    scalable: true,
    stateful: false,
    description:
      "Global CDN that caches static and dynamic content at hundreds of edge locations, cutting latency for distant users and shielding the origin from repeat traffic. Terminates TLS at the edge, integrates with WAF and Shield for DDoS protection, and can run logic at the edge via CloudFront Functions or Lambda@Edge. Origin Shield adds a mid-tier cache to further collapse origin load.",
  },
  {
    id: "alb",
    label: "ALB",
    category: "networking",
    icon: "Network",
    awsIcon: "alb",
    awsService: "Application Load Balancer",
    concept: "load-balancer",
    managed: true,
    // Source: ALB scales automatically with no documented hard RPS ceiling;
    // capacity is billed via LCUs. Figure is a modeling ceiling.
    maxQPS: 200000,
    // Source: ALB adds low-single-digit ms of processing per request.
    latencyMs: 5,
    scalable: true,
    stateful: false,
    description:
      "Layer 7 load balancer that routes HTTP/HTTPS by path, host, header, or query string across target groups of EC2 instances, containers, IPs, or Lambda functions. Handles TLS termination, sticky sessions, and health checks, and is the default front door for web and API tiers. Choose it over NLB whenever routing decisions depend on request content.",
  },
  {
    id: "nlb",
    label: "NLB",
    satisfies: ["load-balancer", "reverse-proxy"],
    category: "networking",
    icon: "Network",
    awsIcon: "nlb",
    awsService: "Network Load Balancer",
    // No `concept`: the generic vocabulary has one "load-balancer", mapped to ALB.
    managed: true,
    // Source: AWS documents NLB as capable of handling tens of millions of
    // requests per second; figure is a conservative modeling ceiling.
    maxQPS: 1000000,
    // Source: NLB operates at layer 4 and adds well under a millisecond.
    latencyMs: 1,
    scalable: true,
    stateful: false,
    description:
      "Layer 4 load balancer for TCP, UDP, and TLS traffic, built for extreme throughput and ultra-low latency with static IPs per Availability Zone. Preserves the client source IP and handles millions of requests per second, making it the right choice for non-HTTP protocols, gaming, IoT, and latency-critical paths. Cannot route on request content — use ALB when you need that.",
  },
  {
    id: "api-gateway",
    label: "API Gateway",
    satisfies: ["rate-limiter"],
    category: "networking",
    icon: "Router",
    awsIcon: "api-gateway",
    awsService: "Amazon API Gateway",
    concept: "api-gateway",
    managed: true,
    // Source: default account-level throttle is 10,000 requests/second across
    // all APIs in a region (soft limit, raisable via a quota increase).
    maxQPS: 10000,
    // Source: REST API adds roughly 10-30ms overhead; HTTP APIs are lower.
    latencyMs: 15,
    scalable: true,
    stateful: false,
    description:
      "Managed front door for HTTP, REST, and WebSocket APIs — handles routing, authorization, throttling, request/response transformation, and caching without running servers. Integrates natively with Lambda, and enforces per-client rate limits via usage plans and API keys. Note the 10,000 RPS default account throttle: at higher scale you either raise the quota or front your services with ALB instead.",
  },
  {
    id: "vpc",
    label: "VPC",
    category: "networking",
    icon: "Network",
    awsIcon: "vpc",
    awsService: "Amazon Virtual Private Cloud",
    managed: true,
    // VPC is a network boundary, not a request-processing hop: it adds no
    // measurable latency and imposes no throughput ceiling of its own.
    maxQPS: 1000000,
    latencyMs: 0,
    scalable: true,
    stateful: false,
    description:
      "The isolated virtual network your resources run in, divided into public and private subnets across Availability Zones. Security groups and network ACLs control traffic; route tables decide what can reach the internet. In an interview, showing private subnets for databases and app tiers — with only load balancers public — is the baseline expectation for a secure design.",
  },
  {
    id: "nat-gateway",
    label: "NAT Gateway",
    satisfies: ["reverse-proxy"],
    category: "networking",
    icon: "Router",
    awsIcon: "nat-gateway",
    awsService: "NAT Gateway",
    managed: true,
    // Source: scales from 5 Gbps to 100 Gbps and supports up to 55,000
    // simultaneous connections per unique destination.
    maxQPS: 55000,
    latencyMs: 1,
    scalable: true,
    stateful: true,
    description:
      "Lets resources in private subnets reach the internet for outbound calls — package installs, third-party APIs, webhooks — while blocking unsolicited inbound connections. Deploy one per Availability Zone so a zone failure does not sever egress for the others. Frequently a surprise line item on the bill, since it charges both hourly and per GB processed.",
  },
  {
    id: "privatelink",
    label: "PrivateLink",
    category: "networking",
    icon: "Lock",
    awsIcon: "privatelink",
    awsService: "AWS PrivateLink",
    managed: true,
    // Endpoint throughput scales with the underlying VPC endpoint; no published
    // per-endpoint RPS ceiling. Figure is a modeling ceiling.
    maxQPS: 100000,
    latencyMs: 1,
    scalable: true,
    stateful: false,
    description:
      "Exposes a service privately through an interface VPC endpoint so traffic never traverses the public internet, an internet gateway, or a NAT device. Used to reach AWS services, SaaS partners, or your own services across VPC and account boundaries. The standard answer when an interviewer asks how services in separate VPCs talk without public exposure.",
  },
  {
    id: "global-accelerator",
    label: "Global Accelerator",
    category: "networking",
    icon: "Zap",
    awsIcon: "global-accelerator",
    awsService: "AWS Global Accelerator",
    managed: true,
    // Throughput follows the backing endpoints; the accelerator itself is not
    // the documented bottleneck. Figure is a modeling ceiling.
    maxQPS: 1000000,
    // Source: routes over the AWS backbone from the nearest edge, typically
    // improving latency versus public-internet paths.
    latencyMs: 2,
    scalable: true,
    stateful: false,
    description:
      "Gives you two static anycast IPs that admit traffic at the nearest AWS edge and carry it over the AWS backbone to healthy endpoints in one or more regions. Improves latency and failover speed for TCP/UDP workloads, and unlike DNS-based failover it reroutes in seconds without waiting for TTLs to expire. Pair it with NLB for global, latency-sensitive, non-HTTP traffic.",
  },
  {
    id: "waf",
    label: "WAF",
    satisfies: ["rate-limiter"],
    category: "security",
    icon: "ShieldAlert",
    awsIcon: "waf",
    awsService: "AWS WAF",
    concept: "rate-limiter",
    managed: true,
    // Source: WAF inspects requests inline at CloudFront/ALB/API Gateway and
    // scales with them; rate-based rules count requests per 5-minute window.
    maxQPS: 250000,
    latencyMs: 1,
    scalable: true,
    stateful: true,
    description:
      "Web application firewall that filters requests at CloudFront, ALB, or API Gateway before they reach your application. Rate-based rules throttle abusive clients by IP; managed rule groups cover the OWASP Top 10, bad bots, and known-bad inputs. This is where request-level rate limiting belongs in an AWS design, rather than a hand-rolled token bucket in the app tier.",
  },
  // Compute
  {
    id: "ec2",
    label: "EC2",
    category: "compute",
    icon: "Server",
    awsIcon: "ec2",
    awsService: "Amazon Elastic Compute Cloud",
    concept: "app-server",
    managed: false,
    // Per-instance application throughput is workload-dependent; 5,000 QPS
    // models a mid-size instance serving a light API workload. Scale with
    // replicas rather than raising this number.
    maxQPS: 5000,
    latencyMs: 20,
    scalable: true,
    stateful: false,
    description:
      "Virtual machines you control end to end — OS, runtime, and long-running processes. Scale horizontally behind an ALB with an Auto Scaling group, and pick the instance family to match the workload: t-series for burstable, m for balanced, c for compute-bound, r for memory-bound, g/p for GPU. Unlike Lambda or Fargate, you manage patching and capacity, which is the tradeoff to name in an interview.",
  },
  {
    id: "lambda",
    label: "Lambda",
    satisfies: ["app-server"],
    category: "compute",
    icon: "Zap",
    awsIcon: "lambda",
    awsService: "AWS Lambda",
    managed: true,
    // Source: default 1,000 concurrent executions per region (soft limit).
    // At ~50ms average duration that is roughly 20,000 requests/second.
    maxQPS: 20000,
    // Source: warm invocations add single-digit ms; cold starts add far more,
    // which is the tradeoff worth naming.
    latencyMs: 25,
    scalable: true,
    stateful: false,
    description:
      "Runs code on demand with no servers to manage, scaling from zero to thousands of concurrent executions automatically and billing only for time used. Ideal for event-driven work, spiky traffic, and glue between services. The interview tradeoffs are cold starts on latency-critical paths, a 15-minute maximum execution time, and the default 1,000-concurrency account limit.",
  },
  {
    id: "fargate",
    label: "Fargate",
    satisfies: ["app-server"],
    category: "compute",
    icon: "Box",
    awsIcon: "fargate",
    awsService: "AWS Fargate",
    managed: true,
    // Throughput is per-task and workload-dependent; models a mid-size task.
    maxQPS: 5000,
    latencyMs: 20,
    scalable: true,
    stateful: false,
    description:
      "Serverless compute for containers — you specify CPU and memory per task and AWS runs it without you provisioning or patching EC2 instances. Works as a launch type under both ECS and EKS. Choose it when you want container packaging without cluster capacity management, and accept a higher per-vCPU price than self-managed EC2 in exchange.",
  },
  // Containers
  {
    id: "ecs",
    label: "ECS",
    satisfies: ["app-server"],
    category: "containers",
    icon: "Box",
    awsIcon: "ecs",
    awsService: "Amazon Elastic Container Service",
    managed: true,
    // Cluster throughput scales with task count; models an aggregate service.
    maxQPS: 50000,
    latencyMs: 20,
    scalable: true,
    stateful: false,
    description:
      "AWS-native container orchestrator that schedules Docker containers onto EC2 or Fargate capacity, with built-in service discovery, load balancer integration, and rolling deployments. Simpler to operate than Kubernetes and deeply integrated with IAM and CloudWatch. Reach for it when you want containers without the operational surface of EKS.",
  },
  {
    id: "eks",
    label: "EKS",
    satisfies: ["app-server"],
    category: "containers",
    icon: "Box",
    awsIcon: "eks",
    awsService: "Amazon Elastic Kubernetes Service",
    managed: true,
    // Cluster throughput scales with node and pod count; models an aggregate.
    maxQPS: 50000,
    latencyMs: 20,
    scalable: true,
    stateful: false,
    description:
      "Managed Kubernetes control plane, so you get the full Kubernetes API, ecosystem, and portability without running etcd or masters yourself. Worth its extra complexity when you need Kubernetes-specific tooling, multi-cloud portability, or an existing Helm-based platform. If the answer is just 'run containers on AWS', ECS is the lower-overhead choice.",
  },
{
    id: "cognito",
    label: "Cognito",
    category: "security",
    icon: "KeyRound",
    awsIcon: "cognito",
    awsService: "Amazon Cognito",
    concept: "auth-service",
    managed: true,
    // Source: user pool operation quotas are per-category and per-region;
    // sign-in category defaults are in the low thousands of RPS.
    maxQPS: 10000,
    latencyMs: 20,
    scalable: true,
    stateful: true,
    description:
      "Managed user directory and identity provider handling sign-up, sign-in, MFA, password reset, and social or enterprise federation via OIDC and SAML. Issues JWTs that API Gateway and ALB can validate natively, so authentication never has to reach your application code. Identity pools additionally vend temporary AWS credentials for direct client access to services.",
  },
  {
    id: "iam",
    label: "IAM",
    category: "security",
    icon: "ShieldCheck",
    awsIcon: "iam",
    awsService: "AWS Identity and Access Management",
    managed: true,
    // Authorization happens inside the AWS control plane, not as a hop in your
    // request path; these values model "no measurable cost to the design".
    maxQPS: 1000000,
    latencyMs: 0,
    scalable: true,
    stateful: false,
    description:
      "Controls which principals can call which AWS APIs on which resources. Roles with temporary credentials are the correct mechanism for service-to-service access; long-lived access keys are the anti-pattern interviewers listen for. Least privilege here is what keeps a compromised component from becoming a compromised account.",
  },
  {
    id: "secrets-manager",
    label: "Secrets Manager",
    category: "security",
    icon: "Lock",
    awsIcon: "secrets-manager",
    awsService: "AWS Secrets Manager",
    managed: true,
    // Source: GetSecretValue default quota is 10,000 requests/second.
    // In practice applications cache secrets rather than fetching per request.
    maxQPS: 10000,
    latencyMs: 20,
    scalable: true,
    stateful: true,
    description:
      "Stores database credentials, API keys, and tokens encrypted with KMS, with automatic rotation via Lambda and fine-grained IAM access. Applications fetch at startup and cache rather than calling per request. The answer to 'where do the database credentials live?' that is not 'an environment variable in the deployment config'.",
  },
  {
    id: "kms",
    label: "KMS",
    category: "security",
    icon: "ShieldCheck",
    awsIcon: "kms",
    awsService: "AWS Key Management Service",
    managed: true,
    // Source: shared cryptographic operation quotas are in the tens of
    // thousands of requests/second depending on key type and region.
    maxQPS: 50000,
    latencyMs: 5,
    scalable: true,
    stateful: true,
    description:
      "Manages encryption keys and performs cryptographic operations, backing encryption at rest for S3, EBS, RDS, DynamoDB, and Secrets Manager. Envelope encryption is the pattern that matters: KMS protects a data key, and the data key encrypts the payload, so bulk data never transits KMS. Key policies plus CloudTrail give you auditable control over who can decrypt what.",
  },
  // Storage
{
    id: "rds",
    label: "RDS",
    category: "database",
    icon: "Database",
    awsIcon: "rds",
    awsService: "Amazon Relational Database Service",
    concept: "sql-db",
    managed: true,
    // Throughput is instance-class dependent; 10,000 QPS models a mid-size
    // instance on a read-mostly OLTP workload. Scale reads with replicas.
    maxQPS: 10000,
    latencyMs: 5,
    scalable: false,
    stateful: true,
    description:
      "Managed relational database for PostgreSQL, MySQL, MariaDB, Oracle, and SQL Server — AWS handles backups, patching, and failover. Multi-AZ gives you a synchronous standby for high availability; read replicas (up to 5 for MySQL and PostgreSQL) scale reads but not writes. The write ceiling of a single primary is the constraint to name in an interview, and the reason to reach for sharding or DynamoDB at extreme scale.",
  },
  {
    id: "aurora",
    label: "Aurora",
    satisfies: ["sql-db"],
    category: "database",
    icon: "Database",
    awsIcon: "aurora",
    awsService: "Amazon Aurora",
    managed: true,
    // AWS positions Aurora MySQL at up to ~5x standard MySQL throughput;
    // figure models a large writer instance, not a published quota.
    maxQPS: 50000,
    latencyMs: 3,
    scalable: false,
    stateful: true,
    description:
      "MySQL- and PostgreSQL-compatible database with storage decoupled from compute, replicated six ways across three Availability Zones. Supports up to 15 low-lag read replicas and fails over in well under a minute. Aurora Serverless v2 scales capacity in fine-grained steps for spiky workloads, and Global Database gives cross-region reads with roughly one-second replication lag.",
  },
  {
    id: "documentdb",
    label: "DocumentDB",
    satisfies: ["nosql-db"],
    category: "database",
    icon: "Database",
    awsIcon: "documentdb",
    awsService: "Amazon DocumentDB",
    managed: true,
    // Instance-class dependent; models a mid-size instance.
    maxQPS: 20000,
    latencyMs: 5,
    scalable: false,
    stateful: true,
    description:
      "MongoDB-compatible document database with compute and storage decoupled, replicated six ways across three Availability Zones and scalable to 15 read replicas. Fits JSON-shaped domain data where you want Mongo's query model without operating Mongo yourself. Compatibility covers a defined subset of the MongoDB API, which is the caveat worth stating.",
  },
{
    id: "dynamodb",
    label: "DynamoDB",
    satisfies: ["distributed-lock", "sharded-counter", "geospatial-index"],
    category: "database",
    icon: "HardDrive",
    awsIcon: "dynamodb",
    awsService: "Amazon DynamoDB",
    concept: "nosql-db",
    managed: true,
    // Source: default per-table quota is 40,000 read and 40,000 write capacity
    // units in most regions (soft limit, raisable).
    maxQPS: 40000,
    // Source: AWS documents single-digit millisecond latency at any scale.
    latencyMs: 5,
    scalable: true,
    stateful: true,
    description:
      "Serverless key-value and document database delivering single-digit millisecond reads and writes at effectively any scale, with no instances to size. Partition key design is everything: a hot partition throttles regardless of provisioned capacity. Global tables give multi-region active-active writes, DAX adds a microsecond-latency cache, and streams let you fan changes out to Lambda.",
  },
{
    id: "elasticache",
    label: "ElastiCache",
    satisfies: ["distributed-lock", "sharded-counter"],
    category: "database",
    icon: "Zap",
    awsIcon: "elasticache",
    awsService: "Amazon ElastiCache",
    concept: "cache",
    managed: true,
    // A single modern Redis/Valkey node sustains on the order of 100k+ simple
    // ops/sec; cluster mode scales this across shards.
    maxQPS: 100000,
    // Source: in-memory access is sub-millisecond; 1ms models the network hop.
    latencyMs: 1,
    scalable: true,
    stateful: true,
    description:
      "Managed in-memory cache running Redis, Valkey, or Memcached, used to absorb read traffic before it reaches the database and to hold sessions, leaderboards, and rate-limiter counters. Cluster mode shards across nodes for horizontal scale; replicas plus Multi-AZ cover failover. The interview substance is eviction policy, TTLs, and how you avoid a thundering herd when a hot key expires.",
  },
{
    id: "s3",
    label: "S3",
    category: "storage",
    icon: "Archive",
    awsIcon: "s3",
    awsService: "Amazon Simple Storage Service",
    concept: "object-storage",
    managed: true,
    // Source: at least 5,500 GET/HEAD requests per second per partitioned
    // prefix (3,500 for PUT/COPY/POST/DELETE). Scales linearly with prefixes,
    // which is exactly why key design matters.
    maxQPS: 5500,
    // Source: first-byte latency for Standard is typically 100-200ms; small
    // objects served via CloudFront are far faster.
    latencyMs: 100,
    scalable: true,
    stateful: true,
    description:
      "Object storage with eleven nines of durability, holding images, video, backups, logs, and data-lake files at effectively unlimited scale. Request rates scale per prefix — 5,500 GET/s each — so spreading keys across prefixes is how you scale a hot bucket. Storage classes (Standard, Infrequent Access, Glacier tiers) plus lifecycle rules are the standard cost answer, and it pairs with CloudFront to serve reads at the edge.",
  },
{
    id: "opensearch",
    label: "OpenSearch",
    satisfies: ["vector-db"],
    category: "analytics",
    icon: "Search",
    awsIcon: "opensearch",
    awsService: "Amazon OpenSearch Service",
    concept: "search",
    managed: true,
    // Cluster throughput depends on instance count and shard layout; models a
    // mid-size cluster rather than a published quota.
    maxQPS: 30000,
    latencyMs: 30,
    scalable: true,
    stateful: true,
    description:
      "Managed search and analytics engine (the Elasticsearch fork) powering full-text search, faceted filtering, autocomplete, and log analytics. Data is sharded and replicated across nodes; shard sizing and mapping design decide performance. Also serves vector search for semantic and retrieval-augmented workloads, so it often doubles as the vector store in an AWS design.",
  },
  {
    id: "athena",
    label: "Athena",
    satisfies: ["data-warehouse"],
    category: "analytics",
    icon: "Search",
    awsIcon: "athena",
    awsService: "Amazon Athena",
    managed: true,
    // Source: default 20-25 concurrent DML queries per account (soft limit).
    maxQPS: 25,
    // Interactive queries over S3 typically take seconds.
    latencyMs: 2000,
    scalable: true,
    stateful: false,
    description:
      "Serverless SQL directly over files in S3 — no cluster to run, billed per terabyte scanned. Partitioning and columnar formats like Parquet are what keep both latency and cost down, since you pay for bytes read. Ideal for ad-hoc analysis and infrequent queries where a always-on warehouse would be wasteful.",
  },
  {
    id: "glue",
    label: "Glue",
    category: "analytics",
    icon: "GitBranch",
    awsIcon: "glue",
    awsService: "AWS Glue",
    managed: true,
    // Batch ETL service; throughput is job-shaped, not request-shaped.
    maxQPS: 100,
    latencyMs: 5000,
    scalable: true,
    stateful: false,
    description:
      "Serverless ETL plus a data catalog: crawlers infer schemas from S3 and register tables that Athena, Redshift Spectrum, and EMR all query. Jobs run Spark under the hood to clean, join, and reshape data on a schedule or trigger. The catalog is often the more important half — it is the shared metadata layer for the lake.",
  },
  // Messaging
{
    id: "sqs",
    label: "SQS",
    category: "integration",
    icon: "MessageSquare",
    awsIcon: "sqs",
    awsService: "Amazon Simple Queue Service",
    concept: "message-queue",
    managed: true,
    // Source: standard queues support nearly unlimited transactions per second;
    // FIFO queues are capped at 300 messages/s (3,000 with batching).
    maxQPS: 100000,
    latencyMs: 10,
    scalable: true,
    stateful: true,
    description:
      "Fully managed queue that decouples producers from consumers and absorbs traffic spikes so a slow downstream service degrades instead of failing. Standard queues give near-unlimited throughput with at-least-once delivery and best-effort ordering; FIFO queues guarantee exactly-once processing and ordering but cap at 300 messages/second (3,000 batched). Dead-letter queues catch messages that repeatedly fail, and visibility timeout is the knob interviewers probe.",
  },
  // Infrastructure
{
    id: "app-mesh",
    label: "App Mesh",
    category: "integration",
    icon: "Compass",
    awsIcon: "app-mesh",
    awsService: "AWS App Mesh",
    managed: true,
    // Control plane distributing config to Envoy sidecars; the sidecar adds
    // low-single-digit ms to each hop rather than capping throughput.
    maxQPS: 100000,
    latencyMs: 2,
    scalable: true,
    stateful: false,
    description:
      "Service mesh that puts an Envoy sidecar beside each service to standardize retries, timeouts, circuit breaking, mTLS, and traffic shifting — moving that logic out of application code and into the platform. Gives uniform observability across services regardless of language. Justified once you have enough services that per-service reimplementation of these concerns becomes the problem.",
  },
{
    id: "cloudwatch",
    label: "CloudWatch",
    category: "observability",
    icon: "Activity",
    awsIcon: "cloudwatch",
    awsService: "Amazon CloudWatch",
    concept: "monitoring",
    managed: true,
    // Ingestion scales with the account; telemetry is off the request path.
    maxQPS: 100000,
    latencyMs: 0,
    scalable: true,
    stateful: true,
    description:
      "Collects metrics, logs, and alarms across AWS services and your own applications, driving dashboards, autoscaling policies, and incident alerts. Logs Insights queries log data ad hoc; custom metrics and embedded metric format cover application-level signals. Alarms wired to SNS or Auto Scaling are what turn observability into automated response.",
  },
  {
    id: "xray",
    label: "X-Ray",
    satisfies: ["monitoring"],
    category: "observability",
    icon: "Activity",
    awsIcon: "xray",
    awsService: "AWS X-Ray",
    managed: true,
    // Sampled tracing; overhead is negligible and off the critical path.
    maxQPS: 100000,
    latencyMs: 0,
    scalable: true,
    stateful: true,
    description:
      "Distributed tracing that follows a single request across services and shows where its latency actually went, with a service map of dependencies and error rates. Sampling keeps overhead and cost low at high traffic. The right answer when asked how you would debug a slow request in a microservice architecture.",
  },
  // Real-time
{
    id: "appsync",
    label: "AppSync",
    category: "integration",
    icon: "Waves",
    awsIcon: "appsync",
    awsService: "AWS AppSync",
    concept: "websocket-server",
    managed: true,
    // Source: default 10,000 requests/second per API (soft limit); subscription
    // connections are quota'd separately.
    maxQPS: 10000,
    latencyMs: 20,
    scalable: true,
    stateful: true,
    description:
      "Managed GraphQL service with real-time subscriptions over WebSockets, pushing updates to connected clients without you running a socket fleet or tracking connections. Resolves fields against DynamoDB, Lambda, RDS, or HTTP sources and merges them into one response. The AWS-native answer for live feeds, chat, collaborative editing, and presence.",
  },
{
    id: "eventbridge-scheduler",
    label: "EventBridge Scheduler",
    category: "integration",
    icon: "Clock",
    awsIcon: "eventbridge-scheduler",
    awsService: "Amazon EventBridge Scheduler",
    concept: "task-scheduler",
    managed: true,
    // A scheduler is not a request-path component; this models invocation
    // throughput rather than a published request quota.
    maxQPS: 1000,
    latencyMs: 10,
    scalable: true,
    stateful: true,
    description:
      "Managed scheduler that invokes targets on a cron expression, a fixed rate, or a one-time future timestamp, scaling to millions of independent schedules. Replaces the classic 'cron box' single point of failure and can trigger Lambda, Step Functions, SQS, and hundreds of other API targets directly. Use it for digests, retries, billing runs, and reminders.",
  },
{
    id: "kinesis",
    label: "Kinesis",
    satisfies: ["pub-sub"],
    category: "analytics",
    icon: "Waves",
    awsIcon: "kinesis",
    awsService: "Amazon Kinesis Data Streams",
    concept: "stream-processor",
    managed: true,
    // Source: each shard ingests 1 MB/s or 1,000 records/second; capacity is
    // shard count x 1,000, so 100 shards models 100,000 records/second.
    maxQPS: 100000,
    latencyMs: 20,
    scalable: true,
    stateful: true,
    description:
      "Ordered, replayable stream that many independent consumers can read at their own pace, retaining data from 24 hours up to 365 days. Throughput scales with shards — 1 MB/s or 1,000 records per second each — and the partition key decides ordering and hot-shard risk. Choose it over SQS when you need replay, ordering within a key, or multiple consumers over the same events.",
  },
  {
    id: "firehose",
    label: "Firehose",
    satisfies: ["stream-processor"],
    category: "analytics",
    icon: "Waves",
    awsIcon: "firehose",
    awsService: "Amazon Data Firehose",
    managed: true,
    // Source: default delivery-stream quota is 5,000 records/second in many
    // regions, scaling automatically on request (varies by region).
    maxQPS: 50000,
    // Buffers before delivery, so end-to-end latency is seconds, not ms.
    latencyMs: 1000,
    scalable: true,
    stateful: false,
    description:
      "Batches, optionally transforms, compresses, and delivers streaming data into S3, Redshift, OpenSearch, or third-party sinks with no code to run. Buffering means delivery latency is measured in seconds, which is the tradeoff against Kinesis Data Streams. The standard pipe for getting logs and events into a data lake.",
  },
  {
    id: "msk",
    label: "MSK",
    satisfies: ["message-queue", "pub-sub", "stream-processor"],
    category: "analytics",
    icon: "Radio",
    awsIcon: "msk",
    awsService: "Amazon Managed Streaming for Apache Kafka",
    managed: true,
    // Cluster throughput scales with broker count and partitions; models a
    // mid-size cluster rather than a published quota.
    maxQPS: 200000,
    latencyMs: 15,
    scalable: true,
    stateful: true,
    description:
      "Managed Apache Kafka — real Kafka brokers, so existing Kafka clients, Connect plugins, and Streams applications work unchanged. Choose it over Kinesis when you need the Kafka ecosystem, longer retention with compaction, or portability off AWS. The cost is operating a cluster concept (brokers, partitions, replication factor) that Kinesis hides.",
  },
{
    id: "sns",
    label: "SNS",
    satisfies: ["pub-sub"],
    category: "integration",
    icon: "Bell",
    awsIcon: "sns",
    awsService: "Amazon Simple Notification Service",
    concept: "notification-service",
    managed: true,
    // Source: standard topics support 30,000 publishes/second in large regions
    // (soft limit, varies by region).
    maxQPS: 30000,
    latencyMs: 10,
    scalable: true,
    stateful: false,
    description:
      "Pub/sub messaging that fans one published message out to many subscribers — SQS queues, Lambda functions, HTTP endpoints, email, and SMS. The canonical fan-out pattern is SNS in front of several SQS queues, giving each consumer its own buffered, independently-retried stream. Use it when several systems must react to the same event.",
  },
  // Advanced Storage
{
    id: "neptune",
    label: "Neptune",
    category: "database",
    icon: "Share2",
    awsIcon: "neptune",
    awsService: "Amazon Neptune",
    concept: "graph-db",
    managed: true,
    // Instance-class dependent; models a mid-size instance on traversal-heavy
    // queries rather than a published quota.
    maxQPS: 20000,
    latencyMs: 10,
    scalable: false,
    stateful: true,
    description:
      "Managed graph database supporting Gremlin, openCypher, and SPARQL, purpose-built for highly connected data — social graphs, fraud rings, recommendations, knowledge graphs. Traversals that would be many-way self-joins in SQL become first-class operations. Reach for it when relationships are the query, not an afterthought.",
  },
{
    id: "timestream",
    label: "Timestream",
    satisfies: ["data-warehouse"],
    category: "database",
    icon: "TrendingUp",
    awsIcon: "timestream",
    awsService: "Amazon Timestream",
    concept: "timeseries-db",
    managed: true,
    // Serverless ingestion scales automatically; figure is a modeling ceiling.
    maxQPS: 50000,
    latencyMs: 10,
    scalable: true,
    stateful: true,
    description:
      "Serverless time-series database that tiers recent data in memory and older data to cheaper magnetic storage automatically, with built-in interpolation and smoothing functions. Built for IoT telemetry, application metrics, and operational analytics where every row is timestamped and queries are windowed. Note it is not available in every region — a real constraint for multi-region designs.",
  },
{
    id: "redshift",
    label: "Redshift",
    satisfies: ["data-warehouse"],
    category: "analytics",
    icon: "Warehouse",
    awsIcon: "redshift",
    awsService: "Amazon Redshift",
    concept: "data-warehouse",
    managed: true,
    // Analytical warehouses run few, heavy queries; concurrency, not QPS, is
    // the real limit. Figure models sustained analytical query concurrency.
    maxQPS: 500,
    // Analytical scans take hundreds of ms to seconds, not single-digit ms.
    latencyMs: 500,
    scalable: true,
    stateful: true,
    description:
      "Columnar data warehouse for analytical queries over billions of rows, with compression, zone maps, and massively parallel execution across nodes. Distribution and sort keys are the performance levers. Never put it on a user request path — it answers dashboards and reports, while OLTP traffic belongs on RDS, Aurora, or DynamoDB.",
  },
  // Infrastructure
{
    id: "cloud-map",
    label: "Cloud Map",
    satisfies: ["coordination-service"],
    category: "observability",
    icon: "Compass",
    awsIcon: "cloud-map",
    awsService: "AWS Cloud Map",
    concept: "service-discovery",
    managed: true,
    // Discovery happens at connection setup, not per request.
    maxQPS: 100000,
    latencyMs: 1,
    scalable: true,
    stateful: true,
    description:
      "Service registry where instances register their locations and clients resolve healthy endpoints by name over DNS or API, with unhealthy instances removed automatically. ECS registers tasks here natively, so scaling a service updates discovery without redeploying callers. The alternative to hardcoding endpoints or maintaining your own registry.",
  },
  {
    id: "reverse-proxy",
    label: "Reverse Proxy",
    category: "pattern",
    icon: "Shield",
    concept: "reverse-proxy",
    managed: false,
    maxQPS: 100000,
    latencyMs: 1,
    scalable: true,
    stateful: false,
    description:
      "Sits between clients and backend servers to handle SSL termination, request routing, caching, compression, and security filtering. Unlike a load balancer, it can also serve cached content, rewrite URLs, and add security headers. Nginx, Envoy, Cloudflare, and AWS CloudFront function as reverse proxies.",
  },
  {
    id: "distributed-lock",
    label: "Distributed Lock",
    category: "pattern",
    icon: "Lock",
    concept: "distributed-lock",
    managed: false,
    maxQPS: 10000,
    latencyMs: 5,
    scalable: false,
    stateful: true,
    description:
      "Provides mutual exclusion across distributed systems to prevent race conditions in critical sections like inventory updates, leader election, and distributed transactions. Redis Redlock, Apache ZooKeeper recipes, and etcd lease-based locks are common implementations with trade-offs between safety and liveness.",
  },
  {
    id: "circuit-breaker",
    label: "Circuit Breaker",
    category: "pattern",
    icon: "ShieldOff",
    concept: "circuit-breaker",
    managed: false,
    maxQPS: 100000,
    latencyMs: 1,
    scalable: true,
    stateful: true,
    description:
      "Prevents cascading failures by monitoring downstream service health and short-circuiting requests when failure rates exceed a threshold. Implements three states: closed (normal), open (failing, reject immediately), and half-open (testing recovery). Netflix Hystrix popularized the pattern; Resilience4j, Envoy, and Istio provide modern implementations.",
  },
{
    id: "efs",
    label: "EFS",
    satisfies: ["object-storage"],
    category: "storage",
    icon: "FolderOpen",
    awsIcon: "efs",
    awsService: "Amazon Elastic File System",
    concept: "file-store",
    managed: true,
    // Source: General Purpose mode supports up to 35,000 read IOPS
    // (higher with Elastic Throughput).
    maxQPS: 35000,
    latencyMs: 3,
    scalable: true,
    stateful: true,
    description:
      "Elastic NFS file system that many EC2 instances, containers, or Lambda functions can mount at once, growing and shrinking automatically. Use it when workloads genuinely need POSIX file semantics and shared mutable state — legacy applications, content management, shared uploads. If objects would do, S3 is cheaper and scales further.",
  },
  {
    id: "origin-shield",
    label: "Origin Shield",
    category: "pattern",
    icon: "ShieldCheck",
    concept: "origin-shield",
    managed: false,
    maxQPS: 200000,
    latencyMs: 5,
    scalable: true,
    stateful: false,
    description:
      "An additional caching layer between CDN edge locations and the origin server that reduces origin load by collapsing duplicate requests from multiple edge PoPs into a single origin fetch. Reduces origin bandwidth by 50-90% for popular content. AWS CloudFront Origin Shield, Cloudflare Tiered Cache, and Fastly Shield PoPs are implementations.",
  },
  {
    id: "coordination-service",
    label: "Coordination Service",
    category: "pattern",
    icon: "Users",
    concept: "coordination-service",
    managed: false,
    maxQPS: 20000,
    latencyMs: 5,
    scalable: true,
    stateful: true,
    description:
      "Provides distributed coordination primitives: leader election, configuration management, distributed barriers, and group membership. Built on consensus protocols (Raft/ZAB) for strong consistency. Apache ZooKeeper, etcd, and Consul are the primary implementations. Essential for distributed systems that need agreement on shared state.",
  },
  {
    id: "custom",
    label: "Custom Component",
    category: "compute",
    icon: "Box",
    maxQPS: 50000,
    latencyMs: 10,
    scalable: true,
    stateful: false,
    description:
      "A generic component that can be renamed to represent any service, system, or infrastructure not available in the predefined component library. Double-click the node label on the canvas to rename it. Use this for specialized services like ML inference engines, recommendation services, fraud detection, content moderation, or any domain-specific component.",
  },
  // ID & Counting
  {
    id: "id-generator",
    label: "ID Generator",
    category: "pattern",
    icon: "Fingerprint",
    concept: "id-generator",
    managed: false,
    maxQPS: 500000,
    latencyMs: 1,
    scalable: true,
    stateful: true,
    description:
      "Generates globally unique, sortable IDs across distributed nodes using algorithms like Twitter Snowflake, ULID, or UUID. Each node embeds a timestamp, machine ID, and sequence number to guarantee uniqueness without centralized coordination. Essential for database primary keys, URL shortening, event ordering, and sharding keys.",
  },
  {
    id: "sharded-counter",
    label: "Sharded Counter",
    category: "pattern",
    icon: "Hash",
    concept: "sharded-counter",
    managed: false,
    maxQPS: 500000,
    latencyMs: 2,
    scalable: true,
    stateful: true,
    description:
      "Distributes a single logical counter across multiple shards to avoid hot-key bottlenecks under massive concurrent writes. Reads aggregate across shards with eventual consistency. Critical for like counts, view counters, follower counts, and real-time voting at scale. Typically backed by Redis or purpose-built counter tables with periodic reconciliation.",
  },
  // Messaging
{
    id: "eventbridge",
    label: "EventBridge",
    satisfies: ["notification-service"],
    category: "integration",
    icon: "Radio",
    awsIcon: "eventbridge",
    awsService: "Amazon EventBridge",
    concept: "pub-sub",
    managed: true,
    // Source: default PutEvents quota is 10,000 requests/second in the largest
    // regions (soft limit, varies by region).
    maxQPS: 10000,
    latencyMs: 20,
    scalable: true,
    stateful: false,
    description:
      "Serverless event bus that routes events from your applications, AWS services, and SaaS partners to targets using content-based rules matched on the event payload. Unlike SNS, routing is declarative and filtering happens on message content, so adding a consumer needs no producer change. The backbone of event-driven architectures where publishers should know nothing about subscribers.",
  },
  {
    id: "step-functions",
    label: "Step Functions",
    satisfies: ["task-scheduler"],
    category: "integration",
    icon: "GitBranch",
    awsIcon: "step-functions",
    awsService: "AWS Step Functions",
    managed: true,
    // Source: Standard workflows start at 2,000 executions/second; Express
    // workflows support 100,000 executions/second.
    maxQPS: 2000,
    latencyMs: 25,
    scalable: true,
    stateful: true,
    description:
      "Orchestrates multi-step workflows as an explicit state machine with retries, error handling, parallel branches, and human approval steps — the coordination logic lives in the workflow rather than scattered across services. Standard workflows are durable and run up to a year; Express workflows trade that for 100,000 executions/second on short, high-volume tasks. The clean answer to 'how do you manage a saga across services?'",
  },
  // Storage
  {
    id: "vector-db",
    label: "Vector Database",
    category: "pattern",
    icon: "Brain",
    concept: "vector-db",
    managed: false,
    maxQPS: 10000,
    latencyMs: 10,
    scalable: true,
    stateful: true,
    description:
      "Stores high-dimensional vector embeddings and performs approximate nearest-neighbor (ANN) search for similarity matching. Powers recommendation engines, semantic search, image search, and RAG-based AI systems. Pinecone, Weaviate, Milvus, Qdrant, and pgvector are leading implementations using HNSW or IVF indexing algorithms.",
  },
  {
    id: "geospatial-index",
    label: "Geospatial Index",
    category: "pattern",
    icon: "MapPin",
    concept: "geospatial-index",
    managed: false,
    maxQPS: 50000,
    latencyMs: 5,
    scalable: true,
    stateful: true,
    description:
      "Indexes and queries location data using geohash, quadtree, R-tree, or H3 hexagonal grids for efficient nearest-neighbor and radius searches. Essential for ride-sharing, food delivery, local search, and any proximity-based system. PostGIS, Redis GEO (GEOADD/GEOSEARCH), Elasticsearch geo_point, and Google S2 library are common implementations.",
  },
  // Infrastructure
{
    id: "appconfig",
    label: "AppConfig",
    satisfies: ["config-service"],
    category: "observability",
    icon: "Settings",
    awsIcon: "appconfig",
    awsService: "AWS AppConfig",
    concept: "config-service",
    managed: true,
    // Clients poll and cache; configuration is not fetched per request.
    maxQPS: 10000,
    latencyMs: 5,
    scalable: true,
    stateful: true,
    description:
      "Manages feature flags and dynamic configuration separately from deployments, validating changes and rolling them out gradually with automatic rollback on a CloudWatch alarm. Lets you ship code dark and enable it per segment without redeploying. The controlled-rollout half is what distinguishes it from stuffing config in environment variables.",
  },
];

/**
 * Single source of truth for per-category color. ComponentNode and
 * ComponentPalette both render from this — they previously kept separate,
 * drifting copies of the same information.
 */
export const CATEGORY_STYLE: Record<
  ComponentCategory,
  { label: string; chip: string; icon: string; ring: string }
> = {
  networking: { label: "Networking", chip: "bg-blue-500/10", icon: "text-blue-400", ring: "ring-blue-500/25" },
  compute: { label: "Compute", chip: "bg-violet-500/10", icon: "text-violet-400", ring: "ring-violet-500/25" },
  containers: { label: "Containers", chip: "bg-indigo-500/10", icon: "text-indigo-400", ring: "ring-indigo-500/25" },
  storage: { label: "Storage", chip: "bg-amber-500/10", icon: "text-amber-400", ring: "ring-amber-500/25" },
  database: { label: "Database", chip: "bg-sky-500/10", icon: "text-sky-400", ring: "ring-sky-500/25" },
  integration: { label: "Integration", chip: "bg-emerald-500/10", icon: "text-emerald-400", ring: "ring-emerald-500/25" },
  analytics: { label: "Analytics", chip: "bg-teal-500/10", icon: "text-teal-400", ring: "ring-teal-500/25" },
  security: { label: "Security", chip: "bg-rose-500/10", icon: "text-rose-400", ring: "ring-rose-500/25" },
  observability: { label: "Observability", chip: "bg-cyan-500/10", icon: "text-cyan-400", ring: "ring-cyan-500/25" },
  pattern: { label: "Patterns", chip: "bg-zinc-500/10", icon: "text-zinc-300", ring: "ring-zinc-500/25" },
  // Legacy keys — retained so nodes persisted before the AWS catalog keep their color.
  messaging: { label: "Messaging", chip: "bg-emerald-500/10", icon: "text-emerald-400", ring: "ring-emerald-500/25" },
  infrastructure: { label: "Infrastructure", chip: "bg-cyan-500/10", icon: "text-cyan-400", ring: "ring-cyan-500/25" },
};

/**
 * Categories shown as palette sections, in display order.
 *
 * Every catalog entry must use one of these, or its components silently
 * disappear from the palette — a hole that type-checking cannot see, so
 * `npm run check:catalog` enforces it. The legacy `messaging` and
 * `infrastructure` keys are intentionally absent here: no catalog entry uses
 * them any more, but they remain in CATEGORY_STYLE so nodes persisted before
 * the AWS catalog still render with color.
 */
export const COMPONENT_CATEGORIES = [
  "networking",
  "compute",
  "containers",
  "database",
  "storage",
  "integration",
  "analytics",
  "security",
  "observability",
  "pattern",
] as const satisfies readonly ComponentCategory[];
