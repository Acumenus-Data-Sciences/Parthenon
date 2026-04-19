// Phase 18 Plan 18-01 — RED Wave 0 stub for ComorbidityMatrixPanel (GENOMICS-10).
// Covers D-06 (click-through navigation) and D-07 (divergent crimson/teal heatmap scale).
// The click-through todo asserts on the exact search-string pattern `tab=profile` so the
// key_links contract in 18-01-PLAN.md frontmatter has a grep target.
// Plan 18-06 creates ../ComorbidityMatrixPanel and turns each it.todo into a real assertion.
import { describe, expect, it } from "vitest";

describe("ComorbidityMatrixPanel", () => {
  it("imports without error (RED until Plan 18-06)", async () => {
    await expect(import("../ComorbidityMatrixPanel")).resolves.toBeTruthy();
  });

  it.todo("renders 50 rows (ranked) in a single-column HTML/CSS grid layout");
  it.todo("applies crimson color class when phi >= 0.20 per D-07");
  it.todo("applies teal color class when phi <= -0.05 per D-07");
  it.todo("applies neutral-gray noise-floor class when |phi| < 0.05 per D-07");
  it.todo(
    "calls onNavigate with ?open=NEW&tab=profile&source=PANCREAS when row is clicked",
  );
  it.todo("shows tooltip with phi + OR + CI when row is hovered");
  it.todo(
    "renders empty-state 'Only {N} FinnGen endpoints have ≥ 20 subjects on this source.' when universeSize < 50",
  );
});
