// GENERATED FILE — do not edit by hand.
// Regenerate: npx tsx scripts/fetch-pricing.ts <cache-dir>
//
// Source: AWS Price List API, offer version 20260821071526.
// us-east-1 on-demand, Linux, shared tenancy, no pre-installed software.
// EXCLUDES Reserved Instances, Savings Plans, and the free tier — real bills
// differ by 30-70% with commitments. Prices are USD.

export const PRICING_VERSION = "20260821071526";
export const PRICING_FETCHED = "2026-08-29";

/** On-demand USD per hour, by instance/node/db class. */
export const INSTANCE_HOURLY: Record<string, number> = {
"r5.2xlarge": 0.504,
"c5.xlarge": 0.17,
"c5.9xlarge": 1.53,
"m5.xlarge": 0.192,
"m5.large": 0.096,
"r5.8xlarge": 2.016,
"c6g.2xlarge": 0.272,
"c5.large": 0.085,
"m6g.2xlarge": 0.308,
"r5.12xlarge": 3.024,
"m5.12xlarge": 2.304,
"t3.micro": 0.0104,
"c5.24xlarge": 4.08,
"m5.4xlarge": 0.768,
"c6g.large": 0.068,
"c5.2xlarge": 0.34,
"t3.large": 0.0832,
"c6g.4xlarge": 0.544,
"r5.24xlarge": 6.048,
"r5.large": 0.126,
"t3.medium": 0.0416,
"m5.24xlarge": 4.608,
"c6g.12xlarge": 1.632,
"t3.small": 0.0208,
"c5.4xlarge": 0.68,
"m5.8xlarge": 1.536,
"m6g.large": 0.077,
"t3.xlarge": 0.1664,
"c5.12xlarge": 2.04,
"m6g.4xlarge": 0.616,
"r5.xlarge": 0.252,
"t3.2xlarge": 0.3328,
"m6g.12xlarge": 1.848,
"r5.4xlarge": 1.008,
"c6g.8xlarge": 1.088,
"c6g.16xlarge": 2.176,
"m6g.8xlarge": 1.232,
"m6g.xlarge": 0.154,
"m5.2xlarge": 0.384,
"c6g.xlarge": 0.136,
"m6g.16xlarge": 2.464,
"cache.t3.micro": 0.017,
"cache.t3.small": 0.034,
"cache.t3.medium": 0.068,
"cache.r6g.large": 0.206,
"cache.r6g.xlarge": 0.411,
"cache.r6g.2xlarge": 0.821,
"cache.r6g.4xlarge": 1.642,
"cache.r6g.8xlarge": 3.284,
"cache.r6g.12xlarge": 4.925,
"db.t3.medium": 0.072,
"db.t3.large": 0.145,
"db.t3.xlarge": 0.29,
"db.t3.2xlarge": 0.579,
"db.m5.large": 0.178,
"db.m5.xlarge": 0.356,
"db.m5.2xlarge": 0.712,
"db.m5.4xlarge": 1.424,
"db.m5.8xlarge": 2.848,
"db.m5.12xlarge": 4.272,
"db.m5.24xlarge": 8.544,
"db.r5.large": 0.25,
"db.r5.xlarge": 0.5,
"db.r5.2xlarge": 1,
"db.r5.4xlarge": 2,
"db.r5.8xlarge": 4,
"db.r5.12xlarge": 6,
"db.r5.24xlarge": 12
};

/** Per-region price ratio against us-east-1, sampled on cache.r6g.large. */
export const REGION_MULTIPLIER: Record<string, number> = {
"af-south-1": 1.32,
"ap-east-1": 1.311,
"ap-east-2": 1.079,
"ap-northeast-1": 1.199,
"ap-northeast-2": 1.194,
"ap-northeast-3": 1.199,
"ap-south-1": 1.024,
"ap-south-2": 1.024,
"ap-southeast-1": 1.199,
"ap-southeast-2": 1.199,
"ap-southeast-3": 1.199,
"ap-southeast-4": 1.199,
"ap-southeast-5": 1.019,
"ap-southeast-6": 1.259,
"ap-southeast-7": 1.019,
"ca-central-1": 1.087,
"ca-west-1": 1.087,
"eu-central-1": 1.199,
"eu-central-2": 1.319,
"eu-north-1": 1.053,
"eu-south-1": 1.165,
"eu-south-2": 1.112,
"eu-west-1": 1.112,
"eu-west-2": 1.165,
"eu-west-3": 1.165,
"il-central-1": 1.167,
"me-central-1": 1,
"me-south-1": 1,
"mx-central-1": 1.05,
"sa-east-1": 1.99,
"us-east-1": 1,
"us-east-2": 1,
"us-west-1": 1,
"us-west-2": 1
};

