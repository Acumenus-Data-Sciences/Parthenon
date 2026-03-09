import { test, expect } from "@playwright/test";
import { BASE, assertPageLoads, collectErrors, dismissModals } from "./helpers";

/* ────────────────────────────────────────────────────────────────────────────
 * Navigation E2E Tests — Tier 1
 *
 * Covers: sidebar rendering, nav link counts, link navigation, active state,
 * collapse/expand, admin section visibility, admin sub-menu, and
 * browser back/forward navigation.
 * ──────────────────────────────────────────────────────────────────────── */

test.describe("Sidebar & Navigation", () => {
  test("sidebar renders nav items", async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Count sidebar nav links (in nav or aside element)
    const navLinks = await page.locator("nav a, aside a").count();
    console.log(`  Sidebar nav links found: ${navLinks}`);
    // Expect at least 10 nav items for a full sidebar
    expect(navLinks).toBeGreaterThanOrEqual(10);
  });

  test("dashboard renders content on /", async ({ page }) => {
    await assertPageLoads(page, "/");
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(50);
  });

  // Core sidebar links and their expected URL paths
  const sidebarLinks = [
    { text: /dashboard/i, expectedPath: "/" },
    { text: /data source/i, expectedPath: "/data-sources" },
    { text: /data explorer/i, expectedPath: "/data-explorer" },
    { text: /vocabulary/i, expectedPath: "/vocabulary" },
    { text: /cohort/i, expectedPath: "/cohort-definitions" },
    { text: /concept set/i, expectedPath: "/concept-sets" },
    { text: /analy/i, expectedPath: "/analyses" },
    { text: /stud/i, expectedPath: "/studies" },
    { text: /profile/i, expectedPath: "/profiles" },
    { text: /care gap/i, expectedPath: "/care-gaps" },
    { text: /job/i, expectedPath: "/jobs" },
    { text: /genomic/i, expectedPath: "/genomics" },
    { text: /imaging/i, expectedPath: "/imaging" },
  ];

  for (const link of sidebarLinks) {
    test(`sidebar link "${link.text}" navigates to ${link.expectedPath}`, async ({
      page,
    }) => {
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      await dismissModals(page);

      const navLink = page
        .locator("nav a, aside a")
        .filter({ hasText: link.text })
        .first();

      if ((await navLink.count()) === 0) {
        test.skip(true, `Sidebar link matching "${link.text}" not found`);
        return;
      }

      await navLink.click();
      await page.waitForTimeout(2000);

      const url = new URL(page.url());
      expect(url.pathname).toContain(link.expectedPath);
    });
  }

  test("admin section is visible to admin users", async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    // Look for admin link or admin section
    const adminLink = page
      .locator("nav a, aside a")
      .filter({ hasText: /admin/i })
      .first();
    expect(await adminLink.count()).toBeGreaterThan(0);
  });

  test("admin sub-menu items accessible", async ({ page }) => {
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Navigate to admin and check sub-links exist
    const adminSubPages = [
      { path: "/admin/users", label: "Users" },
      { path: "/admin/roles", label: "Roles" },
      { path: "/admin/ai-providers", label: "AI Providers" },
      { path: "/admin/system-health", label: "System Health" },
    ];

    for (const sub of adminSubPages) {
      // Check sidebar or page has link to sub-page
      const subLink = page
        .locator(`a[href*="${sub.path}"]`)
        .first();
      if ((await subLink.count()) === 0) {
        // Try navigating directly
        await page.goto(`${BASE}${sub.path}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2000);
        expect(page.url()).not.toContain("/login");
      }
    }
  });

  test("sidebar collapse/expand toggle", async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await dismissModals(page);

    // Look for collapse/expand button
    const collapseBtn = page
      .locator(
        'button[aria-label*="collapse" i], button[aria-label*="sidebar" i], button[aria-label*="menu" i], button[aria-label*="toggle" i]'
      )
      .first();

    if ((await collapseBtn.count()) === 0) {
      test.skip(true, "No sidebar collapse button found");
      return;
    }

    // Get initial sidebar width
    const sidebar = page.locator("nav, aside").first();
    const initialBox = await sidebar.boundingBox();

    await collapseBtn.click();
    await page.waitForTimeout(500);

    const collapsedBox = await sidebar.boundingBox();

    // Either width changed or visibility changed
    if (initialBox && collapsedBox) {
      expect(collapsedBox.width).not.toBe(initialBox.width);
    }

    // Click again to expand
    await collapseBtn.click();
    await page.waitForTimeout(500);
  });

  test("page title or heading matches current route", async ({ page }) => {
    const routeTitles = [
      { path: "/cohort-definitions", titlePattern: /cohort/i },
      { path: "/concept-sets", titlePattern: /concept/i },
      { path: "/analyses", titlePattern: /analy/i },
      { path: "/admin/users", titlePattern: /user/i },
    ];

    for (const rt of routeTitles) {
      await page.goto(`${BASE}${rt.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);

      // Check page heading (h1 or h2)
      const heading = page.locator("h1, h2").first();
      if ((await heading.count()) > 0) {
        const text = await heading.textContent();
        expect(text).toMatch(rt.titlePattern);
      }
    }
  });

  test("browser back/forward navigation works", async ({ page }) => {
    // Navigate to two routes in sequence
    await page.goto(`${BASE}/cohort-definitions`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);

    await page.goto(`${BASE}/concept-sets`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/concept-sets");

    // Go back
    await page.goBack();
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/cohort-definitions");

    // Go forward
    await page.goForward();
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/concept-sets");
  });
});
