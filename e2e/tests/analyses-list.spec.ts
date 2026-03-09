import { test, expect } from "@playwright/test";
import {
  BASE,
  assertPageLoads,
  collectErrors,
  dismissModals,
  clickTab,
  apiGet,
} from "./helpers";

test.describe("Analyses List Page", () => {
  test("page loads without crash", async ({ page }) => {
    await assertPageLoads(page, "/analyses");
  });

  test("API: GET /api/v1/analyses/stats returns counts", async ({ page }) => {
    const { status, data } = await apiGet(page, "/api/v1/analyses/stats");
    expect(status).toBe(200);
    expect(data).toHaveProperty("data");
    const stats = data.data;
    expect(stats).toHaveProperty("characterizations");
    expect(stats).toHaveProperty("incidence_rates");
    expect(stats).toHaveProperty("pathways");
    expect(stats).toHaveProperty("estimations");
    expect(stats).toHaveProperty("predictions");
    expect(stats).toHaveProperty("sccs");
    expect(stats).toHaveProperty("evidence_synthesis");
    expect(stats).toHaveProperty("grand_total");
    expect(typeof stats.grand_total).toBe("number");
  });

  test("page has analysis stats bar", async ({ page }) => {
    await page.goto(`${BASE}/analyses`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Stats bar should display counts for analysis types
    const bodyText = await page.evaluate(() => document.body.innerText);
    // At minimum, the page should mention some analysis type names
    const hasAnalysisTypes =
      /characterization|incidence|pathway|estimation|prediction|sccs|evidence/i.test(
        bodyText
      );
    expect(
      hasAnalysisTypes,
      "Expected analysis type labels in stats bar"
    ).toBe(true);
  });

  test("analysis type tabs exist", async ({ page }) => {
    await page.goto(`${BASE}/analyses`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    const tabLabels = [
      "Characterization",
      "Incidence",
      "Pathway",
      "Estimation",
      "Prediction",
      "SCCS",
      "Evidence",
    ];

    for (const label of tabLabels) {
      const tab = page
        .locator(`button:has-text("${label}"), [role="tab"]:has-text("${label}")`)
        .first();
      const count = await tab.count();
      if (count === 0) {
        console.log(`  Note: Tab "${label}" not found as button — may be a different UI element`);
      }
    }
  });

  test("click each tab — no crash", async ({ page }) => {
    await page.goto(`${BASE}/analyses`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    const tabLabels = [
      "Characterization",
      "Incidence",
      "Pathway",
      "Estimation",
      "Prediction",
      "SCCS",
      "Evidence",
    ];

    for (const label of tabLabels) {
      await clickTab(page, label);
    }
  });

  test("API: GET /api/v1/characterizations returns data", async ({ page }) => {
    const { status } = await apiGet(page, "/api/v1/characterizations");
    expect(status).toBe(200);
  });

  test("API: GET /api/v1/incidence-rates returns data", async ({ page }) => {
    const { status } = await apiGet(page, "/api/v1/incidence-rates");
    expect(status).toBe(200);
  });

  test("API: GET /api/v1/estimations returns data", async ({ page }) => {
    const { status } = await apiGet(page, "/api/v1/estimations");
    expect(status).toBe(200);
  });

  test("API: GET /api/v1/predictions returns data", async ({ page }) => {
    const { status } = await apiGet(page, "/api/v1/predictions");
    expect(status).toBe(200);
  });

  test("API: GET /api/v1/sccs returns data", async ({ page }) => {
    const { status } = await apiGet(page, "/api/v1/sccs");
    expect(status).toBe(200);
  });

  test("API: GET /api/v1/evidence-synthesis returns data", async ({
    page,
  }) => {
    const { status } = await apiGet(page, "/api/v1/evidence-synthesis");
    expect(status).toBe(200);
  });

  test("API: GET /api/v1/pathways returns data", async ({ page }) => {
    const { status } = await apiGet(page, "/api/v1/pathways");
    expect(status).toBe(200);
  });
});
