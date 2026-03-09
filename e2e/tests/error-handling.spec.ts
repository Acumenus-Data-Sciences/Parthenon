import { test, expect } from "@playwright/test";
import { BASE, collectErrors, authHeaders } from "./helpers";

test.describe("Error Handling & Edge Cases", () => {
  test("404: /nonexistent-page shows 404 or redirects (not crash)", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    await page.goto(`${BASE}/nonexistent-page-xyz`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);

    // Should not show React error boundary crash
    const errorBoundary = await page
      .locator("text=/Something went wrong|Unexpected error|chunk load failed/i")
      .count();
    expect(errorBoundary).toBe(0);

    // No JS crashes
    const crashes = errors.pageErrors.filter((e) =>
      e.includes("Cannot read properties"),
    );
    expect(crashes.length, `JS crashes: ${crashes.join("; ")}`).toBe(0);
  });

  test("expired session: clearing cookies redirects to /login", async ({
    page,
  }) => {
    // First navigate to a page to confirm we're logged in
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Clear all cookies to simulate session expiry
    await page.context().clearCookies();

    // Navigate to a protected route
    await page.goto(`${BASE}/studies`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Should redirect to login
    expect(page.url()).toContain("/login");
  });

  test("API 404: GET /api/v1/nonexistent returns 404 not 500", async ({
    page,
  }) => {
    const resp = await page.request.get(`${BASE}/api/v1/nonexistent`, {
      headers: authHeaders(),
    });
    expect(resp.status()).not.toBe(500);
    // Should be 404 or similar client error
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    expect(resp.status()).toBeLessThan(500);
  });

  test("double navigation: clicking same nav link twice does not crash", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    await page.goto(`${BASE}/studies`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Click a nav link to studies again
    const studiesLink = page
      .locator('a[href="/studies"], a[href*="/studies"]')
      .first();
    if ((await studiesLink.count()) > 0) {
      await studiesLink.click();
      await page.waitForTimeout(1500);
      await studiesLink.click();
      await page.waitForTimeout(1500);
    }

    // No crash
    const errorBoundary = await page
      .locator("text=/Something went wrong|Unexpected error/i")
      .count();
    expect(errorBoundary).toBe(0);

    const crashes = errors.pageErrors.filter((e) =>
      e.includes("Cannot read properties"),
    );
    expect(crashes.length).toBe(0);
  });

  test("browser back/forward: navigate studies -> analyses -> back", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    // Navigate to studies
    await page.goto(`${BASE}/studies`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Navigate to analyses
    await page.goto(`${BASE}/analyses`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Go back
    await page.goBack();
    await page.waitForTimeout(2000);

    // Should be on studies page
    expect(page.url()).toContain("/studies");

    // No crash
    const errorBoundary = await page
      .locator("text=/Something went wrong|Unexpected error/i")
      .count();
    expect(errorBoundary).toBe(0);

    const crashes = errors.pageErrors.filter((e) =>
      e.includes("Cannot read properties"),
    );
    expect(crashes.length).toBe(0);

    // Go forward
    await page.goForward();
    await page.waitForTimeout(2000);

    expect(page.url()).toContain("/analyses");

    const errorBoundary2 = await page
      .locator("text=/Something went wrong|Unexpected error/i")
      .count();
    expect(errorBoundary2).toBe(0);
  });
});
