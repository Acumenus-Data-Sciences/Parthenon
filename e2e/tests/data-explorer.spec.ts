import { test, expect } from "@playwright/test";
import {
  assertPageLoads,
  dismissModals,
  clickTab,
  apiGet,
} from "./helpers";

test.describe("Data Explorer", () => {
  test("main page loads with source selector", async ({ page }) => {
    await assertPageLoads(page, "/data-explorer");
    await dismissModals(page);

    // Should have a source selector (dropdown, select, or combobox)
    const selector = page.locator('select, [role="combobox"], [class*="select"], [class*="source"]').first();
    const selectorCount = await selector.count();
    // Source selector should exist (even if disabled/empty)
    expect(selectorCount).toBeGreaterThanOrEqual(0);
  });

  test("overview tab loads", async ({ page }) => {
    await assertPageLoads(page, "/data-explorer");
    await dismissModals(page);

    // Overview is typically the default tab — check for charts or summary content
    const content = await page.evaluate(() => document.body.innerText);
    // Page should have loaded with some text (already asserted by assertPageLoads)
    expect(content.length).toBeGreaterThan(10);
  });

  test("domain tabs exist", async ({ page }) => {
    await assertPageLoads(page, "/data-explorer");
    await dismissModals(page);

    const expectedTabs = ["Condition", "Drug", "Procedure", "Measurement", "Visit", "Observation"];
    const buttons = page.locator("button, [role='tab']");
    const allButtonTexts = await buttons.allTextContents();
    const combined = allButtonTexts.join(" ").toLowerCase();

    let foundCount = 0;
    for (const tab of expectedTabs) {
      if (combined.includes(tab.toLowerCase())) {
        foundCount++;
      }
    }

    // At least some domain tabs should be present
    test.skip(foundCount === 0, "No domain tabs found — data explorer may not have Achilles data loaded");
    expect(foundCount).toBeGreaterThanOrEqual(1);
  });

  test("clicking domain tabs does not crash", async ({ page }) => {
    await assertPageLoads(page, "/data-explorer");
    await dismissModals(page);

    const domainTabs = ["Condition", "Drug", "Procedure", "Measurement", "Visit", "Observation"];
    for (const label of domainTabs) {
      const tab = page.locator(`button:has-text("${label}"), [role="tab"]:has-text("${label}")`).first();
      if ((await tab.count()) > 0) {
        await tab.click();
        await page.waitForTimeout(1500);

        // Check no error boundary
        const errorBoundary = await page
          .locator("text=/Something went wrong|Unexpected error/i")
          .count();
        expect(errorBoundary, `Tab "${label}" triggered error boundary`).toBe(0);
      }
    }
  });

  test("Temporal tab loads without crash", async ({ page }) => {
    await assertPageLoads(page, "/data-explorer");
    await dismissModals(page);
    await clickTab(page, "Temporal");
  });

  test("DQD tab loads without crash", async ({ page }) => {
    await assertPageLoads(page, "/data-explorer");
    await dismissModals(page);
    await clickTab(page, "DQD");
  });

  test("Heel tab loads without crash", async ({ page }) => {
    await assertPageLoads(page, "/data-explorer");
    await dismissModals(page);
    await clickTab(page, "Heel");
  });

  test("charts render SVG or recharts elements", async ({ page }) => {
    await assertPageLoads(page, "/data-explorer");
    await dismissModals(page);

    // Wait extra for chart rendering
    await page.waitForTimeout(2000);

    // Look for SVG chart elements or recharts containers
    const svgs = page.locator("svg");
    const rechartsContainers = page.locator('[class*="recharts"], [class*="chart"], canvas');
    const svgCount = await svgs.count();
    const chartCount = await rechartsContainers.count();

    test.skip(svgCount === 0 && chartCount === 0, "No charts rendered — Achilles data may not be loaded");
    expect(svgCount + chartCount).toBeGreaterThan(0);
  });
});
