import { describe, it, expect } from "vitest";
import { estimateCost } from "@/lib/cost";
import { INSTANCE_HOURLY, REGION_MULTIPLIER, PRICING } from "@/data/pricing";
import { runSimulation } from "@/engine/simulator";
import { testNode, testEdge } from "@/engine/testFixtures";
import { AWS_REGIONS } from "@/data/regionAvailability";

describe("pricing data", () => {
  // The SKU filter is the real risk in the generator: the same instance appears
  // with Windows licences, dedicated tenancy, and extended support at wildly
  // different prices. These are AWS's published us-east-1 on-demand rates.
  it.each([
    ["m5.large", 0.096],
    ["m5.xlarge", 0.192],
    ["t3.medium", 0.0416],
    ["c5.large", 0.085],
    ["cache.r6g.large", 0.206],
  ])("prices %s at $%s/hr", (type, expected) => {
    expect(INSTANCE_HOURLY[type]).toBeCloseTo(expected, 4);
  });

  it("never reads a free tier as the real rate", () => {
    // AWS expresses free-tier allowances as a first tier priced at zero.
    // Reading only the lowest tier prices these services at nothing.
    expect(PRICING.dynamodb.readUnitHour).toBeGreaterThan(0);
    expect(PRICING.dynamodb.writeUnitHour).toBeGreaterThan(0);
    expect(PRICING.s3.storageGBMonth.standard).toBeGreaterThan(0);
    expect(PRICING.lambda.gbSecond).toBeGreaterThan(0);
  });

  it("anchors us-east-1 at exactly 1.0", () => {
    // A wrong SKU in the region loop once made us-east-1 come out at 0.801x
    // itself, which silently skewed every other region.
    expect(REGION_MULTIPLIER["us-east-1"]).toBe(1);
  });

  it("covers every region the selector offers", () => {
    for (const r of AWS_REGIONS) {
      expect(REGION_MULTIPLIER[r.code], r.code).toBeGreaterThan(0);
    }
  });
});

describe("cost estimation", () => {
  const price = (nodes: Parameters<typeof estimateCost>[0], region = "us-east-1") =>
    estimateCost(nodes, null, region).monthlyTotal;

  it("bills instance hours at 730 hours a month", () => {
    const monthly = price([testNode("a", "ec2", { config: { size: "m5.large" } })]);
    expect(monthly).toBeCloseTo(0.096 * 730, 1);
  });

  it("scales with instance count", () => {
    const one = price([testNode("a", "ec2", { replicas: 1 })]);
    const four = price([testNode("a", "ec2", { replicas: 4 })]);
    expect(four).toBeCloseTo(one * 4, 1);
  });

  it("scales with instance size", () => {
    const small = price([testNode("a", "ec2", { config: { size: "m5.large" } })]);
    const big = price([testNode("a", "ec2", { config: { size: "m5.4xlarge" } })]);
    expect(big).toBeCloseTo(small * 8, 1);
  });

  it("applies the regional multiplier", () => {
    const home = price([testNode("a", "ec2")]);
    const brazil = price([testNode("a", "ec2")], "sa-east-1");
    expect(brazil).toBeCloseTo(home * REGION_MULTIPLIER["sa-east-1"], 1);
  });

  it("charges an idle node for its instance hours", () => {
    // Capacity you provisioned costs money whether or not traffic arrives.
    expect(price([testNode("a", "ec2")])).toBeGreaterThan(0);
  });

  it("reports that requests and transfer need a simulation", () => {
    const breakdown = estimateCost([testNode("a", "api-gateway")], null, "us-east-1");
    expect(breakdown.needsSimulation).toBe(true);
  });

  it("prices requests once traffic is known", () => {
    const nodes = [testNode("gw", "api-gateway"), testNode("app", "ec2")];
    const sim = runSimulation(nodes, [testEdge("gw", "app")], 10000, 1);
    const withTraffic = estimateCost(nodes, sim.nodeMetrics, "us-east-1");
    const without = estimateCost(nodes, null, "us-east-1");
    expect(withTraffic.monthlyTotal).toBeGreaterThan(without.monthlyTotal);
    expect(withTraffic.needsSimulation).toBe(false);
  });

  it("sorts line items with the largest first", () => {
    const nodes = [
      testNode("small", "ec2", { config: { size: "m5.large" } }),
      testNode("big", "ec2", { config: { size: "m5.24xlarge" } }),
    ];
    const lines = estimateCost(nodes, null, "us-east-1").lines;
    expect(lines[0].monthly).toBeGreaterThanOrEqual(lines[1].monthly);
  });
});
