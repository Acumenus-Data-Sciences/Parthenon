// Phase 18 Plan 18-01 — RED Wave 0 stub for SurvivalPanel (GENOMICS-09).
// Covers D-03 (age-at-death 5-year bins) and D-15 (source eligibility / disabled banner).
// Plan 18-06 creates ../SurvivalPanel and turns each it.todo into a real assertion.
import { describe, expect, it } from "vitest";

describe("SurvivalPanel", () => {
  it("imports without error (RED until Plan 18-06)", async () => {
    await expect(import("../SurvivalPanel")).resolves.toBeTruthy();
  });

  it.todo(
    "renders disabled-banner with exact copy 'No death data in this source — survival panel disabled.' when sourceHasDeathData=false",
  );
  it.todo(
    "renders 3 StatTiles (Median survival, Deaths, Subjects at index) when sourceHasDeathData=true",
  );
  it.todo("renders '—' for Median survival when death_count < 20");
  it.todo("renders KaplanMeierPlot when death_count > 0");
  it.todo(
    "renders age-at-death BarChart with 5-year bins from summary.age_at_death_bins",
  );
});
