export type AwsCategory =
  | "networking"
  | "compute"
  | "containers"
  | "storage"
  | "database"
  | "integration"
  | "analytics"
  | "security"
  | "observability"
  | "pattern";

/** Legacy category strings kept so pre-AWS persisted nodes still render with color. */
export type LegacyCategory = "messaging" | "infrastructure";

export type ComponentCategory = AwsCategory | LegacyCategory;

/** The generic vocabulary the interview content layer speaks. */
export type Concept =
  | "dns"
  | "cdn"
  | "load-balancer"
  | "api-gateway"
  | "rate-limiter"
  | "app-server"
  | "auth-service"
  | "sql-db"
  | "nosql-db"
  | "cache"
  | "object-storage"
  | "search"
  | "message-queue"
  | "service-mesh"
  | "monitoring"
  | "websocket-server"
  | "task-scheduler"
  | "stream-processor"
  | "notification-service"
  | "graph-db"
  | "timeseries-db"
  | "data-warehouse"
  | "service-discovery"
  | "reverse-proxy"
  | "distributed-lock"
  | "circuit-breaker"
  | "file-store"
  | "origin-shield"
  | "coordination-service"
  | "id-generator"
  | "sharded-counter"
  | "pub-sub"
  | "vector-db"
  | "geospatial-index"
  | "config-service";

export interface SystemComponent {
  id: string;
  label: string;
  category: ComponentCategory;
  icon: string; // lucide icon name — fallback when awsIcon is absent
  /** Basename in public/aws-icons/, without extension. Absent for patterns and custom. */
  awsIcon?: string;
  /** Full AWS product name, e.g. "Amazon Elastic Compute Cloud". */
  awsService?: string;
  /** Bridge to the generic vocabulary. Absent for AWS-only services. */
  concept?: Concept;
  /**
   * Architectural roles this service can fill, beyond its own `concept`.
   * Scoring matches on these, so Aurora counts as a SQL database and MSK
   * counts as both a queue and a pub/sub bus. Without this, choosing a better
   * AWS service than the default would score zero.
   */
  satisfies?: Concept[];
  /** AWS-managed vs self-run. Consumed by blended scoring in sub-project 7. */
  managed?: boolean;
  maxQPS: number;
  latencyMs: number;
  scalable: boolean;
  stateful: boolean;
  description: string;
}
