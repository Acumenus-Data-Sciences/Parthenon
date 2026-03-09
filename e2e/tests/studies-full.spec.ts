import { test, expect } from "@playwright/test";
import {
  BASE,
  assertPageLoads,
  collectErrors,
  dismissModals,
  clickTab,
  apiGet,
  getFirstId,
} from "./helpers";

test.describe("Studies — Comprehensive", () => {
  test("list page loads with study cards or empty state", async ({ page }) => {
    await assertPageLoads(page, "/studies");

    // Should have either study cards or an empty-state message
    const body = await page.evaluate(() => document.body.innerText);
    expect(body.length).toBeGreaterThan(20);
  });

  test("API: GET /api/v1/studies returns 200", async ({ page }) => {
    const { status, data } = await apiGet(page, "/api/v1/studies");
    expect(status).toBe(200);
    expect(data).toBeDefined();
  });

  test("study detail page loads if studies exist", async ({ page }) => {
    const { status, data } = await apiGet(page, "/api/v1/studies?per_page=1");
    expect(status).toBe(200);
    const studies = data.data ?? [];
    if (studies.length === 0) {
      test.skip(true, "No studies in database");
      return;
    }
    const slug = studies[0].slug ?? studies[0].id;
    console.log(`  Testing study detail: ${slug}`);

    await assertPageLoads(page, `/studies/${slug}`);

    // Detail page should show the study title somewhere
    const body = await page.evaluate(() => document.body.innerText);
    expect(body.toLowerCase()).toContain(studies[0].title.toLowerCase().slice(0, 10));
  });

  test("study detail — all 9 tabs load without crash", async ({ page }) => {
    const { data } = await apiGet(page, "/api/v1/studies?per_page=1");
    const studies = data.data ?? [];
    if (studies.length === 0) {
      test.skip(true, "No studies in database");
      return;
    }
    const slug = studies[0].slug ?? studies[0].id;
    const errors = collectErrors(page);

    await page.goto(`${BASE}/studies/${slug}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    const tabLabels = [
      "Design",
      "Analyses",
      "Results",
      "Sites",
      "Team",
      "Cohorts",
      "Milestones",
      "Artifacts",
      "Activity",
    ];

    for (const label of tabLabels) {
      await clickTab(page, label);

      // Each tab should render some content (not be completely empty)
      const tabContent = await page.evaluate(() => document.body.innerText.trim().length);
      expect(tabContent, `Tab "${label}" rendered empty`).toBeGreaterThan(10);
    }

    // No accumulated JS crashes
    const crashes = errors.pageErrors.filter((e) =>
      e.includes("Cannot read properties"),
    );
    expect(crashes.length, `JS crashes: ${crashes.join("; ")}`).toBe(0);
  });

  test("create page (/studies/create) loads with form fields", async ({
    page,
  }) => {
    await assertPageLoads(page, "/studies/create");

    // Should have form inputs for creating a study
    const inputs = await page.locator("input, textarea, select").count();
    expect(inputs, "Create page should have form fields").toBeGreaterThan(0);
  });
});
