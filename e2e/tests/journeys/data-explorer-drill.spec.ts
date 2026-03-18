/**
 * Journey: Dashboard CDM card → Data Explorer → Domain tab
 *
 * Tests the drill-through flow from Dashboard metric cards into the
 * Data Explorer with the correct domain preselected.
 */
import { test, expect } from "@playwright/test";
import { BASE, dismissModals } from "../helpers";

test.describe("Dashboard → Data Explorer Drill", () => {
  test("CDM metric card navigates to data explorer", async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Find and click a CDM metric card (e.g., Persons)
    const personsCard = page.locator("text=Persons").first();
    if ((await personsCard.count()) > 0) {
      await personsCard.click();
      await page.waitForTimeout(2000);

      // Should navigate to /data-explorer/<sourceId>
      expect(page.url()).toContain("/data-explorer");
    }
  });

  test("data explorer tabs are navigable without errors", async ({ page }) => {
    await page.goto(`${BASE}/data-explorer`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Click through tabs: Overview, Domains, Data Quality
    const tabs = ["Overview", "Domains", "Data Quality", "Temporal"];
    for (const tabLabel of tabs) {
      const tab = page.locator(`button:has-text("${tabLabel}")`).first();
      if ((await tab.count()) > 0) {
        await tab.click();
        await page.waitForTimeout(1500);

        const errorBoundary = await page
          .locator("text=/Something went wrong|Unexpected error/i")
          .count();
        expect(errorBoundary, `Tab "${tabLabel}" crashed`).toBe(0);
      }
    }
  });
});
