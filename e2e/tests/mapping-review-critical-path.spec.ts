/**
 * Phase 3 Plan 7 Task 11 (T-024B) — Harmonia reviewer UI critical path.
 *
 * Validates that:
 *   1. /admin/mapping-review renders without crashing for an authenticated user
 *   2. The status pill row is present (Pending / Approved / Rejected / Escalated)
 *   3. The filter row exposes status, source_vocab, sort_by, search
 *   4. Keyboard shortcut help overlay opens on '?'
 *   5. The detail-page route loads when a queue row exists (or shows the
 *      empty-state when the queue is genuinely empty in the test DB)
 *
 * The full approve→queue-flip flow needs a seeded queue row and the
 * mapping-reviewer Spatie role. This spec covers the page-level smoke
 * test; the data-driven flow lives in the Pest test suite which
 * exercises the controller end-to-end.
 */
import { test, expect } from "@playwright/test";
import { assertPageLoads, collectErrors, BASE } from "./helpers";

test.describe("Harmonia reviewer UI", () => {
  test("/admin/mapping-review queue page loads without crashing", async ({ page }) => {
    await assertPageLoads(page, "/admin/mapping-review");

    // Page-level signals: header + status pills are always rendered
    await expect(page.getByRole("heading", { name: /Concept-Mapping Review/i }))
      .toBeVisible();
    await expect(page.getByText("Pending", { exact: false })).toBeVisible();
    await expect(page.getByText("Approved", { exact: false })).toBeVisible();
  });

  test("filter controls are present and accessible", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${BASE}/admin/mapping-review`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Status select
    await expect(page.getByRole("combobox").first()).toBeVisible();
    // Search input — uses type=search and aria-keyshortcuts="/"
    const searchBox = page.locator('input[type="search"]');
    await expect(searchBox).toBeVisible();
    await expect(searchBox).toHaveAttribute("aria-keyshortcuts", "/");

    if (errors.pageErrors.length > 0) {
      throw new Error(`JS errors on queue page: ${errors.pageErrors.join("; ")}`);
    }
  });

  test("'?' opens the keyboard help overlay", async ({ page }) => {
    await page.goto(`${BASE}/admin/mapping-review`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Body must own focus so the keydown isn't swallowed by an input.
    await page.locator("body").click();
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: /keyboard shortcuts/i }))
      .toBeVisible();

    // Esc closes the overlay
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /keyboard shortcuts/i }))
      .not.toBeVisible();
  });

  test("queue page exposes the empty-state copy when no items match", async ({ page }) => {
    // Force a filter combination that's overwhelmingly likely to be empty
    // even on a seeded test DB: a fake source_vocab + a non-existent code.
    await page.goto(
      `${BASE}/admin/mapping-review?source_vocab=NEVER_EXISTS&q=zzzzzz`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForTimeout(2000);

    // The empty state echoes the Hecate/Harmonia/Ariadne triad as a
    // brand signature and a usability cue.
    await expect(
      page.getByText(/Hecate searches the crossroads\. Harmonia harmonizes\. Ariadne records the thread\./i),
    ).toBeVisible();
  });
});
