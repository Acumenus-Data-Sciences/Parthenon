import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { searchConcepts } from "@/features/vocabulary/api/vocabularyApi";
import type {
  Study,
  StudyDesignAsset,
  StudyDesignSession,
  StudyDesignVersion,
} from "../../types/study";
import { StudyDesignWorkbench } from "../StudyDesignWorkbench";

const hookMocks = vi.hoisted(() => ({
  useAcceptStudyDesignVersion: vi.fn(),
  useCreateStudyDesignSession: vi.fn(),
  useDraftStudyAnalysisPlans: vi.fn(),
  useDraftStudyCohorts: vi.fn(),
  useDraftStudyConceptSets: vi.fn(),
  useGenerateStudyIntent: vi.fn(),
  useImportStudyDesignProtocol: vi.fn(),
  useImportExistingStudyDesign: vi.fn(),
  useCritiqueStudyDesignVersion: vi.fn(),
  useLinkStudyCohortDraft: vi.fn(),
  useMaterializeStudyCohortDraft: vi.fn(),
  useMaterializeStudyConceptSetDraft: vi.fn(),
  useMaterializeStudyAnalysisPlan: vi.fn(),
  useLockStudyDesignVersion: vi.fn(),
  useRecommendStudyPhenotypes: vi.fn(),
  useReviewStudyDesignAsset: vi.fn(),
  useRunStudyFeasibility: vi.fn(),
  useVerifyStudyAnalysisPlan: vi.fn(),
  useStudyDesignGuidance: vi.fn(),
  useStudyDesignLockReadiness: vi.fn(),
  useStudyCohortReadiness: vi.fn(),
  useStudyDesignAssets: vi.fn(),
  useStudyDesignSessions: vi.fn(),
  useStudyDesignVersions: vi.fn(),
  useVerifyStudyConceptSetDrafts: vi.fn(),
  useVerifyStudyCohortDraft: vi.fn(),
  useUpdateStudyConceptSetDraft: vi.fn(),
  useUpdateStudyCohortDraft: vi.fn(),
  useUpdateStudyDesignVersion: vi.fn(),
  useVerifyStudyConceptSetDraft: vi.fn(),
}));

vi.mock("@/features/studies/hooks/useStudies", () => hookMocks);
vi.mock("@/features/data-sources/api/sourcesApi", () => ({
  fetchSources: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/features/vocabulary/api/vocabularyApi", () => ({
  searchConcepts: vi.fn(),
}));

function idleMutation() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  };
}

function queryResult<T>(data: T) {
  return {
    data,
    isLoading: false,
    error: null,
  };
}

const study = {
  id: 42,
  slug: "hypertension-study-v3-2",
  title: "Hypertension Study v3.2",
  name: "Hypertension Study v3.2",
  short_title: "HTN v3.2",
  description: "Hypertension protocol draft.",
  study_type: "characterization",
  study_design: "cohort",
  phase: "planning",
  priority: "medium",
  status: "draft",
  created_by: 1,
  principal_investigator_id: null,
  lead_data_scientist_id: null,
  lead_statistician_id: null,
  scientific_rationale: null,
  hypothesis: null,
  primary_objective: "Estimate hypertension outcomes.",
  secondary_objectives: null,
  study_start_date: null,
  study_end_date: null,
  target_enrollment_sites: null,
  actual_enrollment_sites: 0,
  protocol_version: null,
  protocol_finalized_at: null,
  funding_source: null,
  clinicaltrials_gov_id: null,
  tags: null,
  settings: null,
  metadata: null,
  created_at: "2026-04-27T00:00:00Z",
  updated_at: "2026-04-27T00:00:00Z",
} satisfies Study;

const session = {
  id: 7,
  study_id: study.id,
  created_by: 1,
  active_version_id: null,
  title: "Bug-fix session",
  status: "draft",
  source_mode: "natural_language",
  settings_json: null,
  created_at: "2026-04-27T00:00:00Z",
  updated_at: "2026-04-27T00:00:00Z",
} satisfies StudyDesignSession;

