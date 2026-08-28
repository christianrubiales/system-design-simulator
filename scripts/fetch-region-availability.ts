/**
 * Usage: npx tsx scripts/fetch-region-availability.ts <path-to-regional-index.json>
 *
 * Generates src/data/regionAvailability.ts from AWS's regional services feed.
 *
 * SOURCING NOTE — READ BEFORE EDITING:
 * The source feed (https://api.regional-table.region-services.aws.a2z.com/index.json)
 * carries the metadata "This file is intended for use only on aws.amazon.com. We do
 * not guarantee its availability or accuracy." So it is used ONCE, OFFLINE, as a
 * fact source; we generate and commit our own file. The application must never
 * fetch it at runtime, and the feed itself is not redistributed here.
 *
 * Refresh by downloading the feed and re-running this script.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SYSTEM_COMPONENTS } from "../src/data/components";

const OUT = join(process.cwd(), "src", "data", "regionAvailability.ts");

/** Catalog service id -> exact `aws:serviceName` in the feed. */
const FEED_NAME: Record<string, string> = {
  route53: "Amazon Route 53",
  cloudfront: "Amazon CloudFront",
  alb: "Elastic Load Balancing (ELB)",
  nlb: "Elastic Load Balancing (ELB)",
  "api-gateway": "Amazon API Gateway",
  vpc: "Amazon Virtual Private Cloud (VPC)",
  "nat-gateway": "NAT Gateway",
  privatelink: "AWS PrivateLink",
  "global-accelerator": "AWS Global Accelerator",
  waf: "AWS WAF",
  ec2: "Amazon Elastic Compute Cloud (EC2)",
  lambda: "AWS Lambda",
  ecs: "Amazon Elastic Container Service (ECS)",
  eks: "Amazon Elastic Kubernetes Service (EKS)",
  rds: "Amazon Relational Database Service (RDS)",
  dynamodb: "Amazon DynamoDB",
  elasticache: "Amazon ElastiCache",
  aurora: "Amazon Aurora",
  documentdb: "Amazon DocumentDB (with MongoDB compatibility)",
  neptune: "Amazon Neptune",
  s3: "Amazon Simple Storage Service (S3)",
  efs: "Amazon Elastic File System (EFS)",
  sqs: "Amazon Simple Queue Service (SQS)",
  sns: "Amazon Simple Notification Service (SNS)",
  eventbridge: "Amazon EventBridge",
  "step-functions": "AWS Step Functions",
  appsync: "AWS AppSync",
  kinesis: "Amazon Kinesis Data Streams",
  firehose: "Amazon Data Firehose",
  opensearch: "Amazon OpenSearch Service",
  redshift: "Amazon Redshift",
  athena: "Amazon Athena",
  glue: "AWS Glue",
  msk: "Amazon Managed Streaming for Apache Kafka (MSK)",
  cognito: "Amazon Cognito",
  iam: "AWS Identity and Access Management (IAM)",
  "secrets-manager": "AWS Secrets Manager",
  kms: "AWS Key Management Service (KMS)",
  cloudwatch: "Amazon CloudWatch",
  xray: "AWS X-Ray",
  "cloud-map": "AWS Cloud Map",
  appconfig: "AWS AppConfig",
};

/**
 * Services that are a launch type or sub-feature of another service and
 * therefore follow its regional availability rather than having their own row.
 */
const INHERITS: Record<string, string> = {
  fargate: "ecs",
  "eventbridge-scheduler": "eventbridge",
};

/**
 * In the catalog but absent from the feed, so we genuinely do not know their
 * regional availability and will not invent it. The UI shows no availability
 * claim for these rather than a wrong one.
 */
const UNKNOWN = new Set<string>(["app-mesh", "timestream"]);

/**
 * Region partitions we deliberately exclude.
 *
 * GovCloud (`us-gov-*`) and the European Sovereign Cloud (`eusc-*`) are separate
 * AWS partitions with their own accounts, endpoints, and service sets. They are
 * noise in a system-design interview tool, and their sparse service lists would
 * generate a stream of "unavailable" warnings that teach nothing.
 */
