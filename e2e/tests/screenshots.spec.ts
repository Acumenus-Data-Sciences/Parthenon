/**
 * Screenshot capture for every app route.
 * Saves named PNGs to e2e/screenshots/ for visual review.
 */
import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://192.168.1.33:8082";

const ROUTES = [
  { path: "/", label: "dashboard" },
  { path: "/data-sources", label: "data-sources" },
  { path: "/data-explorer", label: "data-explorer" },
  { path: "/vocabulary", label: "vocabulary" },
  { path: "/vocabulary/compare", label: "vocabulary-compare" },
  { path: "/cohort-definitions", label: "cohort-definitions" },
  { path: "/concept-sets", label: "concept-sets" },
  { path: "/analyses", label: "analyses" },
  { path: "/studies", label: "studies" },
  { path: "/profiles", label: "profiles" },
  { path: "/care-gaps", label: "care-gaps" },
  { path: "/jobs", label: "jobs" },
  { path: "/ingestion", label: "ingestion" },
  { path: "/ingestion/upload", label: "ingestion-upload" },
  { path: "/genomics", label: "genomics" },
  { path: "/genomics/analysis", label: "genomics-analysis" },
  { path: "/genomics/tumor-board", label: "genomics-tumor-board" },
  { path: "/imaging", label: "imaging" },
  { path: "/heor", label: "heor" },
  { path: "/admin", label: "admin" },
  { path: "/admin/users", label: "admin-users" },
  { path: "/admin/roles", label: "admin-roles" },
  { path: "/admin/auth-providers", label: "admin-auth-providers" },
  { path: "/admin/ai-providers", label: "admin-ai-providers" },
  { path: "/admin/system-health", label: "admin-system-health" },
  { path: "/admin/vocabulary", label: "admin-vocabulary" },
  { path: "/admin/fhir-connections", label: "admin-fhir-connections" },
  { path: "/admin/fhir-sync-monitor", label: "admin-fhir-sync-monitor" },
  { path: "/admin/webapi-registry", label: "admin-webapi-registry" },
  { path: "/admin/notifications", label: "admin-notifications" },
  { path: "/login", label: "login" },
  { path: "/register", label: "register" },
];

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

async function dismissModals(page: import("@playwright/test").Page) {
  // Dismiss changelog / "What's New" modal
  const gotIt = page.locator('button:has-text("Got it"), button:has-text("Got It"), button:has-text("Dismiss")');
  if (await gotIt.count() > 0) {
    await gotIt.first().click();
    await page.waitForTimeout(400);
  }
  // Dismiss any other modal close buttons
  const closeBtn = page.locator('[aria-label="Close"], button:has-text("Close")');
  if (await closeBtn.count() > 0) {
    await closeBtn.first().click();
    await page.waitForTimeout(300);
  }
}

for (const route of ROUTES) {
  test(`screenshot: ${route.label}`, async ({ page }) => {
    // Auth pages: clear session so we see the actual page
    if (route.path === "/login" || route.path === "/register") {
      await page.context().clearCookies();
      await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
    } else {
      await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      await dismissModals(page);
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${route.label}.png`),
      fullPage: true,
    });
  });
}
