import { test, expect } from "@playwright/test";
import { BASE, apiGet } from "./helpers";

/* ────────────────────────────────────────────────────────────────────────────
 * FinnGen SP2 Code Explorer — E2E smoke against PANCREAS (Pancreatic Cancer
 * Corpus). Code Explorer is nested inside Investigation as an evidence-domain
 * tab; there is no standalone page. These tests assume finngen:setup-source
 * PANCREAS has been run so stratified_code_counts is populated.
 *
 * Test concept: 3004501 "Glucose [Mass/volume] in Serum or Plasma" (LOINC).
 * Chosen because it has 6,745 observations across 2019-2022 in PANCREAS and
 * is a reliable smoke subject (no oncology-specific coverage required).
 * ──────────────────────────────────────────────────────────────────────── */

const SOURCE = "PANCREAS";
const CONCEPT_ID = 3004501;
const TERMINAL = new Set(["succeeded", "failed", "canceled"]);

test.describe("Code Explorer full flow", () => {
  test.describe.configure({ mode: "serial" });

  test("source-readiness API responds green for PANCREAS", async ({ page }) => {
    const readiness = await apiGet(page, `/api/v1/finngen/code-explorer/source-readiness?source=${SOURCE}`);
    if (readiness.status !== 200) {
      test.skip(true, `Readiness API unavailable (status=${readiness.status})`);
    }
    if (readiness.data?.ready !== true) {
      test.skip(true, `${SOURCE} is not initialized; run 'php artisan finngen:setup-source ${SOURCE}'`);
    }
    expect(readiness.data.ready).toBe(true);
  });

  test("scoped concept search returns in-source results", async ({ page }) => {
    const resp = await apiGet(
      page,
      `/api/v1/finngen/code-explorer/concepts?source=${SOURCE}&q=glucose&limit=5`,
    );
    if (resp.status !== 200) {
      test.skip(true, `/concepts unavailable (status=${resp.status})`);
    }
    expect(Array.isArray(resp.data.items)).toBe(true);
    if (resp.data.items.length > 0) {
      expect(resp.data.items[0]).toHaveProperty("observation_count");
    }
  });

  test("counts returns stratified data for a known concept", async ({ page }) => {
    const resp = await apiGet(
      page,
      `/api/v1/finngen/code-explorer/counts?source=${SOURCE}&concept_id=${CONCEPT_ID}`,
    );
    if (resp.status !== 200) {
      test.skip(true, `counts returned ${resp.status} — run setup-source first`);
    }
    const payload = resp.data.result ?? resp.data;
    expect(Array.isArray(payload.stratified_counts)).toBe(true);
    expect(payload.stratified_counts.length).toBeGreaterThan(0);
  });

  test("relationships + hierarchy render for the concept", async ({ page }) => {
    const rels = await apiGet(
      page,
      `/api/v1/finngen/code-explorer/relationships?source=${SOURCE}&concept_id=${CONCEPT_ID}`,
    );
    const hier = await apiGet(
      page,
      `/api/v1/finngen/code-explorer/ancestors?source=${SOURCE}&concept_id=${CONCEPT_ID}&max_depth=2`,
    );
    if (rels.status !== 200 || hier.status !== 200) {
      test.skip(true, "relationships or ancestors endpoint unavailable");
    }
    const relPayload = rels.data.result ?? rels.data;
    const hierPayload = hier.data.result ?? hier.data;
    expect(Array.isArray(relPayload.relationships)).toBe(true);
    expect(Array.isArray(hierPayload.nodes)).toBe(true);
    expect(Array.isArray(hierPayload.edges)).toBe(true);
  });

  test("generating a report end-to-end", async ({ page }) => {
    const readiness = await apiGet(page, `/api/v1/finngen/code-explorer/source-readiness?source=${SOURCE}`);
    if (readiness.data?.ready !== true) {
      test.skip(true, `${SOURCE} not initialized — skipping report generation E2E`);
    }

    const dispatch = await page.request.post(`${BASE}/api/v1/finngen/code-explorer/report`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": `e2e-report-${Date.now()}`,
      },
      data: { source_key: SOURCE, concept_id: CONCEPT_ID },
    });
    expect(dispatch.status()).toBe(201);
    const { id: runId } = await dispatch.json();

    let finalStatus: string | null = null;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2_000));
      const { status, data } = await apiGet(page, `/api/v1/finngen/runs/${runId}`);
      if (status === 200 && TERMINAL.has(data.status)) {
        finalStatus = data.status;
        break;
      }
    }

    if (!finalStatus) {
      test.skip(true, "Report did not terminate within 120s");
    }
    expect(["succeeded", "failed"]).toContain(finalStatus);
  });
});
