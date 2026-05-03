import { describe, it, expect } from "vitest";
import { etlTemplatesEn } from "../etlTemplatesResources";

describe("etlTemplatesResources", () => {
  it("declares the aqueduct.subtabs leaf keys", () => {
    expect(etlTemplatesEn.aqueduct.subtabs.mappings).toBe("Mappings");
    expect(etlTemplatesEn.aqueduct.subtabs.templates).toBe("Templates");
    expect(etlTemplatesEn.aqueduct.subtabs.runs).toBe("Runs");
  });
});