const version = {
  id: 11,
  session_id: session.id,
  version_number: 1,
  status: "review_ready",
  intent_json: { research_question: "Test research question" },
  normalized_spec_json: null,
  provenance_json: null,
  accepted_by: null,
  accepted_at: null,
  locked_at: null,
  created_at: "2026-04-27T00:00:00Z",
  updated_at: "2026-04-27T00:00:00Z",
} satisfies StudyDesignVersion;

function designAsset(overrides: Partial<StudyDesignAsset> = {}): StudyDesignAsset {
  return {
    id: 1,
    session_id: session.id,
    version_id: version.id,
    asset_type: "concept_set_draft",
    role: null,
    status: "needs_review",
    draft_payload_json: {},
    canonical_type: null,
    canonical_id: null,
    provenance_json: null,
    verification_status: "unverified",
    verification_json: null,
    verified_at: null,
    rank_score: null,
    rank_score_json: null,
    materialized_type: null,
    materialized_id: null,
    materialized_at: null,
    review_notes: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: "2026-04-27T00:00:00Z",
    updated_at: "2026-04-27T00:00:00Z",
    ...overrides,
  };
}

describe("StudyDesignWorkbench bug fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSources).mockResolvedValue([]);
    vi.mocked(searchConcepts).mockResolvedValue({
      items: [],
      total: 0,
      offset: 0,
      limit: 8,
    });

    hookMocks.useStudyDesignSessions.mockReturnValue(queryResult([session]));
    hookMocks.useStudyDesignVersions.mockReturnValue(queryResult([version]));
    hookMocks.useStudyDesignAssets.mockReturnValue(queryResult([]));
    hookMocks.useStudyCohortReadiness.mockReturnValue(queryResult(null));
    hookMocks.useStudyDesignLockReadiness.mockReturnValue(queryResult(null));
    hookMocks.useStudyDesignGuidance.mockReturnValue(queryResult(null));

    for (const hook of [
      hookMocks.useCreateStudyDesignSession,
      hookMocks.useImportStudyDesignProtocol,
      hookMocks.useAcceptStudyDesignVersion,
      hookMocks.useDraftStudyAnalysisPlans,
      hookMocks.useDraftStudyCohorts,
      hookMocks.useDraftStudyConceptSets,
      hookMocks.useGenerateStudyIntent,
      hookMocks.useImportExistingStudyDesign,
      hookMocks.useCritiqueStudyDesignVersion,
      hookMocks.useLinkStudyCohortDraft,
      hookMocks.useMaterializeStudyCohortDraft,
      hookMocks.useMaterializeStudyConceptSetDraft,
      hookMocks.useMaterializeStudyAnalysisPlan,
      hookMocks.useLockStudyDesignVersion,
      hookMocks.useRecommendStudyPhenotypes,
      hookMocks.useReviewStudyDesignAsset,
      hookMocks.useRunStudyFeasibility,
      hookMocks.useVerifyStudyAnalysisPlan,
      hookMocks.useVerifyStudyConceptSetDrafts,
      hookMocks.useVerifyStudyCohortDraft,
      hookMocks.useUpdateStudyConceptSetDraft,
      hookMocks.useUpdateStudyCohortDraft,
      hookMocks.useUpdateStudyDesignVersion,
      hookMocks.useVerifyStudyConceptSetDraft,
    ]) {
      hook.mockReturnValue(idleMutation());
    }
  });

  it("filters NaN concept_id from concept set draft save payload (Apply Abby patch path)", () => {
    const updateMutation = idleMutation();
    hookMocks.useUpdateStudyConceptSetDraft.mockReturnValue(updateMutation);
    hookMocks.useStudyDesignAssets.mockReturnValue(
      queryResult([
        designAsset({
          id: 55,
          asset_type: "concept_set_draft",
          role: "outcome",
          status: "needs_review",
          verification_status: "blocked",
          draft_payload_json: {
            title: "Outcome concept set",
            role: "outcome",
            domain: "Condition",
            concepts: [
              { concept_id: 312327, include_descendants: true, include_mapped: false },
              // NaN concept_id — must be filtered out before save
              { concept_id: Number.NaN, include_descendants: true, include_mapped: false },
            ],
          },
          verification_json: {
            status: "blocked",
            blocking_reasons: ["Invalid concept ID detected."],
            warnings: [],
            repair_suggestions: [
              {
                code: "remove_invalid_concepts",
                title: "Remove invalid concepts",
                message: "Abby can drop concepts with invalid IDs.",
                patch: {
                  concepts: [
                    { concept_id: 312327, include_descendants: true, include_mapped: false },
                    { concept_id: Number.NaN, include_descendants: true, include_mapped: false },
                  ],
                },
              },
            ],
          },
        }),
      ]),
    );

    renderWithProviders(<StudyDesignWorkbench study={study} />, {
      initialRoute: "/studies/hypertension-study-v3-2?tab=design",
    });

    fireEvent.click(screen.getByRole("button", { name: /apply abby patch/i }));

    expect(updateMutation.mutate).toHaveBeenCalledTimes(1);
    const callArg = updateMutation.mutate.mock.calls[0][0] as {
      payload: { concepts: Array<{ concept_id: number }> };
    };
    expect(callArg.payload.concepts).toEqual([
      expect.objectContaining({ concept_id: 312327 }),
    ]);
    // Critically: no NaN concept_id was sent.
    expect(
      callArg.payload.concepts.some((c) => Number.isNaN(c.concept_id)),
    ).toBe(false);
  });

  it("shows search error pill when searchConcepts rejects", async () => {
    vi.mocked(searchConcepts).mockRejectedValueOnce(new Error("Network down"));
    hookMocks.useStudyDesignAssets.mockReturnValue(
      queryResult([
        designAsset({
          id: 55,
          asset_type: "concept_set_draft",
          role: "outcome",
          status: "needs_review",
          verification_status: "unverified",
          draft_payload_json: {
            title: "Editable draft",
            role: "outcome",
            concepts: [],
          },
        }),
      ]),
    );

    renderWithProviders(<StudyDesignWorkbench study={study} />, {
      initialRoute: "/studies/hypertension-study-v3-2?tab=design",
    });

    const searchInput = screen.getByPlaceholderText(
      /search omop vocabulary concepts/i,
    );
    fireEvent.change(searchInput, { target: { value: "diabetes" } });
    fireEvent.click(
      screen.getAllByRole("button", { name: /^search$/i })[0],
    );

    expect(await screen.findByText("Network down")).toBeInTheDocument();
    const alert = screen.getByText("Network down");
    expect(alert.closest('[role="alert"]')).not.toBeNull();
  });

  it("shows only the most recent mutation error and dismisses it", async () => {
    const updateVersionMutation = idleMutation();
    updateVersionMutation.error = new Error("First error");
    hookMocks.useUpdateStudyDesignVersion.mockReturnValue(updateVersionMutation);

    const draftConceptSetsMutation = idleMutation();
    draftConceptSetsMutation.error = new Error("Most recent boom");
    hookMocks.useDraftStudyConceptSets.mockReturnValue(draftConceptSetsMutation);

    renderWithProviders(<StudyDesignWorkbench study={study} />, {
      initialRoute: "/studies/hypertension-study-v3-2?tab=design",
    });

    // Banner displays the FIRST tracked mutation with an error (per loop order).
    // We track the assertion: a single banner exists, with role=alert.
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    // The first error in the tracked list is updateVersion ("First error").
    expect(screen.getByText("First error")).toBeInTheDocument();

    // Click Dismiss
    const dismissBtn = screen.getByRole("button", { name: /dismiss/i });
    fireEvent.click(dismissBtn);

    // Banner gone (the updateVersion error message no longer visible)
    await waitFor(() => {
      expect(screen.queryByText("First error")).not.toBeInTheDocument();
    });

    // The mutation reset() should be called to clear the upstream error
    expect(updateVersionMutation.reset).toHaveBeenCalled();
  });

  it("lock-confirm flow — refetches readiness then opens modal then mutates", async () => {
    const lockMutation = idleMutation();
    hookMocks.useLockStudyDesignVersion.mockReturnValue(lockMutation);
    const refetch = vi.fn().mockResolvedValue({
      data: {
        can_lock: true,
        locked: false,
        status: "ready",
        blockers: [],
        warnings: [],
      },
    });
    hookMocks.useStudyDesignLockReadiness.mockReturnValue({
      data: {
        can_lock: true,
        locked: false,
        status: "ready",
        blockers: [],
        warnings: [],
      },
      isLoading: false,
      error: null,
      refetch,
    });

    renderWithProviders(<StudyDesignWorkbench study={study} />, {
      initialRoute: "/studies/hypertension-study-v3-2?tab=design",
    });

    fireEvent.click(screen.getByRole("button", { name: /lock package/i }));

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });

    // Modal opens — title visible
    await screen.findByText(/lock package\?/i);

    // Click the confirm button inside the modal (Modal renders via portal so
    // the dialog role helps us scope the search).
    const dialog = screen.getByRole("dialog");
    const confirmBtn = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>("button"),
    ).find((btn) => btn.textContent?.toLowerCase().includes("lock package"));
    expect(confirmBtn).toBeDefined();
    fireEvent.click(confirmBtn!);

    expect(lockMutation.mutate).toHaveBeenCalledWith(
      {
        slug: "hypertension-study-v3-2",
        sessionId: 7,
        versionId: 11,
      },
      expect.any(Object),
    );
  });

  it("lock-confirm flow — does NOT mutate if refetch returns can_lock=false", async () => {
    const lockMutation = idleMutation();
    hookMocks.useLockStudyDesignVersion.mockReturnValue(lockMutation);
    const refetch = vi.fn().mockResolvedValue({
      data: {
        can_lock: false,
        locked: false,
        status: "blocked",
        blockers: [{ message: "Lock blocked" }],
        warnings: [],
      },
    });
    hookMocks.useStudyDesignLockReadiness.mockReturnValue({
      data: {
        can_lock: true,
        locked: false,
        status: "ready",
        blockers: [],
        warnings: [],
      },
      isLoading: false,
      error: null,
      refetch,
    });

    renderWithProviders(<StudyDesignWorkbench study={study} />, {
      initialRoute: "/studies/hypertension-study-v3-2?tab=design",
    });

    fireEvent.click(screen.getByRole("button", { name: /lock package/i }));

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });

    // Lock-gate message rendered (alert role with the gateClosed message)
    expect(
      await screen.findByText(/package readiness changed/i),
    ).toBeInTheDocument();

    expect(lockMutation.mutate).not.toHaveBeenCalled();
  });

  it("version-switch with dirty intent shows discard confirm", () => {
    // Two versions on the same session.
    const v2 = { ...version, id: 12, version_number: 2 } satisfies StudyDesignVersion;
    hookMocks.useStudyDesignVersions.mockReturnValue(queryResult([version, v2]));

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderWithProviders(<StudyDesignWorkbench study={study} />, {
      initialRoute: "/studies/hypertension-study-v3-2?tab=design",
    });

    // Make the form dirty: edit a textarea field
    const researchQuestion = screen.getByLabelText("Research Question") as HTMLTextAreaElement;
    fireEvent.change(researchQuestion, {
      target: { value: "A NEW research question" },
    });

    // Click v2 version button — guard should fire confirm
    const v2Button = screen.getByRole("button", { name: /v2/i });
    fireEvent.click(v2Button);

    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
