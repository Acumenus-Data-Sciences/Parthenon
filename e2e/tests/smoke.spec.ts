import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { TOKEN_FILE } from "../global-setup";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8082";

function getToken(): string {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")).token ?? "";
  } catch {
    return "";
  }
}

// Endpoints that may return 5xx due to missing OMOP/CDM data on test VMs.
// These are data-environment failures, not code bugs.
const DATA_ENV_PATTERNS = [
  "/achilles/",
  "/data-quality/",
  "/cdm/",
  "/vocabulary/search",
  "/genomics/variants",
  "/imaging/studies",
  "/imaging/wado",
  "/heor/",
  "/system-health/",
  "/gis/",
];

function isDataEnvFailure(url: string): boolean {
  return DATA_ENV_PATTERNS.some((p) => url.includes(p));
}

// All app routes to probe
const ROUTES = [
  // Core
  { path: "/", label: "Dashboard" },
  { path: "/data-sources", label: "Data Sources" },
  { path: "/data-explorer", label: "Data Explorer" },
  // Vocabulary
  { path: "/vocabulary", label: "Vocabulary" },
  { path: "/vocabulary/compare", label: "Vocabulary Compare" },
  // Cohorts & Concepts
  { path: "/cohort-definitions", label: "Cohort Definitions" },
  { path: "/concept-sets", label: "Concept Sets" },
  // Analyses
  { path: "/analyses", label: "Analyses" },
  // Studies
  { path: "/studies", label: "Studies" },
  // Profiles
  { path: "/profiles", label: "Patient Profiles" },
  // Care Gaps
  { path: "/care-gaps", label: "Care Gaps" },
  // Jobs & Ingestion
  { path: "/jobs", label: "Jobs" },
  { path: "/ingestion", label: "Ingestion Dashboard" },
  { path: "/ingestion/upload", label: "Ingestion Upload" },
  // Genomics
  { path: "/genomics", label: "Genomics" },
  { path: "/genomics/analysis", label: "Genomics Analysis" },
  { path: "/genomics/tumor-board", label: "Genomics Tumor Board" },
  // Imaging
  { path: "/imaging", label: "Imaging" },
  // HEOR
  { path: "/heor", label: "HEOR" },
  // Admin
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
  { path: "/admin/fhir-export", label: "Admin FHIR Export" },
  { path: "/admin/solr", label: "Admin Solr" },
  { path: "/admin/user-audit", label: "Admin User Audit" },
  // Query Assistant
  { path: "/query-assistant", label: "Query Assistant" },
  // Phenotype Library
  { path: "/phenotype-library", label: "Phenotype Library" },
  // GIS
  { path: "/gis", label: "GIS Explorer" },
  // Commons
  { path: "/commons", label: "Commons Workspace" },
  // Schema Mapping
  { path: "/schema-mapping", label: "Schema Mapping" },
];

// Collect console errors and 5xx responses per page
function collectErrors(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) =>
    consoleErrors.push(`[pageerror] ${err.message}`)
  );
  page.on("response", (resp) => {
    if (resp.status() >= 500 && !isDataEnvFailure(resp.url())) {
      failedRequests.push(`${resp.status()} ${resp.url()}`);
    }
  });
  return { consoleErrors, failedRequests };
}

test.describe("Authentication (no session)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login page loads", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page).toHaveTitle(/Parthenon/i);
    await expect(
      page.locator('input[type="email"], input[name="email"]')
    ).toBeVisible();
  });

  test("unauthenticated / redirects to /login", async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.waitForURL(/login/, { timeout: 8000 });
    expect(page.url()).toContain("/login");
  });
});

