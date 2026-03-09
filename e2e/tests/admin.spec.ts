import { test, expect } from "@playwright/test";
import { assertPageLoads, collectErrors } from "./helpers";

const ADMIN_PAGES = [
  { path: "/admin", label: "Admin Dashboard" },
  { path: "/admin/users", label: "Admin Users" },
  { path: "/admin/roles", label: "Admin Roles" },
  { path: "/admin/auth-providers", label: "Admin Auth Providers" },
  { path: "/admin/ai-providers", label: "Admin AI Providers" },
  { path: "/admin/system-health", label: "Admin System Health" },
  { path: "/admin/vocabulary", label: "Admin Vocabulary" },
  { path: "/admin/fhir-connections", label: "Admin FHIR Connections" },
  { path: "/admin/fhir-sync-monitor", label: "Admin FHIR Sync Monitor" },
  { path: "/admin/webapi-registry", label: "Admin WebAPI Registry" },
  { path: "/admin/notifications", label: "Admin Notifications" },
  { path: "/admin/solr", label: "Admin Solr" },
];

test.describe("Administration Pages", () => {
  for (const { path, label } of ADMIN_PAGES) {
    test(`${label} (${path}) loads without crash`, async ({ page }) => {
      await assertPageLoads(page, path);
    });
  }

  test("/admin dashboard shows system stats", async ({ page }) => {
    await assertPageLoads(page, "/admin");

    const body = await page.evaluate(() => document.body.innerText);
    // Admin dashboard typically shows counts or status indicators
    expect(body.length).toBeGreaterThan(50);
  });

  test("/admin/users shows user list", async ({ page }) => {
    await assertPageLoads(page, "/admin/users");

    const body = await page.evaluate(() => document.body.innerText);
    // Should contain the admin user at minimum
    expect(body.toLowerCase()).toMatch(/user|email|role|admin/i);
  });

  test("/admin/roles shows role list", async ({ page }) => {
    await assertPageLoads(page, "/admin/roles");

    const body = await page.evaluate(() => document.body.innerText);
    // Should contain at least super-admin role
    expect(body.toLowerCase()).toMatch(/role|permission|super|admin/i);
  });

  test("/admin/ai-providers shows provider cards", async ({ page }) => {
    await assertPageLoads(page, "/admin/ai-providers");

    const body = await page.evaluate(() => document.body.innerText);
    // Should mention at least one AI provider (ollama is default)
    expect(body.toLowerCase()).toMatch(/provider|ollama|openai|model/i);
  });

  test("/admin/system-health shows service status", async ({ page }) => {
    await assertPageLoads(page, "/admin/system-health");

    const body = await page.evaluate(() => document.body.innerText);
    // Should show service names and statuses
    expect(body.toLowerCase()).toMatch(/service|status|health|database|redis/i);
  });
});
