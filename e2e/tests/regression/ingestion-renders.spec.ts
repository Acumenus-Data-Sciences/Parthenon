/**
 * Regression guard: INGEST-01..04 — Ingestion pages render real data
 *
 * Catches: API response envelope not unwrapped, causing [object Object] rendering.
 */
import { test, expect } from "@playwright/test";
import { assertPageLoads, BASE } from "../helpers";

test.describe("Ingestion API Regression", () => {
  test("dashboard loads without [object Object]", async ({ page }) => {
    await page.goto(`${BASE}/ingestion`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const objectText = await page.locator("text=[object Object]").count();
    expect(objectText, "Ingestion Dashboard has [object Object] — API envelope not unwrapped").toBe(0);
  });

  test("upload page loads without errors", async ({ page }) => {
    await assertPageLoads(page, "/ingestion/upload");
  });

  test("dashboard renders job list or empty state", async ({ page }) => {
    await page.goto(`${BASE}/ingestion`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const bodyText = await page.evaluate(() => document.body.innerText);
    // Should have either job cards OR an empty state message — not raw objects
    const hasContent = bodyText.length > 50;
    const hasErrorBoundary = /Something went wrong|Unexpected error/i.test(bodyText);

    expect(hasContent, "Ingestion page is blank").toBe(true);
    expect(hasErrorBoundary, "Ingestion page hit error boundary").toBe(false);
  });
});
