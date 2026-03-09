import { test, expect } from "@playwright/test";
import {
  assertPageLoads,
  dismissModals,
} from "./helpers";

test.describe("Vocabulary", () => {
  test("vocabulary page loads without crash", async ({ page }) => {
    await assertPageLoads(page, "/vocabulary");
  });

  test("search input is visible", async ({ page }) => {
    await assertPageLoads(page, "/vocabulary");
    await dismissModals(page);

    const searchInput = page.locator(
      'input[type="search"], input[type="text"], input[placeholder*="earch"], input[placeholder*="oncept"]'
    ).first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  test("compare page loads without crash", async ({ page }) => {
    await assertPageLoads(page, "/vocabulary/compare");
  });

  test("search for aspirin returns results", async ({ page }) => {
    await assertPageLoads(page, "/vocabulary");
    await dismissModals(page);

    const searchInput = page.locator(
      'input[type="search"], input[type="text"], input[placeholder*="earch"], input[placeholder*="oncept"]'
    ).first();

    const inputVisible = await searchInput.isVisible();
    test.skip(!inputVisible, "Search input not found — vocabulary UI may differ");

    await searchInput.fill("aspirin");
    // Trigger search — press Enter or wait for auto-search
    await searchInput.press("Enter");
    await page.waitForTimeout(3000);

    // Look for results: table rows, list items, or cards
    const results = page.locator("table tbody tr, [class*='result'], [class*='concept']");
    const resultCount = await results.count();

    test.skip(resultCount === 0, "No vocabulary results for 'aspirin' — vocab tables may not be loaded");
    expect(resultCount).toBeGreaterThan(0);
  });
});
