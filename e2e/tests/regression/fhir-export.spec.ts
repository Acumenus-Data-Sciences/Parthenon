/**
 * Regression guard: FHIR-01, FHIR-02 — FHIR Export page loads without errors
 *
 * Catches: Frontend calling nonexistent backend endpoints, causing crashes.
 */
import { test, expect } from "@playwright/test";
import { assertPageLoads, BASE } from "../helpers";

test.describe("FHIR Export Regression", () => {
  test("page loads without errors or crash", async ({ page }) => {
    await assertPageLoads(page, "/admin/fhir-export");
  });

  test("shows coming-soon or working export UI", async ({ page }) => {
    await page.goto(`${BASE}/admin/fhir-export`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const bodyText = await page.evaluate(() => document.body.innerText);

    // Must show EITHER "coming soon" message OR a working export button
    const hasComingSoon = /coming soon|not yet available|under development/i.test(bodyText);
    const hasExportButton = await page.locator("button:has-text('Start Export'), button:has-text('Export')").count() > 0;

    expect(
      hasComingSoon || hasExportButton,
      "FHIR Export page shows neither coming-soon message nor working export UI"
    ).toBe(true);
  });

  test("no [object Object] text on page", async ({ page }) => {
    await page.goto(`${BASE}/admin/fhir-export`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const objectText = await page.locator("text=[object Object]").count();
    expect(objectText, "Found [object Object] on FHIR Export page").toBe(0);
  });
});
