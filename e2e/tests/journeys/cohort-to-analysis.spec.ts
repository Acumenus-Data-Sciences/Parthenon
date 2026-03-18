/**
 * Journey: Cohort Definitions → view detail → Analyses page
 *
 * Tests navigation from the cohort list through to analyses,
 * verifying pages render and no errors occur along the way.
 */
import { test, expect } from "@playwright/test";
import { BASE, dismissModals, getFirstId } from "../helpers";

test.describe("Cohort → Analysis Journey", () => {
  test("cohort list loads and is navigable", async ({ page }) => {
    await page.goto(`${BASE}/cohort-definitions`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Stats bar should be visible
    const statsBar = page.locator("[role='button']").filter({
      has: page.locator("text=/Total|Generated|Public/i"),
    });
    expect(await statsBar.count(), "No stats bar on cohort definitions page").toBeGreaterThan(0);

    // Try clicking into first cohort if it exists
    const firstRow = page.locator("table tbody tr, [class*='card']").first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click();
      await page.waitForTimeout(2000);

      // Should be on a detail page or stay without crashing
      const errorBoundary = await page
        .locator("text=/Something went wrong|Unexpected error/i")
        .count();
      expect(errorBoundary, "Cohort detail page crashed").toBe(0);
    }
  });

  test("analyses page loads from navigation", async ({ page }) => {
    await page.goto(`${BASE}/cohort-definitions`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    // Navigate to analyses via sidebar or direct
    await page.goto(`${BASE}/analyses`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length, "Analyses page is blank").toBeGreaterThan(50);

    const errorBoundary = await page
      .locator("text=/Something went wrong|Unexpected error/i")
      .count();
    expect(errorBoundary, "Analyses page crashed").toBe(0);

    // Check for analysis type tabs
    const hasTabs = /Characterization|Incidence|Estimation|Prediction|Pathway/i.test(bodyText);
    expect(hasTabs, "Analyses page missing analysis type tabs").toBe(true);
  });
});
