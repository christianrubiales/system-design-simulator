// GENERATED FILE — do not edit by hand.
// Regenerate: npx tsx scripts/fetch-region-availability.ts <path-to-index.json>
//
// Derived from AWS's regional services feed (source:version 20251113063700).
// The feed is used offline as a fact source only; see the script header. Facts
// about which services exist in which regions are not copyrightable, and the
// feed itself is not redistributed.

export interface AwsRegion {
  code: string;
  label: string;
}

/** Snapshot date of the AWS data this file was generated from. */
export const REGION_DATA_VERSION = "20251113063700";

export const AWS_REGIONS: AwsRegion[] = [
  {
    "code": "af-south-1",
    "label": "Africa (Cape Town)"
  },
  {
    "code": "ap-east-1",
    "label": "Asia Pacific (Hong Kong)"
  },
  {
    "code": "ap-east-2",
    "label": "Asia Pacific (Taipei)"
  },
  {
    "code": "ap-northeast-1",
    "label": "Asia Pacific (Tokyo)"
  },
  {
    "code": "ap-northeast-2",
    "label": "Asia Pacific (Seoul)"
  },
  {
    "code": "ap-northeast-3",
    "label": "Asia Pacific (Osaka)"
  },
  {
    "code": "ap-south-1",
    "label": "Asia Pacific (Mumbai)"
  },
  {
    "code": "ap-south-2",
    "label": "Asia Pacific (Hyderabad)"
  },
  {
    "code": "ap-southeast-1",
    "label": "Asia Pacific (Singapore)"
  },
  {
    "code": "ap-southeast-2",
    "label": "Asia Pacific (Sydney)"
  },
  {
    "code": "ap-southeast-3",
    "label": "Asia Pacific (Jakarta)"
  },
  {
    "code": "ap-southeast-4",
    "label": "Asia Pacific (Melbourne)"
  },
  {
    "code": "ap-southeast-5",
    "label": "Asia Pacific (Malaysia)"
  },
  {
    "code": "ap-southeast-6",
    "label": "Asia Pacific (New Zealand)"
  },
  {
    "code": "ap-southeast-7",
    "label": "Asia Pacific (Thailand)"
  },
  {
    "code": "ca-central-1",
    "label": "Canada (Central)"
  },
  {
    "code": "ca-west-1",
    "label": "Canada West (Calgary)"
  },
  {
    "code": "eu-central-1",
    "label": "Europe (Frankfurt)"
  },
  {
    "code": "eu-central-2",
    "label": "Europe (Zurich)"
  },
  {
    "code": "eu-north-1",
    "label": "Europe (Stockholm)"
  },
  {
    "code": "eu-south-1",
    "label": "Europe (Milan)"
  },
  {
    "code": "eu-south-2",
    "label": "Europe (Spain)"
  },
  {
    "code": "eu-west-1",
    "label": "Europe (Ireland)"
  },
  {
    "code": "eu-west-2",
    "label": "Europe (London)"
  },
  {
    "code": "eu-west-3",
    "label": "Europe (Paris)"
  },
  {
    "code": "il-central-1",
    "label": "Israel (Tel Aviv)"
  },
  {
    "code": "me-central-1",
    "label": "Middle East (UAE)"
  },
  {
    "code": "me-south-1",
    "label": "Middle East (Bahrain)"
  },
  {
    "code": "mx-central-1",
    "label": "Mexico (Central)"
  },
  {
    "code": "sa-east-1",
    "label": "South America (Sao Paulo)"
  },
  {
    "code": "us-east-1",
    "label": "US East (N. Virginia)"
  },
  {
    "code": "us-east-2",
    "label": "US East (Ohio)"
  },
  {
    "code": "us-west-1",
    "label": "US West (N. California)"
  },
  {
    "code": "us-west-2",
    "label": "US West (Oregon)"
  }
];

/**
 * Catalog service id -> region codes where the service is NOT available.
 * Services absent from this map are available in every region we track.
 */
export const UNAVAILABLE_REGIONS: Record<string, string[]> = {
  "documentdb": [
    "ap-east-2",
    "ap-southeast-6",
    "me-south-1",
    "us-west-1"
  ],
  "appsync": [
    "ap-east-2",
    "ap-southeast-6",
    "mx-central-1"
  ],
  "neptune": [
    "ap-east-2",
    "ap-southeast-6",
    "eu-south-1",
    "mx-central-1"
  ]
};

/**
 * Catalog services missing from the AWS feed. We do not know their regional
 * availability and deliberately do not guess — the UI makes no availability
 * claim for these.
 */
export const UNKNOWN_AVAILABILITY: ReadonlySet<string> = new Set(["app-mesh","timestream"]);

/** True when `serviceId` is known to be unavailable in `region`. */
export function isUnavailableInRegion(serviceId: string, region: string): boolean {
  return UNAVAILABLE_REGIONS[serviceId]?.includes(region) ?? false;
}
