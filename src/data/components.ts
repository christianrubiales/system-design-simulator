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
    id: "auth-service",
    label: "Auth Service",
    category: "compute",
    icon: "KeyRound",
    maxQPS: 10000,
    latencyMs: 15,
    scalable: true,
    stateful: false,
    description:
      "Dedicated authentication and authorization service that handles user login, token issuance (JWT/OAuth2), session management, and permission checks. Centralizing auth prevents security logic from being scattered across microservices. Examples include AWS Cognito, Auth0, Firebase Auth, and Google Cloud Identity Platform.",
  },
  // Storage
  {
    id: "sql-db",
    label: "SQL Database",
    category: "storage",
    icon: "Database",
    maxQPS: 10000,
    latencyMs: 8,
    scalable: false,
    stateful: true,
    description:
      "Relational database providing ACID transactions, strong consistency, and structured schemas with SQL queries. Best for data with complex relationships, joins, and strict integrity requirements (e.g., financial transactions, user accounts). Examples include Amazon RDS (PostgreSQL/MySQL), Google Cloud SQL, and Amazon Aurora.",
  },
  {
    id: "nosql-db",
    label: "NoSQL Database",
    category: "storage",
    icon: "HardDrive",
    maxQPS: 50000,
    latencyMs: 3,
    scalable: true,
    stateful: true,
    description:
      "Non-relational database optimized for flexible schemas, horizontal scaling, and high-throughput workloads. Choose it when you need low-latency key-value lookups, wide-column storage, or document-oriented data without complex joins. Amazon DynamoDB, Google Cloud Bigtable, MongoDB Atlas, and Apache Cassandra are widely used.",
  },
  {
    id: "cache",
    label: "Cache / Redis",
    category: "storage",
    icon: "Zap",
    maxQPS: 100000,
    latencyMs: 1,
    scalable: true,
    stateful: true,
    description:
      "In-memory data store delivering sub-millisecond read latency for frequently accessed data, session storage, leaderboards, and real-time counters. Placing a cache between your app servers and database can reduce DB load by 80-90% for read-heavy workloads. Amazon ElastiCache (Redis/Memcached) and Google Cloud Memorystore are managed options.",
  },
  {
    id: "object-storage",
    label: "Object Storage",
    category: "storage",
    icon: "Archive",
    awsIcon: "s3",
    awsService: "Amazon Simple Storage Service",
    maxQPS: 25000,
    latencyMs: 75,
    scalable: true,
    stateful: true,
    description:
      "Highly durable blob/object storage for unstructured data like images, videos, backups, and static website assets. Offers virtually unlimited capacity with 99.999999999% (11 nines) durability. Amazon S3, Google Cloud Storage, and Azure Blob Storage are the industry standards, often paired with a CDN for fast delivery.",
  },
  {
    id: "search",
    label: "Search / ES",
    category: "storage",
    icon: "Search",
    maxQPS: 20000,
    latencyMs: 10,
    scalable: true,
    stateful: true,
    description:
      "Full-text search engine that indexes and queries large volumes of text with features like fuzzy matching, faceted search, and relevance scoring. Use it when users need to search across product catalogs, logs, or content feeds. Elasticsearch (Amazon OpenSearch), Apache Solr, and Google Cloud Search are common choices.",
  },
  // Messaging
  {
    id: "message-queue",
    label: "Message Queue",
    category: "messaging",
    icon: "MessageSquare",
    maxQPS: 100000,
    latencyMs: 5,
    scalable: true,
    stateful: true,
    description:
      "Asynchronous message broker that decouples producers from consumers, enabling reliable background processing, event-driven architectures, and traffic spike buffering. Critical for any workflow where synchronous processing would create bottlenecks or coupling. Apache Kafka, Amazon SQS/SNS, Google Cloud Pub/Sub, and RabbitMQ are widely adopted.",
  },
  // Infrastructure
  {
    id: "service-mesh",
    label: "Service Mesh",
    category: "infrastructure",
    icon: "GitBranch",
    maxQPS: 80000,
    latencyMs: 2,
    scalable: true,
    stateful: false,
    description:
      "Transparent service-to-service communication layer that handles mutual TLS, retries, circuit breaking, load balancing, and distributed tracing between microservices. Use it when your microservice count grows beyond what manual configuration can manage. Istio, Linkerd, and AWS App Mesh are leading implementations.",
  },
  {
    id: "monitoring",
    label: "Monitoring",
    category: "infrastructure",
    icon: "Activity",
    maxQPS: 500000,
    latencyMs: 5,
    scalable: true,
    stateful: true,
    description:
      "Observability stack for metrics collection, centralized logging, distributed tracing, and alerting. Every production system needs monitoring to detect outages, track SLOs, and debug performance issues. Prometheus + Grafana, AWS CloudWatch, Google Cloud Monitoring, Datadog, and the ELK stack are standard tools.",
  },
  // Real-time
  {
    id: "websocket-server",
    label: "WebSocket Server",
    category: "compute",
    icon: "Radio",
    maxQPS: 50000,
    latencyMs: 2,
    scalable: true,
    stateful: true,
    description:
      "Maintains persistent bidirectional connections for real-time communication. Essential for chat apps, live notifications, collaborative editing, and gaming. Libraries like Socket.io and managed services like AWS API Gateway WebSocket APIs or Pusher handle millions of concurrent connections, with connection-to-server mapping stored in Redis.",
  },
  {
    id: "task-scheduler",
    label: "Task Scheduler",
    category: "compute",
    icon: "Clock",
    maxQPS: 10000,
    latencyMs: 50,
    scalable: true,
    stateful: false,
    description:
      "Manages delayed, scheduled, and recurring background jobs with retry logic and dead-letter queues. Critical for email campaigns, report generation, data pipelines, and cleanup tasks. Celery, AWS Step Functions, Google Cloud Tasks, and Temporal are common implementations.",
  },
  {
    id: "stream-processor",
    label: "Stream Processor",
    category: "compute",
    icon: "Waves",
    maxQPS: 200000,
    latencyMs: 10,
    scalable: true,
    stateful: true,
    description:
      "Processes continuous data streams in real-time for analytics, event processing, and ETL pipelines. Handles windowed aggregations, joins, and transformations on unbounded data. Apache Kafka Streams, Apache Flink, Spark Streaming, and AWS Kinesis Data Analytics are industry standards.",
  },
  {
    id: "notification-service",
    label: "Notification Service",
    category: "compute",
    icon: "Bell",
    maxQPS: 50000,
    latencyMs: 100,
    scalable: true,
    stateful: false,
    description:
      "Orchestrates multi-channel delivery of push notifications, emails, SMS, and in-app messages with priority queuing, template rendering, and delivery tracking. Firebase Cloud Messaging, AWS SNS/SES, Twilio, and OneSignal handle billions of notifications daily with device token management.",
  },
  // Advanced Storage
  {
    id: "graph-db",
    label: "Graph Database",
    category: "storage",
    icon: "Share2",
    maxQPS: 8000,
    latencyMs: 15,
    scalable: true,
    stateful: true,
    description:
      "Stores and queries highly connected data using nodes, edges, and properties — optimized for relationship traversals like friend-of-friend queries, recommendation engines, and fraud detection. Neo4j, Amazon Neptune, and JanusGraph significantly outperform relational joins for multi-hop traversals.",
  },
  {
    id: "timeseries-db",
    label: "Time-Series DB",
    category: "storage",
    icon: "TrendingUp",
    maxQPS: 100000,
    latencyMs: 3,
    scalable: true,
    stateful: true,
    description:
      "Optimized for ingesting and querying time-stamped data with built-in downsampling, retention policies, and time-windowed aggregations. Essential for monitoring metrics, IoT sensor data, and financial tick data. InfluxDB, TimescaleDB, Amazon Timestream, and Prometheus TSDB are purpose-built for this workload.",
  },
  {
    id: "data-warehouse",
    label: "Data Warehouse",
    category: "storage",
    icon: "Warehouse",
    maxQPS: 50,
    latencyMs: 5000,
    scalable: true,
    stateful: true,
    description:
      "Columnar analytical database designed for complex queries across terabytes/petabytes of historical data. Separates analytics from operational databases to prevent query load from impacting production. Google BigQuery, Amazon Redshift, Snowflake, and ClickHouse support SQL analytics at massive scale.",
  },
  // Infrastructure
  {
    id: "service-discovery",
    label: "Service Discovery",
    category: "infrastructure",
    icon: "Compass",
    maxQPS: 50000,
    latencyMs: 1,
    scalable: true,
    stateful: true,
    description:
      "Enables microservices to find and communicate with each other dynamically without hardcoded addresses. Handles service registration, health checking, and DNS-based or API-based lookups. HashiCorp Consul, Apache ZooKeeper, etcd, and AWS Cloud Map are widely used for service mesh coordination.",
  },
  {
    id: "reverse-proxy",
    label: "Reverse Proxy",
    category: "networking",
    icon: "Shield",
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
    category: "infrastructure",
    icon: "Lock",
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
    category: "infrastructure",
    icon: "ShieldOff",
    maxQPS: 100000,
    latencyMs: 1,
    scalable: true,
    stateful: true,
    description:
      "Prevents cascading failures by monitoring downstream service health and short-circuiting requests when failure rates exceed a threshold. Implements three states: closed (normal), open (failing, reject immediately), and half-open (testing recovery). Netflix Hystrix popularized the pattern; Resilience4j, Envoy, and Istio provide modern implementations.",
  },
  {
    id: "file-store",
    label: "File Store",
    category: "storage",
    icon: "FolderOpen",
    maxQPS: 10000,
    latencyMs: 10,
    scalable: true,
    stateful: true,
    description:
      "Network-attached file storage providing POSIX-compatible file system semantics for shared access across multiple compute instances. Supports hierarchical directories, file locking, and concurrent reads/writes. Amazon EFS, Google Cloud Filestore, and Azure Files are managed options. Use when applications need a traditional file system interface rather than object/blob APIs.",
  },
  {
    id: "origin-shield",
    label: "Origin Shield",
    category: "networking",
    icon: "ShieldCheck",
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
    category: "infrastructure",
    icon: "Users",
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
    category: "infrastructure",
    icon: "Fingerprint",
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
    category: "infrastructure",
    icon: "Hash",
    maxQPS: 500000,
    latencyMs: 2,
    scalable: true,
    stateful: true,
    description:
      "Distributes a single logical counter across multiple shards to avoid hot-key bottlenecks under massive concurrent writes. Reads aggregate across shards with eventual consistency. Critical for like counts, view counters, follower counts, and real-time voting at scale. Typically backed by Redis or purpose-built counter tables with periodic reconciliation.",
  },
  // Messaging
  {
    id: "pub-sub",
    label: "Pub/Sub",
    category: "messaging",
    icon: "Megaphone",
    maxQPS: 200000,
    latencyMs: 5,
    scalable: true,
    stateful: true,
    description:
      "Topic-based publish/subscribe messaging where each message is broadcast to all subscribers, unlike point-to-point queues where each message is consumed by one consumer. Enables event-driven fan-out for feeds, analytics pipelines, CDC, and cross-service event propagation. Google Cloud Pub/Sub, AWS SNS, and Apache Kafka topics are canonical implementations.",
  },
  // Storage
  {
    id: "vector-db",
    label: "Vector Database",
    category: "storage",
    icon: "Brain",
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
    category: "storage",
    icon: "MapPin",
    maxQPS: 50000,
    latencyMs: 5,
    scalable: true,
    stateful: true,
    description:
      "Indexes and queries location data using geohash, quadtree, R-tree, or H3 hexagonal grids for efficient nearest-neighbor and radius searches. Essential for ride-sharing, food delivery, local search, and any proximity-based system. PostGIS, Redis GEO (GEOADD/GEOSEARCH), Elasticsearch geo_point, and Google S2 library are common implementations.",
  },
  // Infrastructure
  {
    id: "config-service",
    label: "Config Service",
    category: "infrastructure",
    icon: "Settings",
    maxQPS: 50000,
    latencyMs: 2,
    scalable: true,
    stateful: true,
    description:
      "Centralized dynamic configuration management for feature flags, A/B test parameters, and runtime settings without redeployment. Supports versioning, rollback, targeted rollouts by user segment, and real-time propagation to all service instances. AWS AppConfig, LaunchDarkly, Unleash, and etcd-backed config stores are common implementations.",
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
 * `messaging` and `infrastructure` are legacy keys still carried by catalog
 * entries that have not been converted to AWS services yet. They MUST stay
 * listed until every entry is recategorized, or their components silently
 * disappear from the palette — a hole that type-checking cannot see.
 * Remove them once no entry uses them (`npm run check:catalog` enforces this).
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
  "messaging",
  "infrastructure",
] as const satisfies readonly ComponentCategory[];
