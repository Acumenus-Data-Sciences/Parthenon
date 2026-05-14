import { test, expect, APIRequestContext } from "@playwright/test";
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
 *   - Drafts and the fixture study are seeded via API using the global-setup
 *     admin token so the wizard loads with a known state. Setup is idempotent:
 *     the study is created in beforeAll and soft-deleted in afterAll, leaving
 *     no residue between runs.
 *   - The fixture study uses a unique, timestamped title to avoid slug
 *     collisions on rerun (studies.slug has a UNIQUE constraint).
 */

// Module-scoped fixture study handle, set in beforeAll and consumed by the
// first test. afterAll cleans it up regardless of test outcome. We track both
// id (used as study_id on the draft) and slug (used for the route-model-bound
// DELETE — the Study model uses slug as its route key, not id).
interface FixtureStudy {
  id: number;
  slug: string;
}
let fixtureStudy: FixtureStudy | null = null;
const FIXTURE_TITLE = `E2E Phase 3 Sharing Fixture ${Date.now()}`;

async function createFixtureStudy(
  request: APIRequestContext,
): Promise<FixtureStudy> {
  const resp = await request.post(`${BASE}/api/v1/studies`, {
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    data: {
      title: FIXTURE_TITLE,
      study_type: "characterization",
      description: "Auto-seeded fixture for phase3-sharing.spec.ts",
    },
  });
  if (!resp.ok()) {
    throw new Error(
      `Failed to seed fixture study: HTTP ${resp.status()} — ${await resp.text()}`,
    );
  }
  const body = await resp.json();
  const id = body?.data?.id;
  const slug = body?.data?.slug;
  if (!id || !slug) {
    throw new Error(
      `Fixture study response missing data.id/data.slug: ${JSON.stringify(body)}`,
    );
  }
  return { id, slug };
}

async function deleteFixtureStudy(
  request: APIRequestContext,
  study: FixtureStudy,
): Promise<void> {
  // Tolerate any error so that a partial earlier failure doesn't make
  // afterAll the headline error. The Study route uses slug for binding.
  await request
    .delete(`${BASE}/api/v1/studies/${study.slug}`, { headers: authHeaders() })
    .catch(() => {
      /* swallow */
    });
}

test.describe("Publish Library — Phase 3: visibility wiring", () => {
  test.beforeAll(async ({ request }) => {
    fixtureStudy = await createFixtureStudy(request);
  });

  test.afterAll(async ({ request }) => {
    if (fixtureStudy !== null) {
      await deleteFixtureStudy(request, fixtureStudy);
      fixtureStudy = null;
    }
  });

  test("ShareDropdown toggles visibility and library reflects the badge", async ({
    page,
    request,
  }) => {
    expect(fixtureStudy, "fixture study was not seeded").toBeTruthy();
    const studyId = (fixtureStudy as FixtureStudy).id;

    // Use a unique draft title so the library card is unambiguous among the
    // ambient drafts that may already exist on the live stack.
    const draftTitle = `Phase 3 Test Manuscript ${Date.now()}`;

    // Create a draft attached to the study via the API.
    const createResp = await request.post(`${BASE}/api/v1/publish/drafts`, {
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      data: {
        title: draftTitle,
        template: "generic-ohdsi",
        study_id: studyId,
        document_json: {
          version: 1,
          title: draftTitle,
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
    expect(draft.study_id).toBe(studyId);

    const draftId = draft.id;

    // Helper: read server-side visibility for the seeded draft.
    const readServerVisibility = async (): Promise<string | null> => {
      const verifyResp = await request.get(
        `${BASE}/api/v1/publish/drafts/${draftId}`,
        { headers: authHeaders() },
      );
      if (!verifyResp.ok()) return null;
      return (await verifyResp.json()).data.visibility ?? null;
    };

    // Helper: locate the draft card root. DraftCard renders the title inside an
    // <a aria-label="Open draft {title}"> element, and the VisibilityBadge is a
    // sibling further down the card. Anchor to the card via :has() on the
    // aria-label so the badge query is scoped to THIS card and not any other
    // draft on the page.
    const draftCard = () =>
      page
        .locator(`div:has(> a[aria-label="Open draft ${draftTitle}"])`)
        .first()
        .locator("xpath=..");

    try {
      // ── Load the draft in the wizard ──────────────────────────────
      await page.goto(`${BASE}/publish/library/${draftId}`);
      await dismissModals(page);

      // ShareDropdown should be visible (only renders when draftId !== null && isOwner).
      const dropdown = page.getByLabel("Visibility", { exact: true });
      await expect(dropdown).toBeVisible({ timeout: 10_000 });
      await expect(dropdown).toHaveValue("private");

      // ── private → study via UI ────────────────────────────────────
      await dropdown.selectOption("study");

      // The mutation fires via the autosave hook; give the debounce + roundtrip
      // time to persist server-side before checking the badge in the library.
      await expect
        .poll(readServerVisibility, {
          timeout: 10_000,
          intervals: [500, 1000, 1500, 2000],
        })
        .toBe("study");

      // ── Library shows "Study" badge on this draft's card ─────────
      await page.goto(`${BASE}/publish/library`);
      await dismissModals(page);

      await expect(draftCard()).toBeVisible({ timeout: 10_000 });
      // The VisibilityBadge renders the literal text "Study" for visibility=study.
      // Scope the check to within our specific draft card so it can't pass by
      // matching some other draft on the page.
      await expect(
        draftCard().getByText("Study", { exact: true }),
      ).toBeVisible({ timeout: 5_000 });

      // ── study → private via UI ────────────────────────────────────
      await page.goto(`${BASE}/publish/library/${draftId}`);
      await dismissModals(page);

      const dropdownAfter = page.getByLabel("Visibility", { exact: true });
      await expect(dropdownAfter).toBeVisible({ timeout: 10_000 });
      await expect(dropdownAfter).toHaveValue("study");

      await dropdownAfter.selectOption("private");

      await expect
        .poll(readServerVisibility, {
          timeout: 10_000,
          intervals: [500, 1000, 1500, 2000],
        })
        .toBe("private");

      // ── Library badge reflects the revert ────────────────────────
      await page.goto(`${BASE}/publish/library`);
      await dismissModals(page);

      await expect(draftCard()).toBeVisible({ timeout: 10_000 });
      await expect(
        draftCard().getByText("Private", { exact: true }),
      ).toBeVisible({ timeout: 5_000 });
    } finally {
      // Cleanup: delete the draft. Tolerate 404 in case earlier assertions
      // already triggered a server-side removal.
      await request
        .delete(`${BASE}/api/v1/publish/drafts/${draftId}`, {
          headers: authHeaders(),
        })
        .catch(() => {
          /* swallow */
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