export const PRICING = {
"instanceHourly": {
  "r5.2xlarge": 0.504,
  "c5.xlarge": 0.17,
  "c5.9xlarge": 1.53,
  "m5.xlarge": 0.192,
  "m5.large": 0.096,
  "r5.8xlarge": 2.016,
  "c6g.2xlarge": 0.272,
  "c5.large": 0.085,
  "m6g.2xlarge": 0.308,
  "r5.12xlarge": 3.024,
  "m5.12xlarge": 2.304,
  "t3.micro": 0.0104,
  "c5.24xlarge": 4.08,
  "m5.4xlarge": 0.768,
  "c6g.large": 0.068,
  "c5.2xlarge": 0.34,
  "t3.large": 0.0832,
  "c6g.4xlarge": 0.544,
  "r5.24xlarge": 6.048,
  "r5.large": 0.126,
  "t3.medium": 0.0416,
  "m5.24xlarge": 4.608,
  "c6g.12xlarge": 1.632,
  "t3.small": 0.0208,
  "c5.4xlarge": 0.68,
  "m5.8xlarge": 1.536,
  "m6g.large": 0.077,
  "t3.xlarge": 0.1664,
  "c5.12xlarge": 2.04,
  "m6g.4xlarge": 0.616,
  "r5.xlarge": 0.252,
  "t3.2xlarge": 0.3328,
  "m6g.12xlarge": 1.848,
  "r5.4xlarge": 1.008,
  "c6g.8xlarge": 1.088,
  "c6g.16xlarge": 2.176,
  "m6g.8xlarge": 1.232,
  "m6g.xlarge": 0.154,
  "m5.2xlarge": 0.384,
  "c6g.xlarge": 0.136,
  "m6g.16xlarge": 2.464,
  "cache.t3.micro": 0.017,
  "cache.t3.small": 0.034,
  "cache.t3.medium": 0.068,
  "cache.r6g.large": 0.206,
  "cache.r6g.xlarge": 0.411,
  "cache.r6g.2xlarge": 0.821,
  "cache.r6g.4xlarge": 1.642,
  "cache.r6g.8xlarge": 3.284,
  "cache.r6g.12xlarge": 4.925,
  "db.t3.medium": 0.072,
  "db.t3.large": 0.145,
  "db.t3.xlarge": 0.29,
  "db.t3.2xlarge": 0.579,
  "db.m5.large": 0.178,
  "db.m5.xlarge": 0.356,
  "db.m5.2xlarge": 0.712,
  "db.m5.4xlarge": 1.424,
  "db.m5.8xlarge": 2.848,
  "db.m5.12xlarge": 4.272,
  "db.m5.24xlarge": 8.544,
  "db.r5.large": 0.25,
  "db.r5.xlarge": 0.5,
  "db.r5.2xlarge": 1,
  "db.r5.4xlarge": 2,
  "db.r5.8xlarge": 4,
  "db.r5.12xlarge": 6,
  "db.r5.24xlarge": 12
},
"s3": {
  "storageGBMonth": {
    "standard": 0.023,
    "ia": 0.0125,
    "glacier-ir": 0.004,
    "glacier": 0.0036
  },
  "getPer1000": 4e-7,
  "putPer1000": 0.000005
},
"dynamodb": {
  "readUnitHour": 0.00013,
  "writeUnitHour": 0.00065,
  "onDemandRead": 1.25e-7,
  "onDemandWrite": 6.25e-7,
  "storageGBMonth": 0.25
},
"lambda": {
  "gbSecond": 0.0000166667,
  "perRequest": 2e-7
},
"apiGateway": {
  "restPerRequest": 0.0000035,
  "httpPerRequest": 0.000001
},
"kinesis": {
  "shardHour": 0.02,
  "putUnits": 1.4e-8
},
"cloudfront": {
  "egressGB": 0.085,
  "perRequestHttps": 0.000001
},
"redshift": {
  "nodeHourly": {
    "ra3.large": 0.543,
    "ra3.4xlarge": 3.26,
    "ra3.16xlarge": 13.04,
    "dc2.large": 0.25
  }
},
"athena": {
  "perTBScanned": 5
},
"glue": {
  "perDPUHour": 0.44
},
"natGateway": {
  "hourly": 0.045,
  "perGB": 0.045
}
} as const;
