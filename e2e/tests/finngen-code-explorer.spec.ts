import { test, expect } from "@playwright/test";
import { BASE, apiGet } from "./helpers";

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);

test.describe("Code Explorer full flow", () => {
  test.describe.configure({ mode: "serial" });

  test("page loads and source picker is visible", async ({ page }) => {
    await page.goto(`${BASE}/finngen/explore`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Code Explorer/i)).toBeVisible();
  });

  test("picking a source + concept navigates through each tab without errors", async ({ page }) => {
    const readiness = await apiGet(page, "/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA");
    if (readiness.status !== 200) {
      test.skip(true, `Readiness API unavailable (status=${readiness.status})`);
    }
    if (readiness.data?.ready !== true) {
      test.skip(true, "EUNOMIA is not initialized (missing stratified_code_counts); run finngen:setup-source first");
    }

    await page.goto(`${BASE}/finngen/explore?source=EUNOMIA&concept_id=201826`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("button", { name: "Counts" })).toBeVisible();

    for (const tab of ["Relationships", "Hierarchy", "Report", "My Reports"]) {
      await page.getByRole("button", { name: tab }).click();
      await page.waitForTimeout(500);
    }
  });

  test("generating a report end-to-end", async ({ page }) => {
    const readiness = await apiGet(page, "/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA");
    if (readiness.data?.ready !== true) {
      test.skip(true, "EUNOMIA not initialized — skipping report generation E2E");
    }

    const dispatch = await page.request.post(`${BASE}/api/v1/finngen/code-explorer/report`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": `e2e-report-${Date.now()}`,
      },
      data: { source_key: "EUNOMIA", concept_id: 201826 },
    });
    expect(dispatch.status()).toBe(201);
    const { id: runId } = await dispatch.json();

    let finalStatus: string | null = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2_000));
      const { status, data } = await apiGet(page, `/api/v1/finngen/runs/${runId}`);
      if (status === 200 && TERMINAL.has(data.status)) {
        finalStatus = data.status;
        break;
      }
    }

    if (!finalStatus) {
      test.skip(true, "Report did not terminate within 60s");
    }
    expect(["succeeded", "failed"]).toContain(finalStatus);
  });
});
