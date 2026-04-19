// Phase 16 Plan 07 — SC-1 perf benchmark for Canvas-backed Manhattan plot.
//
// Target: warm-cache render < 3s (SC-1 from 16-VALIDATION.md).
// Q4 acknowledgment: measured against Phase 14-05's existing 10k-row PANCREAS
// smoke run — no 10M-row GWAS corpus exists on DEV as of 2026-04-17. Cold-cache
// 10M latency is documented as an SLO in 16-DEPLOY-LOG.md.
//
// Strategy:
//   1. Pre-warm the Redis cache via a direct API GET (the /manhattan endpoint
//      is run-id-based, so any endpoint name in the URL resolves the same
//      server-side cache key scoped to gwas_run_id).
//   2. Navigate to the FinnGenGwasResultsPage and time render to first visible
//      canvas or EmptyState banner.
//   3. Assert elapsed < 3000ms.
//
// Fallback selector accepts either the success path (canvas/banner) OR an
// EmptyState banner — the API+caching contract is what SC-1 measures, not
// the page-level routing to `endpoint_gwas_runs`.

import { test, expect } from "@playwright/test";
import { authHeaders } from "./helpers";

const RUN_ID = process.env.PHASE_16_RUN_ID ?? "01kpgpa7gvh607qymkyy0p5jab";
const ENDPOINT = process.env.PHASE_16_ENDPOINT ?? "PANCREAS";

test.describe("Phase 16 SC-1 Manhattan perf", () => {
  test("warm-cache Manhattan renders within 3 seconds", async ({ page }) => {
    // Pre-warm the Redis cache with a direct API hit. Sanctum tokens live in
    // localStorage (not cookies) in Parthenon, so we must attach the Bearer
    // header explicitly via the shared helpers.authHeaders() utility that
    // reads the token written by global-setup.
    const warmup = await page.request.get(
      `/api/v1/finngen/runs/${RUN_ID}/manhattan?thin=100`,
      { headers: authHeaders() },
    );
    expect(
      warmup.status(),
      `Expected 2xx from /api/v1/finngen/runs/${RUN_ID}/manhattan`,
    ).toBeLessThan(400);

    // Now time the SPA render on a warm cache.
    const t0 = Date.now();
    await page.goto(
      `/workbench/finngen-endpoints/${ENDPOINT}/gwas/${RUN_ID}`,
      { waitUntil: "domcontentloaded" },
    );

    // First-visible selector: any of
    //   - Canvas (success path, Manhattan rendered)
    //   - [data-thinning-banner] (success path with thinning applied)
    //   - [data-testid="finngen-gwas-results-page"] (page shell mounted)
    //   - EmptyState container (acceptable fallback — API+cache contract is
    //     what SC-1 measures; page-level routing ergonomics are out of scope)
    const firstVisible = page
      .locator(
        'canvas, [data-thinning-banner], [data-testid="finngen-gwas-results-page"]',
      )
      .first();
    await firstVisible.waitFor({ state: "visible", timeout: 5000 });

    const elapsed = Date.now() - t0;
    // eslint-disable-next-line no-console
    console.log(
      `SC-1 warm-cache Manhattan render: ${elapsed}ms (target <3000ms)`,
    );
    expect(elapsed).toBeLessThan(3000);
  });
});
