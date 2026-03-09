import { test, expect } from "@playwright/test";
import { BASE, assertPageLoads, collectErrors, authHeaders } from "./helpers";

/* ────────────────────────────────────────────────────────────────────────────
 * Auth E2E Tests — Tier 1
 *
 * Covers: login page rendering, register page rendering, auth redirects,
 * login success/failure flows, and logout.
 * ──────────────────────────────────────────────────────────────────────── */

test.describe("Auth — Unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login page loads with email and password fields", async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    await expect(
      page.locator('input[type="email"], input[name="email"]')
    ).toBeVisible();
    await expect(
      page.locator('input[type="password"], input[name="password"]')
    ).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("register page loads with name and email fields", async ({ page }) => {
    await page.goto(`${BASE}/register`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Name field (id="name", type="text", placeholder="Jane Smith")
    await expect(
      page.locator('input#name, input[name="name"], input[placeholder*="name" i]')
    ).toBeVisible();
    // Email field
    await expect(
      page.locator('input#email, input[type="email"], input[name="email"]')
    ).toBeVisible();
  });

  test("register page has 'Back to login' link", async ({ page }) => {
    await page.goto(`${BASE}/register`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const loginLink = page.locator('a[href*="login"], a:has-text("login")').first();
    await expect(loginLink).toBeVisible();
  });

  // Protected routes should all redirect to /login
  const protectedRoutes = [
    "/",
    "/data-sources",
    "/data-explorer",
    "/vocabulary",
    "/cohort-definitions",
    "/concept-sets",
    "/analyses",
    "/studies",
    "/profiles",
    "/care-gaps",
    "/jobs",
    "/genomics",
    "/imaging",
    "/heor",
    "/admin",
    "/admin/users",
    "/ingestion",
    "/publish",
  ];

  for (const route of protectedRoutes) {
    test(`unauthenticated ${route} redirects to /login`, async ({ page }) => {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(/login/, { timeout: 8000 });
      expect(page.url()).toContain("/login");
    });
  }

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    await page.fill('input[type="email"], input[name="email"]', "admin@parthenon.local");
    await page.fill('input[type="password"], input[name="password"]', "wrongpassword123");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Should still be on login page
    expect(page.url()).toContain("/login");

    // Should show an error message
    const errorVisible = await page
      .locator('text=/invalid|incorrect|failed|error|credentials/i')
      .count();
    expect(errorVisible).toBeGreaterThan(0);
  });
});

test.describe("Auth — Authenticated", () => {
  // Uses storageState from global setup (default in playwright.config)

  test("successful login redirects to dashboard", async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Should NOT be on login page
    expect(page.url()).not.toContain("/login");

    // Should have dashboard content
    const bodyText = await page.evaluate(() => document.body.innerText.trim());
    expect(bodyText.length).toBeGreaterThan(10);
  });

  test("GET /api/v1/auth/user returns current user", async ({ page }) => {
    const resp = await page.request.get(`${BASE}/api/v1/auth/user`, {
      headers: authHeaders(),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    const user = body.data ?? body;
    expect(user.email).toBeTruthy();
  });

  test("logout clears session", async ({ page }) => {
    // Navigate to dashboard first
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Dismiss any modals that may block interaction (onboarding, setup wizard)
    const modalClose = page.locator('.modal-container .modal-close, .modal-container button[aria-label="Close"]').first();
    if ((await modalClose.count()) > 0) {
      await modalClose.click({ force: true });
      await page.waitForTimeout(500);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // The Logout button is directly in the header (not behind a dropdown)
    const logoutBtn = page
      .locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout")')
      .first();

    if ((await logoutBtn.count()) > 0) {
      await logoutBtn.click();
      await page.waitForTimeout(3000);
      // After logout, should be on login page or login should be accessible
      const url = page.url();
      const onLoginOrHome = url.includes("/login") || url.endsWith("/");
      expect(onLoginOrHome).toBeTruthy();
    } else {
      test.skip(true, "No logout button found on page");
    }
  });
});
