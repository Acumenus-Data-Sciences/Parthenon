// Phase 18 Plan 18-01 — RED Wave 0 stub for DrugClassesPanel (GENOMICS-11).
// Covers D-14 (90d pre-index ATC3 timeline) with verbatim UI-SPEC copy in the it.todo
// descriptions so the checker can grep for the expected strings.
// Plan 18-06 creates ../DrugClassesPanel and turns each it.todo into a real assertion.
import { describe, expect, it } from "vitest";

describe("DrugClassesPanel", () => {
  it("imports without error (RED until Plan 18-06)", async () => {
    await expect(import("../DrugClassesPanel")).resolves.toBeTruthy();
  });

  it.todo("renders horizontal Recharts BarChart with up to 10 rows");
  it.todo(
    "formats percentage labels as '{pct_on_drug.toFixed(1)}%' per UI-SPEC copy",
  );
  it.todo(
    "renders empty-state 'No drug records in the 90-day pre-index window for this endpoint × source.' when drugClasses=[] and sourceHasDrugData=true",
  );
  it.todo(
    "renders empty-state 'This source has no drug-exposure data.' when sourceHasDrugData=false",
  );
  it.todo(
    "renders denominator clarifier 'Subjects with no drug records in the 90d window are excluded from the denominator.'",
  );
});
