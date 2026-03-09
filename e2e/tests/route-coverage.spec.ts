import { test, expect } from "@playwright/test";
import { BASE, assertPageLoads, dismissModals } from "./helpers";

/* ────────────────────────────────────────────────────────────────────────────
 * Route Coverage E2E Tests — Tier 1
 *
 * Every application route is loaded and verified:
 *   - No redirect to /login (auth is valid)
 *   - Page renders meaningful content (>10 chars)
 *   - No React error boundary triggered
 *   - No JS crashes (Cannot read properties)
 *   - No non-data-env 5xx API errors
 * ──────────────────────────────────────────────────────────────────────── */

// ── Route definitions ────────────────────────────────────────────────────

const CORE_ROUTES = [
  { path: "/", label: "Dashboard" },
  { path: "/data-sources", label: "Data Sources" },
  { path: "/data-explorer", label: "Data Explorer" },
  { path: "/publish", label: "Publish & Export" },
];

const RESEARCH_ROUTES = [
  { path: "/vocabulary", label: "Vocabulary" },
  { path: "/vocabulary/compare", label: "Vocabulary Compare" },
  { path: "/cohort-definitions", label: "Cohort Definitions" },
  { path: "/concept-sets", label: "Concept Sets" },
  { path: "/analyses", label: "Analyses" },
  { path: "/studies", label: "Studies" },
  { path: "/studies/create", label: "Create Study" },
  { path: "/profiles", label: "Patient Profiles" },
];

const SPECIALIZED_ROUTES = [
  { path: "/genomics", label: "Genomics" },
  { path: "/genomics/analysis", label: "Genomic Analysis" },
  { path: "/genomics/tumor-board", label: "Tumor Board" },
  { path: "/imaging", label: "Imaging" },
  { path: "/heor", label: "HEOR" },
  { path: "/care-gaps", label: "Care Gaps" },
  { path: "/jobs", label: "Jobs" },
];

const INGESTION_ROUTES = [
  { path: "/ingestion", label: "Ingestion Dashboard" },
  { path: "/ingestion/upload", label: "Ingestion Upload" },
];

const ADMIN_ROUTES = [
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
];

// ── Test groups ──────────────────────────────────────────────────────────

function routeTests(
  groupName: string,
  routes: Array<{ path: string; label: string }>
) {
  test.describe(`Route Coverage — ${groupName}`, () => {
    for (const route of routes) {
      test(`${route.label} (${route.path}) loads without crash`, async ({
        page,
      }) => {
        await assertPageLoads(page, route.path);
      });
    }
  });
}

routeTests("Core", CORE_ROUTES);
routeTests("Research", RESEARCH_ROUTES);
routeTests("Specialized", SPECIALIZED_ROUTES);
routeTests("Ingestion", INGESTION_ROUTES);
routeTests("Admin", ADMIN_ROUTES);

// ── Summary test ─────────────────────────────────────────────────────────

const ALL_ROUTES = [
  ...CORE_ROUTES,
  ...RESEARCH_ROUTES,
  ...SPECIALIZED_ROUTES,
  ...INGESTION_ROUTES,
  ...ADMIN_ROUTES,
];

test("route count covers all expected routes", () => {
  // Verify we are testing enough routes (guard against accidental deletion)
  expect(ALL_ROUTES.length).toBeGreaterThanOrEqual(32);
  console.log(`  Total routes under test: ${ALL_ROUTES.length}`);
});
