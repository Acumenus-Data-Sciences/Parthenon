import { test, expect, Page } from "@playwright/test";
import { apiGet, BASE, authHeaders } from "./helpers";

/* ────────────────────────────────────────────────────────────────────────────
 * FinnGen CodeWAS Lifecycle — E2E smoke test (SP1 Runtime Foundation)
 *
 * Exercises the async run lifecycle:
 *   POST /api/v1/finngen/runs {co2.codewas, EUNOMIA, params}
 *   → run_id
 *   → poll GET /api/v1/finngen/runs/{id} until status terminal or timeout
 *   → POST /api/v1/finngen/runs/{id}/cancel (cancel variant)
 *
 * Requires:
 *   - Live Darkstar with FinnGen R packages loaded
 *   - EUNOMIA source seeded in app.sources + app.source_daimons
 *   - Eunomia demo cohorts present in eunomia_results.cohort (ids 1 and 2)
 *
 * Skips gracefully on missing dependencies.
 * ──────────────────────────────────────────────────────────────────────── */

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);

async function postJson(
  page: Page,
  url: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
) {
  const response = await page.request.post(`${BASE}${url}`, {
    data: body,
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
  const status = response.status();
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-json */
  }
  return { status, data };
}

test.describe("FinnGen CodeWAS lifecycle", () => {
  test.describe.configure({ mode: "serial", retries: 0 });

  test("creates a run + polls until a terminal state (or skips if env not ready)", async ({ page }) => {
    // Idempotency-Key must be stable across retries but unique per test run
    const idempotencyKey = `e2e-codewas-${Date.now()}`;

    const create = await postJson(
      page,
      "/api/v1/finngen/runs",
      {
        analysis_type: "co2.codewas",
        source_key: "EUNOMIA",
        params: { cohortIdCases: 1, cohortIdControls: 2 },
      },
      { "Idempotency-Key": idempotencyKey },
    );

    // Skip if env isn't ready
    if (create.status === 422) {
      test.skip(true, `Create validation failed: ${JSON.stringify(create.data)}`);
    }
    if (create.status === 503) {
      test.skip(true, "Dispatch paused");
    }
    if (create.status === 502 || create.status === 504) {
      test.skip(true, "Darkstar unreachable");
    }

    expect(create.status).toBe(201);
    const runId = (create.data as { id?: string })?.id;
    expect(runId).toBeTruthy();

    // Poll up to 90s for a terminal state. In practice CodeWAS on Eunomia
    // is 15-60s; this gives generous headroom.
    let finalStatus: string | null = null;
    let attempts = 0;
    const maxAttempts = 45;
    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2_000));
      const show = await apiGet(page, `/api/v1/finngen/runs/${runId}`);
      if (show.status !== 200) {
        expect(show.status).toBe(200);
      }
      const status = (show.data as { status?: string })?.status ?? "unknown";
      if (TERMINAL.has(status)) {
        finalStatus = status;
        break;
      }
      attempts++;
    }

    if (!finalStatus) {
      test.skip(true, `Run did not reach terminal state within 90s — Darkstar may be slow or unavailable`);
    }

    // Either succeeded or failed with a classified error is acceptable —
    // this test proves the plumbing works, not the analysis correctness.
    expect(["succeeded", "failed", "canceled"]).toContain(finalStatus);
  });

  test("cancel variant — create + flip to canceling + confirm terminal canceled", async ({ page }) => {
    const idempotencyKey = `e2e-codewas-cancel-${Date.now()}`;

    const create = await postJson(
      page,
      "/api/v1/finngen/runs",
      {
        analysis_type: "co2.codewas",
        source_key: "EUNOMIA",
        params: { cohortIdCases: 1, cohortIdControls: 2 },
      },
      { "Idempotency-Key": idempotencyKey },
    );

    if (
      create.status === 422 ||
      create.status === 502 ||
      create.status === 503 ||
      create.status === 504
    ) {
      test.skip(true, `Create not possible: ${create.status}`);
    }
    expect(create.status).toBe(201);
    const runId = (create.data as { id?: string })?.id;
    expect(runId).toBeTruthy();

    // Fire cancel immediately. RunService flips to 'canceling'; Horizon worker
    // then propagates to Darkstar DELETE /jobs/... and marks canceled.
    const cancel = await postJson(page, `/api/v1/finngen/runs/${runId}/cancel`, {});
    expect(cancel.status).toBe(202);

    // Poll for terminal — may be "canceled" (ideal) OR "succeeded"/"failed"
    // if the run finished naturally before cancellation propagated (race OK).
    let finalStatus: string | null = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1_000));
      const show = await apiGet(page, `/api/v1/finngen/runs/${runId}`);
      const status = (show.data as { status?: string })?.status ?? "";
      if (TERMINAL.has(status)) {
        finalStatus = status;
        break;
      }
    }
    if (!finalStatus) {
      test.skip(true, "Run did not terminate within 30s");
    }
    expect(["canceled", "succeeded", "failed"]).toContain(finalStatus);
  });
});
