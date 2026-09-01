import { describe, it, expect } from "vitest";
import { assetPath } from "./assetPath";

describe("assetPath", () => {
  it("returns the path unchanged at a domain root", () => {
    expect(assetPath("/logo-mark.svg", "")).toBe("/logo-mark.svg");
  });

  it("prefixes the base path of a project site", () => {
    expect(assetPath("/aws-icons/ec2.svg", "/system-design-simulator")).toBe(
      "/system-design-simulator/aws-icons/ec2.svg",
    );
  });

  it("keeps exactly one slash between base path and a relative path", () => {
    expect(assetPath("logo-mark.svg", "/repo")).toBe("/repo/logo-mark.svg");
  });

  it("never emits a double slash from a trailing-slashed base path", () => {
    expect(assetPath("/logo-mark.svg", "/repo/")).toBe("/repo/logo-mark.svg");
  });
});
