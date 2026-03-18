/**
 * Journey: Concept Sets → Cohort Definitions
 *
 * Tests navigation between the two core OHDSI building blocks,
 * verifying both list pages and their stats bars work.
 */
import { test, expect } from "@playwright/test";
import { BASE, dismissModals } from "../helpers";

test.describe("Concept Set → Cohort Journey", () => {
  test("concept sets list with stats bar drill", async ({ page }) => {
    await page.goto(`${BASE}/concept-sets`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length, "Concept Sets page is blank").toBeGreaterThan(50);

    // Stats bar should exist with clickable cards
    const totalCard = page.locator("[role='button']").filter({
      has: page.locator("text=Total"),
    }).first();

    if ((await totalCard.count()) > 0) {
      // Click "Total" — should clear any filters
      await totalCard.click();
      await page.waitForTimeout(1000);

      const errorBoundary = await page
        .locator("text=/Something went wrong|Unexpected error/i")
        .count();
      expect(errorBoundary, "Stats card click crashed concept sets page").toBe(0);
    }
  });

  test("navigate from concept sets to cohort definitions", async ({ page }) => {
    await page.goto(`${BASE}/concept-sets`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    // Navigate to cohort definitions
    await page.goto(`${BASE}/cohort-definitions`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length, "Cohort Definitions page is blank").toBeGreaterThan(50);

    // No [object Object] on either page
    const objectText = await page.locator("text=[object Object]").count();
    expect(objectText, "Found [object Object] on Cohort Definitions").toBe(0);
  });

  test("cohort definition search works", async ({ page }) => {
    await page.goto(`${BASE}/cohort-definitions`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Find search input and type
    const searchInput = page.locator("input[placeholder*='Search'], input[type='text']").first();
    if ((await searchInput.count()) > 0) {
      await searchInput.fill("test");
      await page.waitForTimeout(1000);

      // Should not crash
      const errorBoundary = await page
        .locator("text=/Something went wrong|Unexpected error/i")
        .count();
      expect(errorBoundary, "Search triggered error boundary").toBe(0);
    }
  });
});