const EXCLUDED_REGION_PREFIXES = ["us-gov-", "eusc-"];

/**
 * Services AWS includes in every commercial Region at launch. The feed is
 * demonstrably incomplete for some of these — it omits S3 from eu-central-2
 * (Zurich), where S3 has been available since the Region launched — and AWS's
 * own metadata disclaims the feed's accuracy. Treating these as universally
 * available corrects known-bad omissions rather than teaching a false fact.
 */
const CORE_ALWAYS_AVAILABLE = new Set<string>([
  "s3",
  "ec2",
  "vpc",
  "iam",
  "cloudwatch",
  "kms",
  "alb",
  "nlb",
  "route53",
]);

/** Human labels for region codes. Codes not listed fall back to the code. */
const REGION_LABELS: Record<string, string> = {
  "af-south-1": "Africa (Cape Town)",
  "ap-east-1": "Asia Pacific (Hong Kong)",
  "ap-east-2": "Asia Pacific (Taipei)",
  "ap-northeast-1": "Asia Pacific (Tokyo)",
  "ap-northeast-2": "Asia Pacific (Seoul)",
  "ap-northeast-3": "Asia Pacific (Osaka)",
  "ap-south-1": "Asia Pacific (Mumbai)",
  "ap-south-2": "Asia Pacific (Hyderabad)",
  "ap-southeast-1": "Asia Pacific (Singapore)",
  "ap-southeast-2": "Asia Pacific (Sydney)",
  "ap-southeast-3": "Asia Pacific (Jakarta)",
  "ap-southeast-4": "Asia Pacific (Melbourne)",
  "ap-southeast-5": "Asia Pacific (Malaysia)",
  "ap-southeast-6": "Asia Pacific (New Zealand)",
  "ap-southeast-7": "Asia Pacific (Thailand)",
  "ca-central-1": "Canada (Central)",
  "ca-west-1": "Canada West (Calgary)",
  "eu-central-1": "Europe (Frankfurt)",
  "eu-central-2": "Europe (Zurich)",
  "eu-north-1": "Europe (Stockholm)",
  "eu-south-1": "Europe (Milan)",
  "eu-south-2": "Europe (Spain)",
  "eu-west-1": "Europe (Ireland)",
  "eu-west-2": "Europe (London)",
  "eu-west-3": "Europe (Paris)",
  "eusc-de-east-1": "European Sovereign Cloud (Brandenburg)",
  "il-central-1": "Israel (Tel Aviv)",
  "me-central-1": "Middle East (UAE)",
  "me-south-1": "Middle East (Bahrain)",
  "mx-central-1": "Mexico (Central)",
  "sa-east-1": "South America (Sao Paulo)",
  "us-east-1": "US East (N. Virginia)",
  "us-east-2": "US East (Ohio)",
  "us-gov-east-1": "AWS GovCloud (US-East)",
  "us-gov-west-1": "AWS GovCloud (US-West)",
  "us-west-1": "US West (N. California)",
  "us-west-2": "US West (Oregon)",
};

const feedPath = process.argv[2];
if (!feedPath) {
  console.error("Usage: npx tsx scripts/fetch-region-availability.ts <path-to-index.json>");
  process.exit(1);
}

interface FeedRow {
  attributes: { "aws:region": string; "aws:serviceName": string };
}
const feed = JSON.parse(readFileSync(feedPath, "utf8")) as {
  metadata: { "source:version": string };
  prices: FeedRow[];
};

const sourceVersion = feed.metadata["source:version"];
const allRegions = [...new Set(feed.prices.map((r) => r.attributes["aws:region"]))]
  .filter((r) => !EXCLUDED_REGION_PREFIXES.some((p) => r.startsWith(p)))
  .sort();

