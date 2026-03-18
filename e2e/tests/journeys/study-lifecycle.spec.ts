/**
 * Journey: Studies list → detail → tabs
 *
 * Tests the study lifecycle UI: list page with stats,
 * drill into a study detail, navigate through detail tabs.
 */
import { test, expect } from "@playwright/test";
import { BASE, dismissModals, getFirstId } from "../helpers";

test.describe("Study Lifecycle Journey", () => {
  test("studies list loads with stats", async ({ page }) => {
    await page.goto(`${BASE}/studies`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length, "Studies page is blank").toBeGreaterThan(50);

    // No crash
    const errorBoundary = await page
      .locator("text=/Something went wrong|Unexpected error/i")
      .count();
    expect(errorBoundary, "Studies page crashed").toBe(0);

    // No [object Object]
    const objectText = await page.locator("text=[object Object]").count();
    expect(objectText, "Found [object Object] on Studies page").toBe(0);
  });

  test("study detail page loads if studies exist", async ({ page }) => {
    const firstId = await getFirstId(page, "/api/v1/studies");

    if (firstId) {
      await page.goto(`${BASE}/studies/${firstId}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      await dismissModals(page);

      // Should show study detail content
      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(bodyText.length, "Study detail page is blank").toBeGreaterThan(50);

      const errorBoundary = await page
        .locator("text=/Something went wrong|Unexpected error/i")
        .count();
      expect(errorBoundary, "Study detail page crashed").toBe(0);

      // Try clicking through tabs
      const tabLabels = ["Overview", "Cohorts", "Analyses", "Results", "Activity"];
      for (const label of tabLabels) {
        const tab = page.locator(`button:has-text("${label}")`).first();
        if ((await tab.count()) > 0) {
          await tab.click();
          await page.waitForTimeout(1000);

          const crash = await page
            .locator("text=/Something went wrong|Unexpected error/i")
            .count();
          expect(crash, `Study tab "${label}" crashed`).toBe(0);
        }
      }
    } else {
      console.log("  ⚠ No studies found — skipping detail test");
    }
  });

  test("studies search and filter work", async ({ page }) => {
    await page.goto(`${BASE}/studies`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Search
    const searchInput = page.locator("input[placeholder*='Search'], input[type='text']").first();
    if ((await searchInput.count()) > 0) {
      await searchInput.fill("test");
      await page.waitForTimeout(1000);

      const errorBoundary = await page
        .locator("text=/Something went wrong|Unexpected error/i")
        .count();
      expect(errorBoundary, "Studies search crashed").toBe(0);
    }
  });
});
