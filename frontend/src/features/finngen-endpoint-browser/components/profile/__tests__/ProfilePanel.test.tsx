// Phase 18 Plan 18-01 — RED Wave 0 stub for ProfilePanel (GENOMICS-09/10/11).
// Plan 18-06 creates ../ProfilePanel and turns each it.todo into a real assertion.
// The first it() below dynamically imports the component and fails at runtime until
// Plan 18-06 lands the component file — that is the RED signal Vitest catches.
import { describe, expect, it } from "vitest";

describe("ProfilePanel", () => {
  it("imports without error (RED until Plan 18-06 creates the component)", async () => {
    // Dynamic import resolves the module on demand. Until Plan 18-06 creates
    // `../ProfilePanel.tsx`, this rejects with an unresolved-module error.
    await expect(import("../ProfilePanel")).resolves.toBeTruthy();
  });

  it.todo(
    "auto-dispatches compute when envelope.status === 'needs_compute'",
  );
  it.todo(
    "renders SurvivalPanel + ComorbidityMatrixPanel + DrugClassesPanel when envelope.status === 'cached'",
  );
  it.todo(
    "renders single error banner when envelope.status === 'ineligible'",
  );
  it.todo(
    "renders back-breadcrumb when navigated in via click-through",
  );
  it.todo(
    "polls read endpoint every 3s while dispatch is in-flight; stops on first cached response",
  );
});
