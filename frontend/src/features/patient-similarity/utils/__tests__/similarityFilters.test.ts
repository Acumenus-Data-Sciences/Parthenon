import { describe, expect, it } from "vitest";
import { buildSimilarityFilters } from "../similarityFilters";

describe("buildSimilarityFilters", () => {
  it("returns undefined when no filters are provided", () => {
    expect(buildSimilarityFilters("", "", "")).toBeUndefined();
  });

  it("builds the canonical filter shape with fallback age bounds", () => {
    expect(buildSimilarityFilters("40", "", "FEMALE")).toEqual({
      age_range: [40, 150],
      gender_concept_id: 8532,
    });
  });

  it("clamps invalid ages into the supported range", () => {
    expect(buildSimilarityFilters("-5", "200", "MALE")).toEqual({
      age_range: [0, 150],
      gender_concept_id: 8507,
    });
  });
});
