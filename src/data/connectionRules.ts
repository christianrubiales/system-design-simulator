import { resolveComponentId } from "@/data/conceptMap";

/**
 * Kinds of traffic that can flow along an edge.
 *
 * These describe TRAFFIC FLOW, not who opens the TCP connection. A consumer
 * polls SQS, but every architecture diagram draws SQS -> consumer, and
 * `simulator.ts` already pushes QPS in that direction. Initiator semantics
 * would flag a large share of the reference solutions as backwards.
 */
export type PortType =
  | "http"
  | "dns"
  | "database"
  | "cache"
  | "storage"
  | "queue"
  | "topic"
  | "event"
  | "stream"
  | "search"
  | "analytics"
  | "identity"
  | "observability"
  | "workflow"
  | "compute"
  | "network";

export interface ServicePorts {
  /** Traffic kinds this service can receive. */
  accepts?: PortType[];
  /** Traffic kinds this service can send. */
  emits?: PortType[];
}

/**
 * Port declarations, keyed by catalog service id.
 *
 * Kept here rather than on each `SystemComponent` so the whole model is
 * reviewable in one place and adding a service's ports does not touch the
 * catalog. Pattern nodes and `custom` are deliberately absent: absence means
 * "unknown", never "invalid".
 */
export const SERVICE_PORTS: Record<string, ServicePorts> = {
  // --- Networking ---
  route53: { accepts: ["dns"], emits: ["http", "dns"] },
  cloudfront: { accepts: ["http"], emits: ["http", "storage", "observability"] },
  alb: { accepts: ["http"], emits: ["http", "compute", "observability"] },
  nlb: { accepts: ["http", "network"], emits: ["http", "compute", "network"] },
  "api-gateway": {
    accepts: ["http"],
    emits: ["http", "compute", "identity", "workflow", "queue", "topic", "observability"],
  },
  vpc: { accepts: ["network"], emits: ["network"] },
  "nat-gateway": { accepts: ["network"], emits: ["http", "network"] },
  privatelink: { accepts: ["network", "http"], emits: ["http", "network"] },
  "global-accelerator": { accepts: ["http", "network"], emits: ["http", "network"] },

  // --- Compute ---
  ec2: {
    accepts: ["http", "compute", "network", "event"],
    emits: [
      "http", "database", "cache", "storage", "queue", "topic", "event", "stream",
      "search", "analytics", "identity", "observability", "workflow", "network",
    ],
  },
  lambda: {
    accepts: ["http", "compute", "event", "queue", "stream", "topic", "workflow"],
    emits: [
      "http", "database", "cache", "storage", "queue", "topic", "event", "stream",
      "search", "analytics", "identity", "observability", "workflow",
    ],
  },
  fargate: {
    accepts: ["http", "compute", "network"],
    emits: ["http", "database", "cache", "storage", "queue", "topic", "event", "stream", "search", "observability"],
  },

  // --- Containers ---
  ecs: {
    accepts: ["http", "compute", "network", "event"],
    emits: [
      "http", "database", "cache", "storage", "queue", "topic", "event", "stream",
      "search", "analytics", "identity", "observability", "workflow", "network",
    ],
  },
  eks: {
    accepts: ["http", "compute", "network", "event"],
    emits: [
      "http", "database", "cache", "storage", "queue", "topic", "event", "stream",
      "search", "analytics", "identity", "observability", "workflow", "network",
    ],
  },

  // --- Database ---
  rds: { accepts: ["database"], emits: ["observability"] },
  aurora: { accepts: ["database"], emits: ["observability", "stream"] },
  dynamodb: { accepts: ["database"], emits: ["stream", "observability"] },
  documentdb: { accepts: ["database"], emits: ["observability"] },
  neptune: { accepts: ["database"], emits: ["observability"] },
  timestream: { accepts: ["database", "analytics"], emits: ["observability"] },
  elasticache: { accepts: ["cache"], emits: ["observability"] },

  // --- Storage ---
  s3: { accepts: ["storage", "http"], emits: ["event", "observability", "http"] },
  efs: { accepts: ["storage"], emits: ["observability"] },

  // --- Integration ---
  sqs: { accepts: ["queue"], emits: ["compute", "observability"] },
  sns: { accepts: ["topic"], emits: ["compute", "queue", "http", "observability"] },
  eventbridge: { accepts: ["event"], emits: ["compute", "queue", "topic", "workflow", "observability"] },
  "eventbridge-scheduler": { accepts: ["workflow", "event"], emits: ["compute", "queue", "workflow"] },
  "step-functions": { accepts: ["workflow"], emits: ["compute", "queue", "topic", "database", "storage", "observability"] },
  appsync: { accepts: ["http"], emits: ["http", "database", "cache", "compute", "observability"] },
  "app-mesh": { accepts: ["network"], emits: ["network", "observability"] },

  // --- Analytics ---
  kinesis: { accepts: ["stream"], emits: ["compute", "analytics", "storage", "observability"] },
  firehose: { accepts: ["stream"], emits: ["storage", "search", "analytics", "observability"] },
  msk: { accepts: ["stream"], emits: ["compute", "analytics", "storage", "observability"] },
  opensearch: { accepts: ["search", "analytics"], emits: ["observability"] },
  redshift: { accepts: ["analytics", "database"], emits: ["observability"] },
  athena: { accepts: ["analytics"], emits: ["storage", "observability"] },
  glue: { accepts: ["analytics"], emits: ["storage", "analytics", "observability"] },

  // --- Security ---
  waf: { accepts: ["http"], emits: ["http", "observability"] },
  cognito: { accepts: ["identity", "http"], emits: ["identity", "observability"] },
  iam: { accepts: ["identity"], emits: ["observability"] },
  "secrets-manager": { accepts: ["identity"], emits: ["observability"] },
  kms: { accepts: ["identity"], emits: ["observability"] },

  // --- Observability ---
  cloudwatch: { accepts: ["observability"], emits: ["topic", "event", "compute"] },
  xray: { accepts: ["observability"], emits: ["observability"] },
  "cloud-map": { accepts: ["network", "observability"], emits: ["network"] },
  appconfig: { accepts: ["network", "observability"], emits: ["network"] },

  // --- Extended catalog ---
  "transit-gateway": { accepts: ["network"], emits: ["network"] },
  "direct-connect": { accepts: ["network"], emits: ["network"] },
  batch: { accepts: ["compute", "queue"], emits: ["storage", "database", "observability"] },
  "app-runner": { accepts: ["http"], emits: ["http", "database", "cache", "storage", "queue", "observability"] },
  beanstalk: { accepts: ["http"], emits: ["http", "database", "cache", "storage", "queue", "observability"] },
  lightsail: { accepts: ["http"], emits: ["http", "database", "storage", "observability"] },
  "auto-scaling": { accepts: ["observability"], emits: ["compute", "observability"] },
  ecr: { accepts: ["storage"], emits: ["observability"] },
  backup: { accepts: ["storage"], emits: ["storage", "observability"] },
  fsx: { accepts: ["storage"], emits: ["observability"] },
  ses: { accepts: ["topic", "queue"], emits: ["observability"] },
  mq: { accepts: ["queue", "topic"], emits: ["compute", "observability"] },
  "iot-core": { accepts: ["event", "network"], emits: ["stream", "queue", "topic", "compute", "database", "observability"] },
  emr: { accepts: ["analytics", "storage"], emits: ["storage", "analytics", "observability"] },
  shield: { accepts: ["http"], emits: ["http", "observability"] },
  acm: { accepts: ["identity"], emits: ["identity"] },
  cloudtrail: { accepts: ["observability"], emits: ["storage", "observability"] },
  "systems-manager": { accepts: ["network", "observability"], emits: ["network", "observability"] },
  organizations: { accepts: ["identity"], emits: ["identity", "observability"] },
  bedrock: { accepts: ["http", "compute"], emits: ["observability", "search"] },
  sagemaker: { accepts: ["http", "compute"], emits: ["storage", "database", "observability"] },
  rekognition: { accepts: ["http", "compute"], emits: ["observability"] },
  textract: { accepts: ["http", "compute"], emits: ["storage", "observability"] },
  mediaconvert: { accepts: ["queue", "compute"], emits: ["storage", "observability"] },
  codepipeline: { accepts: ["event"], emits: ["compute", "storage", "observability"] },
  codebuild: { accepts: ["compute", "event"], emits: ["storage", "observability"] },
  codedeploy: { accepts: ["event", "compute"], emits: ["compute", "observability"] },
  amplify: { accepts: ["http"], emits: ["http", "identity", "observability"] },
};

