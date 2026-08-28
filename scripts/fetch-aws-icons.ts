/**
 * Usage: npx tsx scripts/fetch-aws-icons.ts <path-to-unzipped-icon-package>
 *
 * Copies the AWS Architecture Icons this catalog uses into public/aws-icons/,
 * renamed to our service ids. Re-runnable to refresh against a newer pack.
 *
 * LICENSING — READ BEFORE EDITING:
 * The icons are CC-BY-ND 2.0 (Attribution-NoDerivatives). Files are copied
 * BYTE-FOR-BYTE. Do not add SVG minification, metadata stripping, recoloring,
 * or any other content transform here — distributing an altered icon violates
 * the NoDerivatives term. Renaming the file is fine; rewriting it is not.
 * See THIRD-PARTY-NOTICES.md.
 */
import { copyFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";

const PACK_VERSION = "07312026";
const PACK_URL = "https://aws.amazon.com/architecture/icons/";
const OUT = join(process.cwd(), "public", "aws-icons");

/**
 * catalog service id -> icon basename inside the pack (without .svg).
 *
 * `Arch_*` entries come from Architecture-Service-Icons (full-color badge).
 * `Res_*` entries come from Resource-Icons (single-color line art) — used only
 * where AWS ships no service-level icon. These two look different by design;
 * see THIRD-PARTY-NOTICES.md, we cannot restyle them to match.
 */
const PACK_NAMES: Record<string, string> = {
  // Networking
  route53: "Arch_Amazon-Route-53_48",
  cloudfront: "Arch_Amazon-CloudFront_48",
  elb: "Arch_Elastic-Load-Balancing_48",
  "api-gateway": "Arch_Amazon-API-Gateway_48",
  vpc: "Arch_Amazon-Virtual-Private-Cloud_48",
  "nat-gateway": "Res_Amazon-VPC_NAT-Gateway_48",
  privatelink: "Arch_AWS-PrivateLink_48",
  "global-accelerator": "Arch_AWS-Global-Accelerator_48",
  // Compute
  ec2: "Arch_Amazon-EC2_48",
  lambda: "Arch_AWS-Lambda_48",
  fargate: "Arch_AWS-Fargate_48",
  // Containers
  ecs: "Arch_Amazon-Elastic-Container-Service_48",
  eks: "Arch_Amazon-Elastic-Kubernetes-Service_48",
  // Database
  rds: "Arch_Amazon-RDS_48",
  dynamodb: "Arch_Amazon-DynamoDB_48",
  elasticache: "Arch_Amazon-ElastiCache_48",
  aurora: "Arch_Amazon-Aurora_48",
  documentdb: "Arch_Amazon-DocumentDB_48",
  neptune: "Arch_Amazon-Neptune_48",
  timestream: "Arch_Amazon-Timestream_48",
  // Storage
  s3: "Arch_Amazon-Simple-Storage-Service_48",
  efs: "Arch_Amazon-EFS_48",
  // Integration
  sqs: "Arch_Amazon-Simple-Queue-Service_48",
  sns: "Arch_Amazon-Simple-Notification-Service_48",
  eventbridge: "Arch_Amazon-EventBridge_48",
  "eventbridge-scheduler": "Res_Amazon-EventBridge_Scheduler_48",
  "step-functions": "Arch_AWS-Step-Functions_48",
  appsync: "Arch_AWS-AppSync_48",
  "app-mesh": "Arch_AWS-App-Mesh_48",
  // Analytics
  kinesis: "Arch_Amazon-Kinesis-Data-Streams_48",
  firehose: "Arch_Amazon-Data-Firehose_48",
  opensearch: "Arch_Amazon-OpenSearch-Service_48",
  redshift: "Arch_Amazon-Redshift_48",
  athena: "Arch_Amazon-Athena_48",
  glue: "Arch_AWS-Glue_48",
  msk: "Arch_Amazon-Managed-Streaming-for-Apache-Kafka_48",
  // Security
  waf: "Arch_AWS-WAF_48",
  cognito: "Arch_Amazon-Cognito_48",
  iam: "Arch_AWS-Identity-and-Access-Management_48",
  "secrets-manager": "Arch_AWS-Secrets-Manager_48",
  kms: "Arch_AWS-Key-Management-Service_48",
  // Observability
  cloudwatch: "Arch_Amazon-CloudWatch_48",
  xray: "Arch_AWS-X-Ray_48",
  "cloud-map": "Arch_AWS-Cloud-Map_48",
  appconfig: "Arch_AWS-AppConfig_48",
};

const packRoot = process.argv[2];
if (!packRoot) {
  console.error("Usage: npx tsx scripts/fetch-aws-icons.ts <path-to-unzipped-icon-package>");
  process.exit(1);
}

/** Index every *_48.svg in the pack by basename, skipping __MACOSX resource forks. */
function indexSvgs(dir: string, index: Map<string, string>): void {
  for (const entry of readdirSync(dir)) {
    if (entry === "__MACOSX" || entry.startsWith("._")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      indexSvgs(full, index);
    } else if (entry.endsWith("_48.svg")) {
      index.set(basename(entry, ".svg"), full);
    }
  }
}

const index = new Map<string, string>();
indexSvgs(packRoot, index);
console.log(`indexed ${index.size} icons at 48px from ${packRoot}`);

mkdirSync(OUT, { recursive: true });

const missing: string[] = [];
const written: string[] = [];
for (const [id, packName] of Object.entries(PACK_NAMES)) {
  const src = index.get(packName);
  if (!src) {
    missing.push(`${id} -> ${packName}`);
    continue;
  }
  copyFileSync(src, join(OUT, `${id}.svg`)); // byte-for-byte, see header
  written.push(id);
}

if (missing.length > 0) {
  console.error(`\n${missing.length} icon(s) not found in the pack:\n`);
  for (const m of missing) console.error(`  x ${m}`);
  console.error("\nNothing partial was left behind for these ids. Fix PACK_NAMES and re-run.");
  process.exit(1);
}

writeFileSync(
  join(OUT, "provenance.json"),
  JSON.stringify(
    {
      packVersion: PACK_VERSION,
      sourceUrl: PACK_URL,
      license: "CC-BY-ND 2.0",
      fetchedAt: new Date().toISOString().slice(0, 10),
      note: "Icons are redistributed unmodified, as NoDerivatives requires.",
      icons: written.sort(),
    },
    null,
    2,
  ) + "\n",
);

console.log(`wrote ${written.length} icons to public/aws-icons/`);
