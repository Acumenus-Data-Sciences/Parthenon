import { test, expect } from "@playwright/test";
import { BASE, dismissModals } from "../helpers";

test.describe("Publish Library — Phase 1 lifecycle", () => {
  test("redirects /publish to /publish/library and shows the library", async ({ page }) => {
    await page.goto(`${BASE}/publish`);
    await dismissModals(page);
    await expect(page).toHaveURL(/\/publish\/library/);
    await expect(
      page.getByRole("heading", { name: /Pre-Publication Library/i }),
    ).toBeVisible();
  });

  test("New Document CTA navigates to /publish/library/new", async ({ page }) => {
    await page.goto(`${BASE}/publish/library`);
    await dismissModals(page);

    // The "New Document" button appears in the header (always present),
    // OR the empty-state CTA "Start a New Document" (when no drafts exist).
    const newDoc = page.getByRole("link", {
      name: /^(New Document|Start a New Document)$/i,
    });
    await expect(newDoc.first()).toBeVisible();
    await newDoc.first().click({ force: true });
    await expect(page).toHaveURL(/\/publish\/library\/new/);

    // Step 1 of the wizard should render — confirm the step indicator is mounted.
    await expect(page.locator('[data-testid="step-indicator"]')).toBeVisible();
  });

  test("save-as-draft round trip preserves draft and step", async ({ page }) => {
    await page.goto(`${BASE}/publish/library/new`);
    await dismissModals(page);

    // The Save Draft button shows "Save as Draft" before a draft exists.
    const saveBtn = page.getByRole("button", { name: /Save as Draft/i });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click({ force: true });

    // After save, URL becomes /publish/library/:id (router replaces history entry).
    await expect(page).toHaveURL(/\/publish\/library\/\d+/, { timeout: 15_000 });

    // Save button label switches to "Save Draft" (no longer "Save as Draft").
    await expect(
      page.getByRole("button", { name: /^(Save Draft|Saving…)$/i }),
    ).toBeVisible();

    // Capture the draft id from URL.
    const url = page.url();
    const match = url.match(/\/publish\/library\/(\d+)/);
    expect(match).not.toBeNull();
    const draftId = match![1];

    // Navigate to library and confirm the new draft appears.
    await page.goto(`${BASE}/publish/library`);
    await dismissModals(page);
    // Default title for a wizard saved without a custom title is "Untitled manuscript".
    await expect(page.getByText(/Untitled manuscript/i).first()).toBeVisible();

    // Reopen the draft and confirm step indicator + URL match.
    await page.goto(`${BASE}/publish/library/${draftId}`);
    await dismissModals(page);
    await expect(page).toHaveURL(new RegExp(`/publish/library/${draftId}$`));
    await expect(page.locator('[data-testid="step-indicator"]')).toBeVisible();
  });
});
