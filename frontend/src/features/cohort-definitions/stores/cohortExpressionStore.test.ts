import { describe, expect, it } from "vitest";
import { normalizeCohortExpression } from "./cohortExpressionStore";

describe("normalizeCohortExpression", () => {
  it("fills missing cohort expression arrays with safe defaults", () => {
    const normalized = normalizeCohortExpression({
      PrimaryCriteria: {},
      AdditionalCriteria: {
        Type: "ALL",
        CriteriaList: undefined as never,
        Groups: undefined as never,
      },
      ConceptSets: [
        {
          id: 9,
          name: "Malformed concept set",
          expression: undefined as never,
        },
      ] as never,
    });

    expect(normalized.ConceptSets).toHaveLength(1);
    expect(normalized.ConceptSets[0]?.expression.items).toEqual([]);
    expect(normalized.PrimaryCriteria.CriteriaList).toEqual([]);
    expect(normalized.PrimaryCriteria.ObservationWindow).toEqual({
      PriorDays: 0,
      PostDays: 0,
    });
    expect(normalized.AdditionalCriteria).toEqual({
      Type: "ALL",
      CriteriaList: [],
      Groups: [],
    });
    expect(normalized.CensoringCriteria).toEqual([]);
    expect(normalized.DemographicCriteria).toEqual([]);
    expect(normalized.GenomicCriteria).toEqual([]);
    expect(normalized.ImagingCriteria).toEqual([]);
  });
});
