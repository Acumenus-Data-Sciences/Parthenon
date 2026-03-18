/**
 * Regression guard: GEN-01 — Genomic Analysis has source selector (not hardcoded)
 *
 * Catches: Hardcoded sourceId=9 that locks analysis to one data source.
 */
import { test, expect } from "@playwright/test";
import { BASE } from "../helpers";

test.describe("Genomics Source Selector Regression", () => {
  test("analysis page has a source selector dropdown", async ({ page }) => {
    await page.goto(`${BASE}/genomics/analysis`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Look for a select/dropdown element with source-related content
    const sourceSelector = page.locator(
      "select, [role='combobox'], [role='listbox'], button:has-text('Select'), button:has-text('Source'), button:has-text('Eunomia'), button:has-text('Acumenus')"
    );
    const count = await sourceSelector.count();
    expect(
      count,
      "No source selector found on Genomic Analysis page — may be hardcoded"
    ).toBeGreaterThan(0);
  });

  test("analysis page loads without errors", async ({ page }) => {
    await page.goto(`${BASE}/genomics/analysis`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const errorBoundary = await page
      .locator("text=/Something went wrong|Unexpected error/i")
      .count();
    expect(errorBoundary, "Genomics Analysis hit error boundary").toBe(0);
  });
});
