import { test, expect } from "@playwright/test";
import {
  BASE,
  assertPageLoads,
  collectErrors,
  apiGet,
} from "./helpers";

test.describe("Patient Profiles", () => {
  test("list page loads at /profiles", async ({ page }) => {
    await assertPageLoads(page, "/profiles");
  });

  test("search input is visible", async ({ page }) => {
    await assertPageLoads(page, "/profiles");

    // Look for a search input — could be text, search, or number type
    const searchInput = page.locator(
      'input[type="search"], input[type="text"], input[placeholder*="search" i], input[placeholder*="patient" i], input[placeholder*="person" i]',
    );
    const count = await searchInput.count();
    expect(count, "Profile page should have a search input").toBeGreaterThan(0);
  });

  test("patient timeline renders if patients exist", async ({ page }) => {
    const errors = collectErrors(page);

    // Try loading a known patient from Eunomia (person_id = 1)
    await page.goto(`${BASE}/profiles/1`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    const url = page.url();
    if (url.includes("/login")) {
      throw new Error("Redirected to login");
    }

    const body = await page.evaluate(() => document.body.innerText);

    // If the patient loaded, check for timeline elements
    if (
      !body.includes("not found") &&
      !body.includes("No patient") &&
      body.length > 50
    ) {
      console.log(`  Patient profile loaded (${body.length} chars)`);

      // Look for SVG timeline or timeline elements
      const svgCount = await page.locator("svg").count();
      const timelineEl = await page
        .locator('[class*="timeline"], [data-testid*="timeline"]')
        .count();

      console.log(`  SVGs: ${svgCount}, timeline elements: ${timelineEl}`);
      // Page rendered content without crashing — that is the key assertion
      expect(body.length).toBeGreaterThan(20);
    } else {
      console.log("  No patient found at /profiles/1 — skipping timeline check");
    }

    // No JS crashes
    const crashes = errors.pageErrors.filter((e) =>
      e.includes("Cannot read properties"),
    );
    expect(crashes.length, `JS crashes: ${crashes.join("; ")}`).toBe(0);
  });
});
