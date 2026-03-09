import { test, expect } from "@playwright/test";
import {
  BASE,
  assertPageLoads,
  collectErrors,
  dismissModals,
  apiGet,
  getFirstId,
} from "./helpers";

test.describe("Concept Sets", () => {
  test("list page loads without crash", async ({ page }) => {
    await assertPageLoads(page, "/concept-sets");
  });

  test("API: GET /api/v1/concept-sets returns 200", async ({ page }) => {
    const { status, data } = await apiGet(page, "/api/v1/concept-sets");
    expect(status).toBe(200);
    expect(data).toHaveProperty("data");
  });

  test("search/filter input is visible on list page", async ({ page }) => {
    await page.goto(`${BASE}/concept-sets`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    const searchInput = page.locator(
      'input[placeholder*="search" i], input[placeholder*="filter" i], input[type="search"]'
    );
    const count = await searchInput.count();
    expect(
      count,
      "Expected search/filter input on concept sets list page"
    ).toBeGreaterThan(0);
  });

  test("click first concept set navigates to detail page", async ({
    page,
  }) => {
    const firstId = await getFirstId(page, "/api/v1/concept-sets");
    if (!firstId) {
      test.skip(true, "No concept sets found — skipping detail test");
      return;
    }

    await assertPageLoads(page, `/concept-sets/${firstId}`);
    const url = page.url();
    expect(url).toContain(`/concept-sets/${firstId}`);
  });

  test("detail page shows concept list or items", async ({ page }) => {
    const firstId = await getFirstId(page, "/api/v1/concept-sets");
    if (!firstId) {
      test.skip(true, "No concept sets found");
      return;
    }

    await page.goto(`${BASE}/concept-sets/${firstId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Look for concept items: table rows, concept IDs, or "concept" text
    const conceptUI = page.locator(
      'table, [role="grid"], text=/concept|item|included|excluded/i'
    );
    const count = await conceptUI.count();
    expect(
      count,
      "Expected concept list/table on concept set detail page"
    ).toBeGreaterThan(0);
  });

  test("detail page has heading", async ({ page }) => {
    const firstId = await getFirstId(page, "/api/v1/concept-sets");
    if (!firstId) {
      test.skip(true, "No concept sets found");
      return;
    }

    await page.goto(`${BASE}/concept-sets/${firstId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });
});
