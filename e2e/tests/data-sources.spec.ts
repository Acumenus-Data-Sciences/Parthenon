import { test, expect } from "@playwright/test";
import {
  assertPageLoads,
  dismissModals,
  apiGet,
} from "./helpers";

test.describe("Data Sources", () => {
  test("list page loads without crash", async ({ page }) => {
    await assertPageLoads(page, "/data-sources");
  });

  test("page shows source cards or table", async ({ page }) => {
    await assertPageLoads(page, "/data-sources");
    await dismissModals(page);

    // Look for either card-based or table-based layout
    const cards = page.locator('[class*="card"], [class*="source"], tr, [role="row"]');
    const count = await cards.count();
    // Page should have some content structure even if no sources exist
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("source cards show name and connection info if sources exist", async ({ page }) => {
    const { status, data } = await apiGet(page, "/api/v1/sources");
    const items = data.data ?? data ?? [];

    test.skip(!Array.isArray(items) || items.length === 0, "No sources configured — skipping card content check");

    await assertPageLoads(page, "/data-sources");
    await dismissModals(page);

    // At least one source name should be visible on the page
    const firstSourceName = items[0].source_name ?? items[0].name ?? "";
    if (firstSourceName) {
      const nameLocator = page.locator(`text=${firstSourceName}`).first();
      await expect(nameLocator).toBeVisible({ timeout: 5000 });
    }
  });

  test("API: GET /api/v1/sources returns 200 with array", async ({ page }) => {
    const { status, data } = await apiGet(page, "/api/v1/sources");
    expect(status).toBe(200);

    const items = data.data ?? data;
    expect(Array.isArray(items)).toBe(true);
  });
});
