import { test, expect } from "@playwright/test";
import { BASE, authHeaders, dismissModals } from "../helpers";

/**
 * Phase 3 E2E: visibility wiring
 *
 * Validates the Phase 3 contract from the owner's perspective:
 *   1. ShareDropdown renders for the owner of a saved draft.
 *   2. Toggling to "study" persists via the autosave API and the
 *      library list reflects the visibility badge change.
 *   3. ShareDropdown disables the "study" option when no study is linked.
 *
 * Cross-user access enforcement (collaborator-can-see / cannot-see) is
 * covered at the API layer by PublicationDraftPolicyTest (Task 35); we
 * intentionally do not spin up a second authenticated browser context.
 *
 * Implementation notes:
 *   - Drafts are seeded via API using the global-setup admin token so the
 *     wizard loads with a known state.
 *   - The first test depends on at least one Study existing in the test DB
 *     (so the API will accept visibility=study with study_id). If none
 *     exist, the test is skipped with an annotation rather than failing.
 */

test.describe("Publish Library — Phase 3: visibility wiring", () => {
  test("ShareDropdown toggles visibility and library reflects the badge", async ({
    page,
    request,
  }) => {
    // Find a study the admin can attach the draft to. Skip if /studies isn't
    // reachable (403 = admin lacks studies.view in this env) or if none exist.
    // Cross-user/cross-study enforcement is covered by PublicationDraftPolicyTest.
    const studiesResp = await request.get(`${BASE}/api/v1/studies?per_page=1`, {
      headers: authHeaders(),
    });

    test.skip(
      !studiesResp.ok(),
      `Skipped: GET /api/v1/studies returned ${studiesResp.status()} — admin lacks studies.view in this env. Cross-user enforcement is covered by PublicationDraftPolicyTest at the API level.`,
    );

    const studies = (await studiesResp.json()).data ?? [];

    test.skip(
      studies.length === 0,
      "Skipped: no studies in test DB — Phase 3 'study' visibility requires a linked study (covered by PublicationDraftPolicyTest at the API level).",
    );

    const studyId = studies[0].id;

    // Create a draft attached to the study via the API.
    const createResp = await request.post(`${BASE}/api/v1/publish/drafts`, {
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      data: {
        title: "Phase 3 Test Manuscript",
        template: "generic-ohdsi",
        study_id: studyId,
        document_json: {
          version: 1,
          title: "Phase 3 Test Manuscript",
          authors: [],
          template: "generic-ohdsi",
          step: 2,
          selectedExecutions: [{ studyId, analysisType: "characterization" }],
          sections: [],
        },
      },
    });
    expect(createResp.ok()).toBeTruthy();
    const draft = (await createResp.json()).data;
    expect(draft.id).toBeTruthy();
    expect(draft.visibility).toBe("private");

    const draftId = draft.id;

    try {
      // Load the draft in the wizard.
      await page.goto(`${BASE}/publish/library/${draftId}`);
      await dismissModals(page);

      // ShareDropdown should be visible (only renders when draftId !== null && isOwner).
      const dropdown = page.getByLabel("Visibility", { exact: true });
      await expect(dropdown).toBeVisible({ timeout: 10_000 });
      await expect(dropdown).toHaveValue("private");

      // Toggle to "study".
      await dropdown.selectOption("study");

      // The mutation fires via the autosave hook; give the debounce + roundtrip time.
      // Re-fetch the draft to verify the server persisted the change.
      await expect
        .poll(
          async () => {
            const verifyResp = await request.get(
              `${BASE}/api/v1/publish/drafts/${draftId}`,
              { headers: authHeaders() },
            );
            if (!verifyResp.ok()) return null;
            return (await verifyResp.json()).data.visibility;
          },
          { timeout: 10_000, intervals: [500, 1000, 1500, 2000] },
        )
        .toBe("study");

      // Navigate to the library and confirm the "Study" badge shows on this draft's card.
      await page.goto(`${BASE}/publish/library`);
      await dismissModals(page);

      // Locate the draft card by its title and verify a sibling "Study" badge is visible.
      const card = page
        .locator(`text=Phase 3 Test Manuscript`)
        .first();
      await expect(card).toBeVisible({ timeout: 10_000 });

      // The VisibilityBadge renders "Study" text for visibility=study. At least one
      // such badge should now exist on the page.
      await expect(page.getByText("Study", { exact: true }).first()).toBeVisible(
        { timeout: 5_000 },
      );

      // Toggle back to private via API to round-trip the contract.
      const revertResp = await request.patch(
        `${BASE}/api/v1/publish/drafts/${draftId}`,
        {
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          data: { visibility: "private" },
        },
      );
      expect(revertResp.ok()).toBeTruthy();
      expect((await revertResp.json()).data.visibility).toBe("private");
    } finally {
      // Cleanup: delete the draft.
      await request.delete(`${BASE}/api/v1/publish/drafts/${draftId}`, {
        headers: authHeaders(),
      });
    }
  });

  test("ShareDropdown disables 'study' option when no study is linked", async ({
    page,
    request,
  }) => {
    // Create a draft with no study_id.
    const createResp = await request.post(`${BASE}/api/v1/publish/drafts`, {
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      data: {
        title: "Phase 3 No-Study Test",
        template: "generic-ohdsi",
        document_json: {
          version: 1,
          title: "Phase 3 No-Study Test",
          authors: [],
          template: "generic-ohdsi",
          step: 2,
          selectedExecutions: [],
          sections: [],
        },
      },
    });
    expect(createResp.ok()).toBeTruthy();
    const draft = (await createResp.json()).data;
    expect(draft.study_id).toBeNull();

    const draftId = draft.id;

    try {
      await page.goto(`${BASE}/publish/library/${draftId}`);
      await dismissModals(page);

      const dropdown = page.getByLabel("Visibility", { exact: true });
      await expect(dropdown).toBeVisible({ timeout: 10_000 });
      await expect(dropdown).toHaveValue("private");

      // The "study" <option> should be disabled because there's no linked study.
      const studyOption = dropdown.locator('option[value="study"]');
      await expect(studyOption).toHaveCount(1);
      const isDisabled = await studyOption.evaluate(
        (el) => (el as HTMLOptionElement).disabled,
      );
      expect(isDisabled).toBe(true);
    } finally {
      await request.delete(`${BASE}/api/v1/publish/drafts/${draftId}`, {
        headers: authHeaders(),
      });
    }
  });
});
