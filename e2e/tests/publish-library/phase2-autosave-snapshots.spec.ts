import { test, expect } from "@playwright/test";
import { BASE, dismissModals } from "../helpers";

/**
 * Phase 2 E2E: autosave + snapshots
 *
 * Validates the Phase 2 contract:
 *   1. Editing a draft triggers autosave within the debounce window (~3s).
 *   2. Reloading the page preserves the persisted draft state.
 *   3. A snapshot can be created and reverted; revert auto-creates a
 *      "Before revert (auto)" snapshot.
 *
 * Implementation notes:
 *   - The wizard persists state to sessionStorage under
 *     `parthenon:publish-wizard`. We pre-seed step=2 so the snapshots
 *     panel and title input are rendered immediately after save, which
 *     makes the test independent of Step 1's UnifiedAnalysisPicker
 *     (which needs real OMOP data to allow advancing).
 *   - SaveStatusIndicator only renders when a draftId is present
 *     (Phase 2 wiring in PublishPage), so we save the draft first.
 */

const WIZARD_STORAGE_KEY = "parthenon:publish-wizard";
const PROMPT_SHOWN_KEY = "parthenon:publish-prompt-shown";

async function seedWizardOnStep2(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ({ storageKey, promptKey }) => {
      try {
        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            step: 2,
            selectedExecutions: [],
            sections: [],
            title: "",
            authors: [],
            template: "generic-ohdsi",
            hasMeaningfulEdit: false,
          }),
        );
        // Suppress the one-shot HybridPromptModal that fires on first edit
        window.sessionStorage.setItem(promptKey, "1");
      } catch {
        // ignore
      }
    },
    { storageKey: WIZARD_STORAGE_KEY, promptKey: PROMPT_SHOWN_KEY },
  );
}

test.describe("Publish Library — Phase 2: autosave + snapshots", () => {
  test("autosaves on edit and persists across reload", async ({ page }) => {
    await seedWizardOnStep2(page);

    // Start a new draft and save to get a draftId
    await page.goto(`${BASE}/publish/library/new`);
    await dismissModals(page);

    const saveBtn = page.getByRole("button", { name: /Save as Draft/i });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click({ force: true });

    // After save, URL becomes /publish/library/:id and the
    // SaveStatusIndicator replaces the SaveDraftButton.
    await expect(page).toHaveURL(/\/publish\/library\/\d+/, { timeout: 15_000 });
    const draftId = page.url().match(/\/publish\/library\/(\d+)/)![1];

    // Step 2 (DocumentConfigurator) should be rendered — the title input
    // has id="doc-title".
    const titleInput = page.locator("#doc-title");
    await expect(titleInput).toBeVisible({ timeout: 10_000 });

    // Make a meaningful edit
    await titleInput.fill("Autosave Test Manuscript");

    // Within the 2s debounce + roundtrip, the SaveStatusIndicator should
    // transition through Saving… and land on "Saved".
    await expect(page.getByText(/Saving…|Saved/i)).toBeVisible({
      timeout: 6_000,
    });
    await expect(page.getByText(/^Saved/)).toBeVisible({ timeout: 8_000 });

    // Reload and confirm the URL and title persist (server-side draft hydration)
    await page.reload();
    await dismissModals(page);
    await expect(page).toHaveURL(new RegExp(`/publish/library/${draftId}$`));
    await expect(page.locator("#doc-title")).toHaveValue(
      "Autosave Test Manuscript",
      { timeout: 10_000 },
    );
  });

  test("creates a snapshot and reverts from the snapshots panel", async ({
    page,
  }) => {
    await seedWizardOnStep2(page);

    // Fresh draft — Playwright tests are isolated, so re-create.
    await page.goto(`${BASE}/publish/library/new`);
    await dismissModals(page);

    const saveBtn = page.getByRole("button", { name: /Save as Draft/i });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click({ force: true });
    await expect(page).toHaveURL(/\/publish\/library\/\d+/, { timeout: 15_000 });

    // Wait for Step 2 to render so SnapshotsPanel is mounted
    await expect(page.locator("#doc-title")).toBeVisible({ timeout: 10_000 });

    // SnapshotsPanel header
    await expect(
      page.getByRole("heading", { name: /^Snapshots$/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Click "New snapshot" to open the create modal
    const newSnapshot = page.getByRole("button", { name: /New snapshot/i });
    await expect(newSnapshot).toBeVisible();
    await newSnapshot.click({ force: true });

    // Fill the label and submit
    const labelInput = page
      .locator('label:has-text("Label") input[type="text"]')
      .first();
    await expect(labelInput).toBeVisible({ timeout: 5_000 });
    await labelInput.fill("Pre-IRB");
    await page
      .getByRole("button", { name: /Create snapshot/i })
      .click({ force: true });

    // Snapshot should appear in the panel list
    await expect(page.getByText("Pre-IRB").first()).toBeVisible({
      timeout: 10_000,
    });

    // Trigger revert — aria-label is "Revert to Pre-IRB"
    await page
      .getByRole("button", { name: /Revert to Pre-IRB/i })
      .click({ force: true });

    // Revert confirmation dialog — confirm with "Revert" button
    await expect(
      page.getByRole("heading", { name: /Revert to "Pre-IRB"\?/i }),
    ).toBeVisible({ timeout: 5_000 });
    await page
      .getByRole("button", { name: /^Revert$/ })
      .click({ force: true });

    // After revert, a "Before revert (auto)" snapshot should be auto-created
    await expect(page.getByText(/Before revert \(auto\)/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