const regionsByFeedName = new Map<string, Set<string>>();
for (const row of feed.prices) {
  const name = row.attributes["aws:serviceName"];
  if (!regionsByFeedName.has(name)) regionsByFeedName.set(name, new Set());
  regionsByFeedName.get(name)!.add(row.attributes["aws:region"]);
}

// Every AWS service in the catalog must be mapped, inherited, or declared unknown.
const awsServices = SYSTEM_COMPONENTS.filter((c) => c.awsIcon).map((c) => c.id);
const unhandled = awsServices.filter(
  (id) => !(id in FEED_NAME) && !(id in INHERITS) && !UNKNOWN.has(id),
);
if (unhandled.length > 0) {
  console.error(`\n${unhandled.length} catalog service(s) have no region mapping:\n`);
  for (const id of unhandled) console.error(`  x ${id}`);
  console.error("\nAdd to FEED_NAME, INHERITS, or UNKNOWN in this script.");
  process.exit(1);
}

const badNames = Object.entries(FEED_NAME).filter(([, n]) => !regionsByFeedName.has(n));
if (badNames.length > 0) {
  console.error(`\n${badNames.length} mapped name(s) not present in the feed:\n`);
  for (const [id, n] of badNames) console.error(`  x ${id} -> "${n}"`);
  process.exit(1);
}

/** Region codes where a service is NOT available. Empty arrays are omitted. */
const unavailable: Record<string, string[]> = {};
function computeFor(id: string): string[] {
  const target = INHERITS[id] ?? id;
  const name = FEED_NAME[target];
  const have = regionsByFeedName.get(name)!;
  return allRegions.filter((r) => !have.has(r));
}
for (const id of awsServices) {
  if (UNKNOWN.has(id)) continue;
  if (CORE_ALWAYS_AVAILABLE.has(id)) continue; // see CORE_ALWAYS_AVAILABLE
  const missing = computeFor(id);
  if (missing.length > 0) unavailable[id] = missing;
}

const missingLabels = allRegions.filter((r) => !(r in REGION_LABELS));
if (missingLabels.length > 0) {
  console.warn(`warning: no label for ${missingLabels.join(", ")} — falling back to the code`);
}

const body = `// GENERATED FILE — do not edit by hand.
// Regenerate: npx tsx scripts/fetch-region-availability.ts <path-to-index.json>
//
// Derived from AWS's regional services feed (source:version ${sourceVersion}).
// The feed is used offline as a fact source only; see the script header. Facts
// about which services exist in which regions are not copyrightable, and the
// feed itself is not redistributed.

export interface AwsRegion {
  code: string;
  label: string;
}

/** Snapshot date of the AWS data this file was generated from. */
export const REGION_DATA_VERSION = ${JSON.stringify(sourceVersion)};

export const AWS_REGIONS: AwsRegion[] = ${JSON.stringify(
  allRegions.map((code) => ({ code, label: REGION_LABELS[code] ?? code })),
  null,
  2,
)};

/**
 * Catalog service id -> region codes where the service is NOT available.
 * Services absent from this map are available in every region we track.
 */
export const UNAVAILABLE_REGIONS: Record<string, string[]> = ${JSON.stringify(unavailable, null, 2)};

/**
 * Catalog services missing from the AWS feed. We do not know their regional
 * availability and deliberately do not guess — the UI makes no availability
 * claim for these.
 */
export const UNKNOWN_AVAILABILITY: ReadonlySet<string> = new Set(${JSON.stringify([...UNKNOWN].sort())});

/** True when \`serviceId\` is known to be unavailable in \`region\`. */
export function isUnavailableInRegion(serviceId: string, region: string): boolean {
  return UNAVAILABLE_REGIONS[serviceId]?.includes(region) ?? false;
}
`;

writeFileSync(OUT, body);
console.log(`wrote ${OUT}`);
console.log(
  `  ${allRegions.length} regions, ${awsServices.length} AWS services, ` +
    `${Object.keys(unavailable).length} with gaps, ${UNKNOWN.size} unknown`,
);
