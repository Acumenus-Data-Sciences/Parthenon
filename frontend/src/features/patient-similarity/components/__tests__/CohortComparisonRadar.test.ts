import { describe, expect, it } from "vitest";
import { buildCohortComparisonRadarModel } from "../CohortComparisonRadar.model";

describe("buildCohortComparisonRadarModel", () => {
  it("uses divergence scores rather than cohort coverage", () => {
    const model = buildCohortComparisonRadarModel({
      demographics: { score: 0.2, label: "Similar" },
      conditions: { score: 0.3847, label: "Moderate" },
      drugs: { score: 0.6244, label: "Divergent" },
    });

    expect(model.data).toEqual([
      { dimension: "Demographics", divergence: 20, fullMark: 100 },
      { dimension: "Conditions", divergence: 38, fullMark: 100 },
      { dimension: "Drugs", divergence: 62, fullMark: 100 },
    ]);
  });

  it("omits dimensions with no comparable data from the radar", () => {
    const model = buildCohortComparisonRadarModel({
      genomics: { score: 0, label: "No data" },
      procedures: { score: 0.4721, label: "Moderate" },
    });

    expect(model.data).toEqual([
      { dimension: "Procedures", divergence: 47, fullMark: 100 },
    ]);
    expect(model.unavailableDimensions).toEqual(["Genomics"]);
  });
});
