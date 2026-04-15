import { test, expect } from "@playwright/test";
import { apiGet } from "./helpers";

/* ────────────────────────────────────────────────────────────────────────────
 * FinnGen Sync-Read — E2E smoke test (SP1 Runtime Foundation)
 *
 * Exercises /api/v1/finngen/sync/romopapi/code-counts end-to-end: Laravel
 * auth + permission gate → FinnGenClient → Darkstar Plumber → vocab query.
 * Skips gracefully if Darkstar is not available (R container takes 60s+ to
 * warm; CI runs this in the nightly slow lane).
 * ──────────────────────────────────────────────────────────────────────── */

test.describe("FinnGen sync read — code counts", () => {
  test.describe.configure({ mode: "serial", retries: 0 });

  test("GET /finngen/sync/romopapi/code-counts for a known concept on EUNOMIA", async ({ page }) => {
    const { status, data } = await apiGet(
      page,
      "/api/v1/finngen/sync/romopapi/code-counts?source=EUNOMIA&concept_id=201826",
    );

    // Skip (not fail) if Darkstar unreachable — this is the expected state
    // on dev machines without a live Darkstar container.
    if (status === 502 || status === 504) {
      test.skip(true, `Darkstar unreachable (${status}) — skipping sync-read E2E`);
    }

    // If Eunomia isn't seeded, Laravel will 422 source or the Darkstar call
    // will return the empty shape. Either is a valid skip, not a fail.
    if (status === 422) {
      const msg = JSON.stringify(data);
      test.skip(true, `Source not configured for sync read: ${msg}`);
    }

    expect(status).toBe(200);
    expect(data).toHaveProperty("concept");
    expect(data).toHaveProperty("stratified_counts");
  });

  test("missing source param returns 422", async ({ page }) => {
    const { status } = await apiGet(
      page,
      "/api/v1/finngen/sync/romopapi/code-counts?concept_id=201826",
    );
    expect(status).toBe(422);
  });
});
