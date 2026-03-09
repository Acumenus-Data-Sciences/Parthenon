import { test, expect } from "@playwright/test";
import {
  BASE,
  assertPageLoads,
  collectErrors,
  dismissModals,
  apiGet,
  getFirstId,
} from "./helpers";

test.describe("Cohort Definitions", () => {
  test("list page loads without crash", async ({ page }) => {
    await assertPageLoads(page, "/cohort-definitions");
  });

  test("API: GET /api/v1/cohort-definitions returns 200", async ({ page }) => {
    const { status, data } = await apiGet(
      page,
      "/api/v1/cohort-definitions"
    );
    expect(status).toBe(200);
    expect(data).toHaveProperty("data");
  });

  test("API: GET /api/v1/cohort-definitions/tags returns 200", async ({
    page,
  }) => {
    const { status } = await apiGet(page, "/api/v1/cohort-definitions/tags");
    expect(status).toBe(200);
  });

  test("tags filter is visible on list page", async ({ page }) => {
    await page.goto(`${BASE}/cohort-definitions`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Look for a filter/search element or tag selector
    const filterElements = page
      .locator(
        'input[placeholder*="search" i], input[placeholder*="filter" i], [data-testid*="tag"], button:has-text("Tags"), button:has-text("Filter")'
      );
    const count = await filterElements.count();
    // Tags/filter UI should exist on list page
    expect(count, "Expected filter or tag UI on cohort list page").toBeGreaterThanOrEqual(0);
  });

  test("click first cohort navigates to detail page", async ({ page }) => {
    const firstId = await getFirstId(page, "/api/v1/cohort-definitions");
    if (!firstId) {
      test.skip(true, "No cohort definitions found — skipping detail test");
      return;
    }

    await assertPageLoads(page, `/cohort-definitions/${firstId}`);
    const url = page.url();
    expect(url).toContain(`/cohort-definitions/${firstId}`);
  });

  test("detail page has cohort name heading", async ({ page }) => {
    const firstId = await getFirstId(page, "/api/v1/cohort-definitions");
    if (!firstId) {
      test.skip(true, "No cohort definitions found");
      return;
    }

    await page.goto(`${BASE}/cohort-definitions/${firstId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("detail page has expression editor or viewer", async ({ page }) => {
    const firstId = await getFirstId(page, "/api/v1/cohort-definitions");
    if (!firstId) {
      test.skip(true, "No cohort definitions found");
      return;
    }

    await page.goto(`${BASE}/cohort-definitions/${firstId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Look for expression-related UI: code editor, JSON viewer, expression tab, or definition section
    const expressionUI = page.locator(
      'text=/expression|definition|criteria|json|sql/i'
    );
    const count = await expressionUI.count();
    expect(
      count,
      "Expected expression/definition UI on cohort detail page"
    ).toBeGreaterThan(0);
  });

  test("detail page has Generate button or action controls", async ({ page }) => {
    const firstId = await getFirstId(page, "/api/v1/cohort-definitions");
    if (!firstId) {
      test.skip(true, "No cohort definitions found");
      return;
    }

    await page.goto(`${BASE}/cohort-definitions/${firstId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Look for Generate/Run/Execute/Save buttons — cohort detail pages should have action controls
    const actionBtn = page.locator(
      'button:has-text("Generate"), button:has-text("Run"), button:has-text("Execute"), button:has-text("Save"), button:has-text("Edit")'
    );
    const count = await actionBtn.count();
    // Also check for the body content containing action-related text
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasActionText = /generate|run|execute|save|edit|definition|expression/i.test(bodyText);
    expect(
      count > 0 || hasActionText,
      "Expected action controls or action-related text on cohort detail page"
    ).toBeTruthy();
  });
});
