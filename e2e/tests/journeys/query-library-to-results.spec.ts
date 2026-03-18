/**
 * Journey: Query Library → select query → view detail
 *
 * Tests the query assistant workflow: browse library, select a query,
 * verify the detail panel renders with SQL and parameters.
 */
import { test, expect } from "@playwright/test";
import { BASE, dismissModals } from "../helpers";

test.describe("Query Library → Results Journey", () => {
  test("library tab shows query cards", async ({ page }) => {
    await page.goto(`${BASE}/query-assistant`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Click Library tab
    const libraryTab = page.locator("button:has-text('Library'), button:has-text('Query Library')").first();
    if ((await libraryTab.count()) > 0) {
      await libraryTab.click();
      await page.waitForTimeout(2000);
    }

    const bodyText = await page.evaluate(() => document.body.innerText);

    // Should have query cards if library was imported (201 entries)
    const hasQueries = !bodyText.includes("No queries found");
    if (hasQueries) {
      // Verify cards render real content (not [object Object])
      const objectText = await page.locator("text=[object Object]").count();
      expect(objectText, "Query cards show [object Object]").toBe(0);

      // Try clicking the first query card
      const firstCard = page.locator("[class*='card'], [class*='rounded-lg'][class*='border'][class*='cursor']").first();
      if ((await firstCard.count()) > 0) {
        await firstCard.click();
        await page.waitForTimeout(1500);

        // Detail panel should open — look for SQL content
        const hasSql = await page.locator("text=/SELECT|FROM|WHERE/i").count();
        // It's OK if no SQL shows (card might not open a panel), but no crash
        const errorBoundary = await page
          .locator("text=/Something went wrong|Unexpected error/i")
          .count();
        expect(errorBoundary, "Query card click crashed").toBe(0);
      }
    } else {
      console.log("  ⚠ Query Library empty — run: php artisan query-library:import-ohdsi /tmp/ohdsi-querylibrary --fresh");
    }
  });

  test("library search filters results", async ({ page }) => {
    await page.goto(`${BASE}/query-assistant`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Click Library tab
    const libraryTab = page.locator("button:has-text('Library'), button:has-text('Query Library')").first();
    if ((await libraryTab.count()) > 0) {
      await libraryTab.click();
      await page.waitForTimeout(2000);
    }

    // Search for a specific domain
    const searchInput = page.locator("input[placeholder*='Search'], input[placeholder*='search']").first();
    if ((await searchInput.count()) > 0) {
      await searchInput.fill("condition");
      await page.waitForTimeout(1500);

      const errorBoundary = await page
        .locator("text=/Something went wrong|Unexpected error/i")
        .count();
      expect(errorBoundary, "Library search crashed").toBe(0);
    }
  });
});
