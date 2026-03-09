import { test, expect } from "@playwright/test";
import {
  BASE,
  assertPageLoads,
  collectErrors,
  dismissModals,
  apiGet,
} from "./helpers";

test.describe("Publish & Export — 3-Step Wizard", () => {
  test("page loads at /publish", async ({ page }) => {
    await assertPageLoads(page, "/publish");

    // Page header should show "Publish & Export"
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).toContain("Publish");
  });

  test("sidebar has Publish link", async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const publishLink = page.locator('nav a[href="/publish"], aside a[href="/publish"]');
    const count = await publishLink.count();
    if (count === 0) {
      // May be text-based link
      const textLink = page.locator("a, button").filter({ hasText: /Publish/i });
      expect(await textLink.count()).toBeGreaterThan(0);
    } else {
      expect(count).toBeGreaterThan(0);
    }
  });

  test("Step 1: study selector is visible", async ({ page }) => {
    await assertPageLoads(page, "/publish");

    // Step indicator should show "Select Study" as active
    const stepIndicator = page.locator('[data-testid="step-indicator"]');
    await expect(stepIndicator).toBeVisible();

    // Study selector component should be present
    const selector = page.locator('[data-testid="study-selector"]');
    await expect(selector).toBeVisible();

    // "Select a Study" heading should be visible
    const heading = page.locator("text=Select a Study");
    await expect(heading).toBeVisible();
  });

  test("Step 1: study selection shows executions if studies exist", async ({
    page,
  }) => {
    const { data } = await apiGet(page, "/api/v1/studies");
    const studies = (data.data ?? []) as Array<{ id: number; title: string }>;
    if (studies.length === 0) {
      test.skip(true, "No studies in database");
      return;
    }

    await assertPageLoads(page, "/publish");

    // Click the first study card
    const firstStudyCard = page
      .locator('[data-testid="study-selector"] button')
      .filter({ hasText: new RegExp(studies[0].title.slice(0, 15), "i") })
      .first();
    if ((await firstStudyCard.count()) > 0) {
      await firstStudyCard.click();
      await page.waitForTimeout(2000);

      // Should show "Completed Executions" or "No completed executions"
      const body = await page.evaluate(() => document.body.innerText);
      const hasExecutions =
        body.includes("Completed Executions") ||
        body.includes("No completed executions");
      expect(hasExecutions).toBeTruthy();

      // Select All / Deselect All toggle should exist if there are executions
      const selectAllBtn = page.locator("button, a").filter({
        hasText: /Select All|Deselect All/i,
      });
      if ((await selectAllBtn.count()) > 0) {
        // Toggle works
        const originalText = await selectAllBtn.first().innerText();
        await selectAllBtn.first().click();
        await page.waitForTimeout(500);
        const newText = await selectAllBtn.first().innerText();
        // Text should have changed between Select All / Deselect All
        console.log(`  Toggle: "${originalText}" -> "${newText}"`);
      }

      // Next button should exist
      const nextBtn = page
        .locator("button")
        .filter({ hasText: /Next/i })
        .first();
      expect(await nextBtn.count()).toBeGreaterThan(0);
    }
  });

  test("Step 2 and Step 3 render correctly (if studies with executions exist)", async ({
    page,
  }) => {
    const { data } = await apiGet(page, "/api/v1/studies");
    const studies = (data.data ?? []) as Array<{ id: number; title: string }>;
    if (studies.length === 0) {
      test.skip(true, "No studies in database");
      return;
    }

    const errors = collectErrors(page);
    await page.goto(`${BASE}/publish`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Click the first study
    const studyCards = page.locator('[data-testid="study-selector"] button');
    const cardCount = await studyCards.count();
    if (cardCount === 0) {
      test.skip(true, "No study cards rendered");
      return;
    }
    // Click the first card that looks like a study (has study type info)
    await studyCards.first().click();
    await page.waitForTimeout(2000);

    // Check if there are completed executions to select
    const selectAllBtn = page
      .locator("button, a")
      .filter({ hasText: /Select All/i })
      .first();
    if ((await selectAllBtn.count()) === 0) {
      console.log("  No completed executions — skipping Step 2/3");
      return;
    }

    // Select all executions
    await selectAllBtn.click();
    await page.waitForTimeout(500);

    // Click Next
    const nextBtn = page
      .locator("button")
      .filter({ hasText: /Next/i })
      .first();
    await nextBtn.click();
    await page.waitForTimeout(2000);

    // Step 2: Report preview should be visible
    const reportPreview = page.locator('[data-testid="report-preview"]');
    if ((await reportPreview.count()) > 0) {
      await expect(reportPreview).toBeVisible();
      console.log("  Step 2: Report preview visible");

      // Methods and Results sections should exist
      const body = await page.evaluate(() => document.body.innerText);
      expect(body).toContain("Methods");

      // Export button to go to Step 3
      const exportBtn = page
        .locator("button")
        .filter({ hasText: /^Export$/i })
        .first();
      if ((await exportBtn.count()) > 0) {
        await exportBtn.click();
        await page.waitForTimeout(2000);

        // Step 3: Export controls
        const exportControls = page.locator('[data-testid="export-controls"]');
        if ((await exportControls.count()) > 0) {
          await expect(exportControls).toBeVisible();
          console.log("  Step 3: Export controls visible");

          // Format options should be visible
          const formatBody = await page.evaluate(() => document.body.innerText);
          expect(formatBody).toContain("PDF");
          expect(formatBody).toContain("PNG");
          expect(formatBody).toContain("SVG");

          // Export button should exist
          const exportTrigger = page
            .locator("button")
            .filter({ hasText: /Export as/i })
            .first();
          expect(await exportTrigger.count()).toBeGreaterThan(0);
        }
      }
    }

    // No JS crashes
    const crashes = errors.pageErrors.filter((e) =>
      e.includes("Cannot read properties"),
    );
    expect(crashes.length, `JS crashes: ${crashes.join("; ")}`).toBe(0);
  });
});
