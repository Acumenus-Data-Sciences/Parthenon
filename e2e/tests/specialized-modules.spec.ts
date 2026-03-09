import { test, expect } from "@playwright/test";
import {
  assertPageLoads,
  collectErrors,
  apiGet,
  getFirstId,
} from "./helpers";

// ── Genomics ─────────────────────────────────────────────────────────────────

test.describe("Genomics", () => {
  test("/genomics page loads", async ({ page }) => {
    await assertPageLoads(page, "/genomics");
  });

  test("/genomics/analysis page loads", async ({ page }) => {
    await assertPageLoads(page, "/genomics/analysis");
  });

  test("/genomics/tumor-board page loads", async ({ page }) => {
    await assertPageLoads(page, "/genomics/tumor-board");
  });
});

// ── Imaging ──────────────────────────────────────────────────────────────────

test.describe("Imaging", () => {
  test("/imaging page loads", async ({ page }) => {
    await assertPageLoads(page, "/imaging");
  });
});

// ── HEOR ─────────────────────────────────────────────────────────────────────

test.describe("HEOR", () => {
  test("/heor page loads", async ({ page }) => {
    await assertPageLoads(page, "/heor");
  });
});

// ── Care Gaps ────────────────────────────────────────────────────────────────

test.describe("Care Gaps", () => {
  test("/care-gaps page loads", async ({ page }) => {
    await assertPageLoads(page, "/care-gaps");
  });

  test("first bundle detail loads if bundles exist", async ({ page }) => {
    const firstId = await getFirstId(page, "/api/v1/care-bundles");
    if (firstId === null) {
      test.skip(true, "No care bundles in database");
      return;
    }
    console.log(`  Testing care bundle detail: ${firstId}`);
    await assertPageLoads(page, `/care-gaps/${firstId}`);
  });
});

// ── Jobs ─────────────────────────────────────────────────────────────────────

test.describe("Jobs", () => {
  test("/jobs page loads with job list or empty state", async ({ page }) => {
    await assertPageLoads(page, "/jobs");

    const body = await page.evaluate(() => document.body.innerText);
    // Should show either job entries or an empty-state message
    expect(body.length).toBeGreaterThan(20);
  });
});
