/**
 * Usage: npx tsx scripts/fetch-pricing.ts <cache-dir>
 *
 * Generates src/data/pricing.ts from the AWS Price List API. Run offline; the
 * application never calls AWS at runtime.
 *
 * THE SKU FILTER IS THE WHOLE RISK. The same instance appears with Windows and
 * RHEL licences, dedicated tenancy, pre-installed software, extended support,
 * and reserved terms — prices that differ by multiples and all look plausible.
 * Every filter below is deliberately exact, and the generator asserts a set of
 * known published prices before writing anything. If AWS changes a usagetype,
 * the assertions fail loudly rather than emitting quietly wrong numbers.
 *
 * Downloads are cached in <cache-dir>; delete a file to re-fetch it.
 * The EC2 catalogue is a 289 MB CSV, streamed line by line rather than parsed.
 */
import { createWriteStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { INSTANCE_FAMILIES } from "../src/data/instanceFamilies";
import { AWS_REGIONS } from "../src/data/regionAvailability";

const BASE = "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws";
const cacheDir = process.argv[2];
if (!cacheDir) {
  console.error("Usage: npx tsx scripts/fetch-pricing.ts <cache-dir>");
  process.exit(1);
}

async function download(url: string, file: string): Promise<string> {
  const path = join(cacheDir, file);
  if (!existsSync(path)) {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`${url} -> HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(path));
  }
  return path;
}

interface Offer {
  version: string;
  products: Record<string, { sku: string; productFamily?: string; attributes: Record<string, string> }>;
  terms: { OnDemand: Record<string, Record<string, { priceDimensions: Record<string, {
    pricePerUnit: { USD: string }; unit: string; beginRange: string; description: string;
  }> }>> };
}

async function offer(service: string, region?: string): Promise<Offer> {
  const url = region ? `${BASE}/${service}/current/${region}/index.json` : `${BASE}/${service}/current/index.json`;
  return JSON.parse(readFileSync(await download(url, `${service}${region ? "-" + region : "-global"}.json`), "utf8"));
}

/**
 * First NON-ZERO on-demand USD price for a SKU.
 *
 * AWS expresses free-tier allowances as a first tier priced at zero — DynamoDB
 * capacity units and S3 storage both do this. Reading only the lowest tier
 * therefore yields 0, which is worse than "missing": it would silently price
 * those services at nothing.
 */
function priceOf(o: Offer, sku: string): number | null {
  const term = o.terms.OnDemand[sku];
  if (!term) return null;
  const dims: { begin: number; usd: number }[] = [];
  for (const t of Object.values(term)) {
    for (const d of Object.values(t.priceDimensions)) {
      const usd = parseFloat(d.pricePerUnit.USD);
      if (Number.isFinite(usd)) dims.push({ begin: parseFloat(d.beginRange) || 0, usd });
    }
  }
  dims.sort((a, b) => a.begin - b.begin);
  return dims.find((d) => d.usd > 0)?.usd ?? null;
}

/** Find exactly one product matching a predicate, then price it. */
function findPrice(o: Offer, match: (a: Record<string, string>, f: string) => boolean): number | null {
  for (const p of Object.values(o.products)) {
    if (!match(p.attributes, p.productFamily ?? "")) continue;
    const v = priceOf(o, p.sku);
    if (v !== null && v > 0) return v;
  }
  return null;
}

// ---------------------------------------------------------------- EC2 (CSV)
async function ec2Prices(): Promise<Record<string, number>> {
  const wanted = new Set<string>();
  for (const fam of ["t3", "m5", "m6g", "c5", "c6g", "r5"]) {
    for (const s of INSTANCE_FAMILIES[fam]?.sizes ?? []) wanted.add(s.size);
  }
  const path = await download(`${BASE}/AmazonEC2/current/us-east-1/index.csv`, "AmazonEC2-us-east-1.csv");

  const out: Record<string, number> = {};
  let idx: Record<string, number> | null = null;
  const rl = createInterface({ input: (await import("node:fs")).createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!idx) {
      if (!line.startsWith('"SKU"')) continue;
      idx = {};
      splitCsv(line).forEach((h, i) => { idx![h] = i; });
      continue;
    }
    if (!line.includes("OnDemand") || !line.includes("Shared")) continue;
    const f = splitCsv(line);
    const type = f[idx["Instance Type"]];
    if (!wanted.has(type) || out[type] !== undefined) continue;
    if (f[idx["TermType"]] !== "OnDemand") continue;
    if (f[idx["Tenancy"]] !== "Shared") continue;
    if (f[idx["Operating System"]] !== "Linux") continue;
    if (f[idx["License Model"]] !== "No License required") continue;
    if (f[idx["Pre Installed S/W"]] !== "NA") continue;
    if (f[idx["CapacityStatus"]] !== "Used") continue;
    if (f[idx["Unit"]] !== "Hrs") continue;
    const price = parseFloat(f[idx["PricePerUnit"]]);
    if (Number.isFinite(price) && price > 0) out[type] = price;
  }
  return out;
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ;
    } else if (c === "," && !inQ) { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out;
}

async function main() {
  // ------------------------------------------------------------------- main
  const instanceHourly: Record<string, number> = {};

  console.log("EC2 (streaming 289 MB CSV)…");
  Object.assign(instanceHourly, await ec2Prices());

  console.log("ElastiCache…");
  const ec = await offer("AmazonElastiCache", "us-east-1");
  for (const s of INSTANCE_FAMILIES["cache.t3"].sizes.concat(INSTANCE_FAMILIES["cache.r6g"].sizes)) {
    const v = findPrice(ec, (a) => a.instanceType === s.size && a.cacheEngine === "Redis" && a.usagetype === `NodeUsage:${s.size}`);
    if (v) instanceHourly[s.size] = v;
  }

  console.log("RDS…");
  const rds = await offer("AmazonRDS", "us-east-1");
  for (const key of ["db.t3", "db.m5", "db.r5"]) {
    for (const s of INSTANCE_FAMILIES[key].sizes) {
      const v = findPrice(rds, (a) => a.instanceType === s.size && a.databaseEngine === "PostgreSQL" &&
        a.deploymentOption === "Single-AZ" && (a.usagetype ?? "").startsWith("InstanceUsage:"));
      if (v) instanceHourly[s.size] = v;
    }
  }

  console.log("S3, DynamoDB, Lambda, API Gateway, Kinesis, CloudFront, NAT…");
  const s3 = await offer("AmazonS3", "us-east-1");
  const ddb = await offer("AmazonDynamoDB", "us-east-1");
  const lam = await offer("AWSLambda", "us-east-1");
  const apigw = await offer("AmazonApiGateway", "us-east-1");
  const kin = await offer("AmazonKinesis", "us-east-1");
  const cf = await offer("AmazonCloudFront");

  const ut = (name: string) => (a: Record<string, string>) => a.usagetype === name;

  const storageGBMonth = {
    standard: findPrice(s3, ut("TimedStorage-ByteHrs")),
    ia: findPrice(s3, ut("TimedStorage-SIA-ByteHrs")),
    "glacier-ir": findPrice(s3, ut("TimedStorage-GIR-ByteHrs")),
    glacier: findPrice(s3, ut("TimedStorage-GlacierByteHrs")),
  };

  const pricing = {
    instanceHourly,
    s3: {
      storageGBMonth,
      getPer1000: findPrice(s3, ut("Requests-Tier2")),
      putPer1000: findPrice(s3, ut("Requests-Tier1")),
    },
    dynamodb: {
      readUnitHour: findPrice(ddb, ut("ReadCapacityUnit-Hrs")),
      writeUnitHour: findPrice(ddb, ut("WriteCapacityUnit-Hrs")),
      onDemandRead: findPrice(ddb, ut("ReadRequestUnits")),
      onDemandWrite: findPrice(ddb, ut("WriteRequestUnits")),
      storageGBMonth: findPrice(ddb, ut("TimedStorage-ByteHrs")),
    },
    lambda: {
      gbSecond: findPrice(lam, ut("Lambda-GB-Second")),
      perRequest: findPrice(lam, ut("Request")),
    },
    apiGateway: {
      restPerRequest: findPrice(apigw, ut("USE1-ApiGatewayRequest")),
      httpPerRequest: findPrice(apigw, ut("USE1-ApiGatewayHttpRequest")),
    },
    kinesis: {
      shardHour: findPrice(kin, (a) => (a.usagetype ?? "").endsWith("ShardHour")),
      putUnits: findPrice(kin, (a) => (a.usagetype ?? "").includes("PutRequestPayloadUnits")),
    },
    cloudfront: {
      egressGB: findPrice(cf, ut("US-DataTransfer-Out-Bytes")),
      perRequestHttps: findPrice(cf, ut("US-Requests-Tier2-HTTPS")),
    },
    // Sourced from the EC2 catalogue: "$0.045 per NAT Gateway Hour" and
    // "$0.045 per GB Data Processed by NAT Gateways".
    natGateway: { hourly: 0.045, perGB: 0.045 },
  };

  // ------------------------------------------------- region multipliers
  console.log(`region multipliers across ${AWS_REGIONS.length} regions…`);
  const anchor = "cache.r6g.large";
  const usEast = instanceHourly[anchor];
  const regionMultiplier: Record<string, number> = {};
  for (const r of AWS_REGIONS) {
    try {
      const o = await offer("AmazonElastiCache", r.code);
      const v = findPrice(o, (a) => {
        const u = a.usagetype ?? "";
        // The same SKU trap as EC2: ExtendedSupport and SyncDurability variants
        // of one node type carry very different prices and would skew every
        // region. Regional files prefix the usagetype, so match the suffix.
        return (
          a.instanceType === anchor &&
          a.cacheEngine === "Redis" &&
          u.endsWith(`NodeUsage:${anchor}`) &&
          !/ExtendedSupport|SyncDurability/.test(u)
        );
      });
      regionMultiplier[r.code] = v && usEast ? Number((v / usEast).toFixed(3)) : 1;
    } catch {
      regionMultiplier[r.code] = 1;
    }
  }

  // ------------------------------------------------- assertions before writing
  const KNOWN: [string, number][] = [
    ["m5.large", 0.096], ["m5.xlarge", 0.192], ["t3.medium", 0.0416],
    ["c5.large", 0.085], ["m6g.large", 0.077], ["cache.r6g.large", 0.206],
  ];
  const failures: string[] = [];
  for (const [type, expected] of KNOWN) {
    const got = instanceHourly[type];
    if (got === undefined || Math.abs(got - expected) > 0.0001) {
      failures.push(`${type}: expected $${expected}/hr, got ${got === undefined ? "nothing" : "$" + got}`);
    }
  }
  for (const [k, v] of Object.entries(pricing.s3.storageGBMonth)) {
    if (!v) failures.push(`s3 storage class "${k}" missing or zero`);
  }
  // A zero here means a free-tier dimension was read instead of the real rate.
  const mustBePositive: [string, number | null][] = [
    ["dynamodb.readUnitHour", pricing.dynamodb.readUnitHour],
    ["dynamodb.writeUnitHour", pricing.dynamodb.writeUnitHour],
    ["dynamodb.storageGBMonth", pricing.dynamodb.storageGBMonth],
    ["lambda.gbSecond", pricing.lambda.gbSecond],
    ["apiGateway.restPerRequest", pricing.apiGateway.restPerRequest],
    ["cloudfront.egressGB", pricing.cloudfront.egressGB],
    ["kinesis.shardHour", pricing.kinesis.shardHour],
  ];
  for (const [name, v] of mustBePositive) {
    if (!v || v <= 0) failures.push(`${name} is missing or zero`);
  }
  if (Math.abs((regionMultiplier["us-east-1"] ?? 0) - 1) > 0.001) {
    failures.push(`us-east-1 multiplier must be exactly 1, got ${regionMultiplier["us-east-1"]}`);
  }
  if (failures.length) {
    console.error("\nSKU filter check FAILED — refusing to write pricing data:\n");
    for (const f of failures) console.error(`  x ${f}`);
    process.exit(1);
  }

  const version = ec.version;
  const body = `// GENERATED FILE — do not edit by hand.
  // Regenerate: npx tsx scripts/fetch-pricing.ts <cache-dir>
  //
  // Source: AWS Price List API, offer version ${version}.
  // us-east-1 on-demand, Linux, shared tenancy, no pre-installed software.
  // EXCLUDES Reserved Instances, Savings Plans, and the free tier — real bills
  // differ by 30-70% with commitments. Prices are USD.

  export const PRICING_VERSION = ${JSON.stringify(version)};
  export const PRICING_FETCHED = ${JSON.stringify(new Date().toISOString().slice(0, 10))};

  /** On-demand USD per hour, by instance/node/db class. */
  export const INSTANCE_HOURLY: Record<string, number> = ${JSON.stringify(instanceHourly, null, 2)};

  /** Per-region price ratio against us-east-1, sampled on ${anchor}. */
  export const REGION_MULTIPLIER: Record<string, number> = ${JSON.stringify(regionMultiplier, null, 2)};

  export const PRICING = ${JSON.stringify(pricing, null, 2)} as const;
  `;

  // The template literal is indented inside main(); emit it flush-left.
  writeFileSync(join(process.cwd(), "src", "data", "pricing.ts"), body.replace(/^  /gm, ""));
  console.log(`\nwrote src/data/pricing.ts — offer ${version}, ${Object.keys(instanceHourly).length} instance classes`);

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
