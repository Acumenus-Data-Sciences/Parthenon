/**
 * Regression guard: A11Y-01 — Dashboard table rows are keyboard accessible
 *
 * Catches: Clickable table rows missing role="button" and keyboard handlers.
 */
import { test, expect } from "@playwright/test";
import { assertPageLoads, BASE } from "../helpers";

test.describe("Dashboard Accessibility Regression", () => {
  test("page loads without errors", async ({ page }) => {
    await assertPageLoads(page, "/");
  });

  test("clickable table rows have role=button", async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Find all clickable table rows (those with cursor: pointer or onClick)
    const clickableRows = page.locator("tr.clickable, tr[style*='cursor: pointer'], tr[style*='cursor:pointer']");
    const count = await clickableRows.count();

    if (count > 0) {
      // Every clickable row must have role="button"
      for (let i = 0; i < count; i++) {
        const role = await clickableRows.nth(i).getAttribute("role");
        expect(
          role,
          `Clickable table row ${i} missing role="button"`
        ).toBe("button");
      }

      // Every clickable row must have tabIndex
      for (let i = 0; i < count; i++) {
        const tabIndex = await clickableRows.nth(i).getAttribute("tabindex");
        expect(
          tabIndex,
          `Clickable table row ${i} missing tabIndex`
        ).toBe("0");
      }
    }
  });

  test("no [object Object] on dashboard", async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const objectText = await page.locator("text=[object Object]").count();
    expect(objectText, "Dashboard has [object Object]").toBe(0);
  });

  test("CDM metric cards are present", async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const bodyText = await page.evaluate(() => document.body.innerText);
    // Dashboard should show CDM characterization section
    const hasCdm = /Persons|CDM|Characterization|Data Completeness/i.test(bodyText);
    expect(hasCdm, "Dashboard missing CDM characterization section").toBe(true);
  });
});
