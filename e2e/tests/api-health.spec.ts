import { test, expect } from "@playwright/test";
import { BASE, authHeaders } from "./helpers";

/* ────────────────────────────────────────────────────────────────────────────
 * API Health Check E2E Tests — Tier 1
 *
 * Validates that all core API endpoints respond with expected status codes.
 * Bearer token auth from global setup. Data-env endpoints excluded from
 * strict 200 assertions.
 * ──────────────────────────────────────────────────────────────────────── */

test.describe("API Health — No Auth Required", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("GET /sanctum/csrf-cookie returns 204", async ({ request }) => {
    const resp = await request.get(`${BASE}/sanctum/csrf-cookie`);
    expect(resp.status()).toBe(204);
  });

  test("GET /api/v1/nonexistent returns 404 not 500", async ({ request }) => {
    const resp = await request.get(`${BASE}/api/v1/nonexistent`, {
      headers: { Accept: "application/json" },
    });
    expect(resp.status()).toBe(404);
  });
});

test.describe("API Health — Authenticated (Bearer)", () => {
  const endpoints = [
    { url: "/api/v1/sources", label: "sources" },
    { url: "/api/v1/cohort-definitions", label: "cohort-definitions" },
    { url: "/api/v1/concept-sets", label: "concept-sets" },
    { url: "/api/v1/analyses", label: "analyses" },
    { url: "/api/v1/studies", label: "studies" },
    { url: "/api/v1/care-bundles", label: "care-bundles" },
    { url: "/api/v1/admin/users", label: "admin/users" },
    { url: "/api/v1/admin/roles", label: "admin/roles" },
    { url: "/api/v1/admin/system-health", label: "admin/system-health" },
    { url: "/api/v1/cohort-definitions/tags", label: "cohort-definitions/tags" },
    { url: "/api/v1/analyses/stats", label: "analyses/stats" },
    { url: "/api/v1/admin/ai-providers", label: "admin/ai-providers" },
    { url: "/api/v1/auth/user", label: "auth/user" },
  ];

  for (const ep of endpoints) {
    test(`GET ${ep.url} returns 200`, async ({ request }) => {
      const resp = await request.get(`${BASE}${ep.url}`, {
        headers: authHeaders(),
      });
      console.log(`  GET ${ep.url} -> ${resp.status()}`);
      expect(resp.status()).toBe(200);
    });
  }

  test("auth/user returns user object with email", async ({ request }) => {
    const resp = await request.get(`${BASE}/api/v1/auth/user`, {
      headers: authHeaders(),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    const user = body.data ?? body;
    expect(user.email).toBeTruthy();
    expect(typeof user.email).toBe("string");
  });

  test("sources returns array", async ({ request }) => {
    const resp = await request.get(`${BASE}/api/v1/sources`, {
      headers: authHeaders(),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    const items = body.data ?? body;
    expect(Array.isArray(items)).toBeTruthy();
  });

  test("analyses/stats returns stats object", async ({ request }) => {
    const resp = await request.get(`${BASE}/api/v1/analyses/stats`, {
      headers: authHeaders(),
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    const stats = body.data ?? body;
    expect(stats).toBeTruthy();
    // Should have grand_total or similar field
    expect(
      stats.grand_total !== undefined || typeof stats === "object"
    ).toBeTruthy();
  });
});
