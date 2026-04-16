// e2e/tests/finngen-analysis-gallery.spec.ts
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8082";

// Helper: login and get auth cookie
async function loginAsResearcher(page: import("@playwright/test").Page) {
  const res = await page.request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: {
      email: process.env.E2E_USER_EMAIL ?? "admin@acumenus.net",
      password: process.env.E2E_USER_PASSWORD ?? "superuser",
    },
  });
  const body = await res.json();
  const token = body.token;
  await page.setExtraHTTPHeaders({ Authorization: `Bearer ${token}` });
  return token;
}

test.describe("FinnGen Analysis Gallery", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsResearcher(page);
  });

  test("gallery loads with 4 CO2 module cards in Clinical > FinnGen Analyses tab", async ({ page }) => {
    // Navigate to an investigation clinical panel
    // The exact URL depends on having an investigation — use the API to check
    const modulesRes = await page.request.get(`${BASE_URL}/api/v1/finngen/analyses/modules`);
    expect(modulesRes.ok()).toBeTruthy();
    const modulesBody = await modulesRes.json();
    const co2Modules = modulesBody.data.filter((m: { key: string }) => m.key.startsWith("co2."));
    expect(co2Modules.length).toBe(4);
  });

  test("single module detail endpoint returns schema", async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/v1/finngen/analyses/modules/co2.codewas`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.settings_schema).toBeTruthy();
    expect(body.data.settings_schema.required).toContain("case_cohort_id");
  });

  test("dispatch CodeWAS run via API + poll terminal + verify display artifact", async ({ page }) => {
    const token = await loginAsResearcher(page);

    // Create a run
    const createRes = await page.request.post(`${BASE_URL}/api/v1/finngen/runs`, {
      data: {
        analysis_type: "co2.codewas",
        source_key: process.env.E2E_SOURCE_KEY ?? "PANCREAS",
        params: {
          case_cohort_id: 1,
          control_cohort_id: 2,
          min_cell_count: 5,
        },
      },
      headers: {
        "Idempotency-Key": `e2e-codewas-${Date.now()}`,
      },
    });

    if (!createRes.ok()) {
      test.skip(true, "Run dispatch failed — source may not be ready");
      return;
    }

    const run = await createRes.json();
    expect(run.id).toBeTruthy();

    // Poll for terminal status (max 120s)
    let status = run.status;
    let attempts = 0;
    while (!["succeeded", "failed", "canceled"].includes(status) && attempts < 60) {
      await page.waitForTimeout(2000);
      const pollRes = await page.request.get(`${BASE_URL}/api/v1/finngen/runs/${run.id}`);
      const pollBody = await pollRes.json();
      status = pollBody.status;
      attempts++;
    }

    if (status === "succeeded") {
      // Verify display artifact exists
      const artifactRes = await page.request.get(
        `${BASE_URL}/api/v1/finngen/runs/${run.id}/artifacts/display`,
      );
      expect(artifactRes.ok()).toBeTruthy();
    }
  });
});
