import { test, expect } from "@playwright/test";
import { BASE, assertPageLoads, collectErrors } from "./helpers";

test.describe("Help System", () => {
  test("help button visible in sidebar", async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Look for the help button in sidebar — it has aria-label "Open contextual help"
    const helpBtn = page.locator('[aria-label="Open contextual help"]');
    const count = await helpBtn.count();
    if (count === 0) {
      // Fallback: look for HelpCircle icon button
      const helpAlt = page.locator('button[title="Help"]');
      expect(await helpAlt.count(), "Help button should be visible in sidebar").toBeGreaterThan(0);
    } else {
      expect(count).toBeGreaterThan(0);
    }
  });

  test("click help opens slide-over with content", async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Click help button
    const helpBtn = page.locator(
      '[aria-label="Open contextual help"], button[title="Help"]',
    ).first();
    await helpBtn.click();
    await page.waitForTimeout(1500);

    // A slide-over / drawer / panel should appear
    // Look for role="dialog" or a panel with help content
    const slideOver = page.locator(
      '[role="dialog"], [class*="slide"], [class*="drawer"], [class*="panel"]',
    );
    const slideOverCount = await slideOver.count();
    expect(
      slideOverCount,
      "Help slide-over should appear after clicking help button",
    ).toBeGreaterThan(0);

    // Help content should have some text
    const body = await page.evaluate(() => document.body.innerText);
    expect(body.length).toBeGreaterThan(50);

    // No crashes
    const crashes = errors.pageErrors.filter((e) =>
      e.includes("Cannot read properties"),
    );
    expect(crashes.length).toBe(0);
  });

  test("help content changes based on current route", async ({ page }) => {
    const errors = collectErrors(page);

    // Navigate to studies page and open help
    await page.goto(`${BASE}/studies`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const helpBtn = page.locator(
      '[aria-label="Open contextual help"], button[title="Help"]',
    ).first();
    await helpBtn.click();
    await page.waitForTimeout(1500);

    // Capture help content text on studies page
    const slideOverStudies = page.locator(
      '[role="dialog"], [class*="slide"], [class*="drawer"]',
    ).first();
    const studiesHelpText = (await slideOverStudies.count()) > 0
      ? await slideOverStudies.innerText()
      : "";
    console.log(`  Studies help text length: ${studiesHelpText.length}`);

    // Close help
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Navigate to data-sources and open help
    await page.goto(`${BASE}/data-sources`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const helpBtn2 = page.locator(
      '[aria-label="Open contextual help"], button[title="Help"]',
    ).first();
    await helpBtn2.click();
    await page.waitForTimeout(1500);

    const slideOverSources = page.locator(
      '[role="dialog"], [class*="slide"], [class*="drawer"]',
    ).first();
    const sourcesHelpText = (await slideOverSources.count()) > 0
      ? await slideOverSources.innerText()
      : "";
    console.log(`  Sources help text length: ${sourcesHelpText.length}`);

    // If both have help content, they should be different (context-sensitive)
    if (studiesHelpText.length > 20 && sourcesHelpText.length > 20) {
      expect(
        studiesHelpText,
        "Help content should differ between routes",
      ).not.toBe(sourcesHelpText);
    }

    // No crashes
    const crashes = errors.pageErrors.filter((e) =>
      e.includes("Cannot read properties"),
    );
    expect(crashes.length).toBe(0);
  });

  test("close help dismisses slide-over", async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Open help
    const helpBtn = page.locator(
      '[aria-label="Open contextual help"], button[title="Help"]',
    ).first();
    await helpBtn.click();
    await page.waitForTimeout(1500);

    // Verify slide-over is open
    let slideOvers = await page
      .locator('[role="dialog"], [class*="slide"], [class*="drawer"]')
      .count();
    expect(slideOvers).toBeGreaterThan(0);

    // Close with Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);

    // Slide-over should be gone or hidden
    // Check if dialog is still visible
    const visibleDialogs = page.locator('[role="dialog"]:visible');
    const count = await visibleDialogs.count();
    // Either no visible dialogs, or the slide-over has been dismissed
    expect(count).toBeLessThanOrEqual(0);
  });
});