test.describe("Route Smoke Tests (authenticated)", () => {
  // storageState from global setup is inherited via playwright.config

  for (const route of ROUTES) {
    test(`${route.label} (${route.path})`, async ({ page }) => {
      const { consoleErrors, failedRequests } = collectErrors(page);

      await page.goto(`${BASE}${route.path}`, {
        waitUntil: "domcontentloaded",
      });

      // Wait for async data fetches and lazy chunks
      await page.waitForTimeout(3000);

      // Must not have redirected back to login (session expired / route guard)
      const currentUrl = page.url();
      expect(currentUrl, `${route.label}: redirected to login`).not.toContain(
        "/login"
      );

      // Must have rendered meaningful content
      const bodyText = await page.evaluate(
        () => document.body.innerText.trim()
      );
      expect(
        bodyText.length,
        `${route.label}: empty page (${bodyText.length} chars)`
      ).toBeGreaterThan(10);

      // No React error boundary
      const errorBoundary = await page
        .locator(
          "text=/Something went wrong|Unexpected error|chunk load failed/i"
        )
        .count();
      expect(errorBoundary, `${route.label}: error boundary triggered`).toBe(
        0
      );

      // No [object Object] text (detects API response unwrapping bugs)
      const objectObjectCount = await page
        .locator("text=[object Object]")
        .count();
      expect(
        objectObjectCount,
        `${route.label}: found [object Object] — likely API response not unwrapped`
      ).toBe(0);

      // Log any API failures or console errors for debugging (don't fail on them alone)
      if (failedRequests.length) {
        console.log(`  ⚠ 5xx requests on ${route.label}:`);
        failedRequests.slice(0, 5).forEach((r) => console.log(`    - ${r}`));
      }
      const realErrors = consoleErrors.filter(
        (e) =>
          !e.includes("favicon") &&
          !e.includes("404") &&
          !e.includes("net::ERR")
      );
      if (realErrors.length) {
        console.log(`  ⚠ Console errors on ${route.label}:`);
        realErrors.slice(0, 5).forEach((e) => console.log(`    - ${e}`));
      }

      // Hard fail if there are 5xx API errors
      expect(
        failedRequests.length,
        `${route.label}: API returned 5xx — ${failedRequests.join(", ")}`
      ).toBe(0);
    });
  }
});

test.describe("API Health Checks (no session)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("CSRF cookie endpoint → 204", async ({ page }) => {
    const resp = await page.request.get(`${BASE}/sanctum/csrf-cookie`);
    console.log(`  /sanctum/csrf-cookie → ${resp.status()}`);
    expect(resp.status()).toBe(204);
  });

  test("Unknown API route returns 404 not 500", async ({ page }) => {
    const resp = await page.request.get(`${BASE}/api/v1/nonexistent-endpoint`);
    console.log(`  /api/v1/nonexistent → ${resp.status()}`);
    expect(resp.status()).not.toBe(500);
  });
});

test.describe("API Health Checks (authenticated Bearer token)", () => {
  // page.request doesn't carry Sanctum SPA session cookies automatically,
  // so we use the Bearer token saved in global setup instead.

  function authHeaders() {
    return { Authorization: `Bearer ${getToken()}`, Accept: "application/json" };
  }

  const endpoints: Array<{ label: string; url: string }> = [
    { label: "sources", url: "/api/v1/sources" },
    { label: "cohort-definitions", url: "/api/v1/cohort-definitions" },
    { label: "concept-sets", url: "/api/v1/concept-sets" },
    { label: "admin/users", url: "/api/v1/admin/users" },
    { label: "admin/roles", url: "/api/v1/admin/roles" },
    { label: "studies", url: "/api/v1/studies" },
    { label: "care-bundles", url: "/api/v1/care-bundles" },
    { label: "cohort-definitions/tags", url: "/api/v1/cohort-definitions/tags" },
    { label: "admin/system-health", url: "/api/v1/admin/system-health" },
  ];

  for (const ep of endpoints) {
    test(`GET ${ep.url} → 200`, async ({ page }) => {
      const resp = await page.request.get(`${BASE}${ep.url}`, {
        headers: authHeaders(),
      });
      console.log(`  GET ${ep.url} → ${resp.status()}`);
      expect(resp.status()).toBe(200);
    });
  }
});

test.describe("Navigation", () => {
  test("sidebar has nav links", async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(2000);
    const navLinks = await page.locator("nav a, aside a").count();
    console.log(`  Nav links found: ${navLinks}`);
    expect(navLinks).toBeGreaterThanOrEqual(3);
  });

  test("dashboard renders content", async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(`  Dashboard snippet: "${bodyText.slice(0, 150).replace(/\n/g, " ")}"`);
    expect(bodyText.length).toBeGreaterThan(50);
  });
});