/**
 * Most specific first. When several port types are shared, the edge is named
 * by the most specific — `http` and `network` carry the least information.
 */
const SPECIFICITY: PortType[] = [
  "database", "cache", "search", "analytics", "stream", "queue", "topic",
  "event", "workflow", "identity", "storage", "observability", "dns",
  "compute", "http", "network",
];

export type ConnectionVerdict =
  | { ok: true; kind: PortType | null }
  | { ok: false; reason: string };

function portsFor(componentId: string): ServicePorts | undefined {
  return SERVICE_PORTS[resolveComponentId(componentId)];
}

/**
 * Decide whether traffic from `sourceId` to `targetId` makes architectural
 * sense, and if so what kind of traffic it is.
 *
 * ABSENCE MEANS UNKNOWN, NEVER INVALID: if either endpoint has no relevant
 * declaration — a pattern node, a custom component, an unrecognised id — the
 * verdict is `ok` with a `null` kind, and the UI makes no claim about it.
 */
export function validateConnection(sourceId: string, targetId: string): ConnectionVerdict {
  const source = portsFor(sourceId);
  const target = portsFor(targetId);
  const emits = source?.emits;
  const accepts = target?.accepts;
  if (!emits || !accepts) return { ok: true, kind: null };

  const shared = emits.filter((p) => accepts.includes(p));
  if (shared.length > 0) {
    // Prefer the most specific shared kind: "API Gateway -> Cognito" is more
    // usefully labelled `identity` than `http`, and both are in the intersection.
    const ranked = [...shared].sort((a, b) => SPECIFICITY.indexOf(a) - SPECIFICITY.indexOf(b));
    return { ok: true, kind: ranked[0] };
  }

  // Kept short enough for a tooltip: naming what the target accepts is the
  // actionable half — a source that emits 14 kinds tells the reader nothing.
  return { ok: false, reason: `expects ${accepts.join(" or ")} traffic` };
}
