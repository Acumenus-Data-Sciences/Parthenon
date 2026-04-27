import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import type { Source } from "@/types/models";
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
  searchConcepts: vi.fn().mockResolvedValue({ data: [] }),
}));

function idleMutation() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  };
}

function queryResult<T>(data: T) {
  return {
    data,
    isLoading: false,
    error: null,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
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
  title: "Protocol upload",
  status: "draft",
  source_mode: "protocol_upload",
  settings_json: null,
  created_at: "2026-04-27T00:00:00Z",
  updated_at: "2026-04-27T00:00:00Z",
} satisfies StudyDesignSession;

const importedVersion = {
  id: 11,
  session_id: session.id,
  version_number: 1,
  status: "review_ready",
  intent_json: {
    research_question: "What is the comparative risk of hypertension outcomes?",
    evidence_spans: [
      {
        field: "population",
        quote: "Adults with hypertension and continuous observation",
        section: "Eligibility",
        confidence: 0.92,
      },
    ],
    confidence: {
      overall: 0.87,
      population: 0.92,
    },
  },
  normalized_spec_json: null,
  provenance_json: {
    source: "protocol_upload_abby",
  },
  accepted_by: null,
  accepted_at: null,
  locked_at: null,
  created_at: "2026-04-27T00:00:00Z",
  updated_at: "2026-04-27T00:00:00Z",
} satisfies StudyDesignVersion;

const versionMissingPopulation = {
  ...importedVersion,
  id: 12,
  normalized_spec_json: {
    study: {
      research_question: "Among adults with hypertension, does ACE inhibitor initiation reduce stroke risk?",
      primary_objective: "Estimate stroke risk after ACE inhibitor initiation.",
    },
    pico: {
      population: { summary: "" },
      intervention_or_exposure: { summary: "New ACE inhibitor initiation as the index event." },
      comparator: { summary: "New thiazide diuretic initiation in otherwise eligible patients." },
      outcomes: [{ summary: "Incident ischemic stroke hospitalization.", primary: true }],
      time: { summary: "Index date through 365 days of follow-up, end of observation, death, or study end." },
    },
  },
} satisfies StudyDesignVersion;

describe("StudyDesignWorkbench protocol import", () => {
  let createSessionMutation: ReturnType<typeof idleMutation>;
  let importProtocolMutation: ReturnType<typeof idleMutation>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSources).mockReset();
    vi.mocked(fetchSources).mockResolvedValue([]);

    createSessionMutation = idleMutation();
    importProtocolMutation = idleMutation();
    importProtocolMutation.mutateAsync.mockResolvedValue({
      version: importedVersion,
      extracted: {},
      metadata: {},
    });

    hookMocks.useStudyDesignSessions.mockReturnValue(queryResult([session]));
    hookMocks.useStudyDesignVersions.mockReturnValue(queryResult([importedVersion]));
    hookMocks.useStudyDesignAssets.mockReturnValue(queryResult([]));
    hookMocks.useStudyCohortReadiness.mockReturnValue(queryResult(null));
    hookMocks.useStudyDesignLockReadiness.mockReturnValue(queryResult(null));
    hookMocks.useStudyDesignGuidance.mockReturnValue(queryResult(null));

    hookMocks.useCreateStudyDesignSession.mockReturnValue(createSessionMutation);
    hookMocks.useImportStudyDesignProtocol.mockReturnValue(importProtocolMutation);

    for (const hook of [
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

  it("uploads into the active design session without leaving the study design tab", async () => {
    renderWithProviders(
      <>
        <StudyDesignWorkbench study={study} />
        <LocationProbe />
      </>,
      { initialRoute: "/studies/hypertension-study-v3-2?tab=design" },
    );
    const file = new File(["# Protocol"], "hypertension-protocol.md", {
      type: "text/markdown",
    });
    const input = screen.getByLabelText("Upload protocol file");

    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByRole("button", { name: /upload protocol/i })).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(importProtocolMutation.mutateAsync).toHaveBeenCalledWith({
        slug: "hypertension-study-v3-2",
        sessionId: 7,
        file,
      });
    });

    expect(createSessionMutation.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Abby guidance" })).toBeInTheDocument();
    expect(screen.getByText("Abby guidance")).toBeInTheDocument();
    expect(screen.getByText("Abby Review")).toBeInTheDocument();
    expect(screen.getByText("Evidence and confidence")).toBeInTheDocument();
    expect(screen.getByText("Overall 87%")).toBeInTheDocument();
    expect(screen.getByText("Adults with hypertension and continuous observation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accept intent/i })).not.toBeDisabled();
    expect(screen.getByText("Accept at least one verified phenotype, cohort, or concept set recommendation first.")).toBeInTheDocument();
    expect(screen.getByText("Materialize at least one verified concept set draft first.")).toBeInTheDocument();
    expect(screen.getByText("Cohort readiness must be available before feasibility.")).toBeInTheDocument();
    expect(screen.getByText("Run source feasibility before drafting analysis plans.")).toBeInTheDocument();
    expect(screen.getByText("Resolve package checklist blockers before locking.")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/studies/hypertension-study-v3-2?tab=design",
    );
  });

  it("applies Abby intent wording suggestions inside the current review form", () => {
    hookMocks.useStudyDesignVersions.mockReturnValue(queryResult([versionMissingPopulation]));

    renderWithProviders(
      <StudyDesignWorkbench study={study} />,
      { initialRoute: "/studies/hypertension-study-v3-2?tab=design" },
    );

    const population = screen.getByLabelText("Population");

    expect(population).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: /use wording/i }));

    expect(population).toHaveValue(
      "Patients meeting the protocol-defined eligibility criteria with sufficient prior observation in the OMOP CDM source.",
    );
  });

  it("renders grouped Abby compatibility tasks for imported bottom-up assets", () => {
    hookMocks.useStudyDesignAssets.mockReturnValue(queryResult([
      designAsset({
        id: 30,
        asset_type: "imported_study_cohort",
        role: "target",
        status: "accepted",
        materialized_id: 81,
        canonical_id: 81,
        draft_payload_json: {
          label: "Target cohort",
          cohort_definition_name: "ACE inhibitor initiators",
        },
      }),
      designAsset({
        id: 31,
        asset_type: "design_critique",
        status: "needs_review",
        draft_payload_json: {
          code: "missing_feasibility_evidence",
          severity: "blocking",
          message: "Run source-aware feasibility before analysis planning or lock.",
          meta: {},
          policy: "Bottom-up critique creates reviewable design findings without changing existing cohorts, analyses, or study metadata.",
        },
      }),
    ]));

    renderWithProviders(
      <StudyDesignWorkbench study={study} />,
      { initialRoute: "/studies/hypertension-study-v3-2?tab=design" },
    );

    expect(screen.getByText("Abby compatibility tasks")).toBeInTheDocument();
    expect(screen.getByText(/do not modify existing cohorts/i)).toBeInTheDocument();
    expect(screen.getAllByText("Cohorts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Feasibility").length).toBeGreaterThan(0);
    expect(screen.getByText("Run feasibility")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Native cohort #81" })).toHaveAttribute(
      "href",
      "/cohort-definitions/81",
    );
  });

  it("shows detailed Abby initial gate failures from inadequate protocol uploads", () => {
    hookMocks.useImportStudyDesignProtocol.mockReturnValue({
      ...idleMutation(),
      error: {
        response: {
          data: {
            message: "Protocol upload did not pass Abby initial Study Design gates.",
            issues: [
              { field: "exposure", message: "The protocol does not identify the treatment or index event." },
              { field: "time_at_risk", message: "Time at risk must include an index anchor plus follow-up end or censoring logic." },
            ],
          },
        },
      },
    });

    renderWithProviders(
      <StudyDesignWorkbench study={study} />,
      { initialRoute: "/studies/hypertension-study-v3-2?tab=design" },
    );

    expect(screen.getByText(/Protocol upload did not pass Abby initial Study Design gates/i)).toBeInTheDocument();
    expect(screen.getByText(/does not identify the treatment or index event/i)).toBeInTheDocument();
    expect(screen.getByText(/Time at risk must include an index anchor/i)).toBeInTheDocument();
  });

  it("sends recommendation review notes with accept decisions", () => {
    const reviewMutation = idleMutation();
    hookMocks.useReviewStudyDesignAsset.mockReturnValue(reviewMutation);
    hookMocks.useStudyDesignAssets.mockReturnValue(queryResult([
      designAsset({
        id: 44,
        asset_type: "phenotype_recommendation",
        role: "population",
        status: "needs_review",
        verification_status: "verified",
        rank_score: 94,
        draft_payload_json: {
          title: "Diabetes treatment phenotype",
          description: "Reusable phenotype for adults with diabetes.",
          rationale: "Matched local Phenotype Library metadata.",
          score: 0.91,
          has_expression: true,
        },
        verification_json: {
          status: "verified",
          blocking_reasons: [],
          warnings: [],
          eligibility: {
            can_accept: true,
          },
          accepted_downstream_actions: ["accept_recommendation", "draft_concept_sets"],
        },
      }),
    ]));

    renderWithProviders(
      <StudyDesignWorkbench study={study} />,
      { initialRoute: "/studies/hypertension-study-v3-2?tab=design" },
    );

    fireEvent.change(screen.getByLabelText("Recommendation review note"), {
      target: { value: "Use this as the population reuse anchor." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(reviewMutation.mutate).toHaveBeenCalledWith({
      slug: "hypertension-study-v3-2",
      sessionId: 7,
      assetId: 44,
      decision: "accept",
      reviewNotes: "Use this as the population reuse anchor.",
    });
  });

  it("batch verifies concept drafts and applies Abby repair patches only to the draft payload", () => {
    const verifyAllMutation = idleMutation();
    const updateMutation = idleMutation();
    hookMocks.useVerifyStudyConceptSetDrafts.mockReturnValue(verifyAllMutation);
    hookMocks.useUpdateStudyConceptSetDraft.mockReturnValue(updateMutation);
    hookMocks.useStudyDesignAssets.mockReturnValue(queryResult([
      designAsset({
        id: 55,
        asset_type: "concept_set_draft",
        role: "outcome",
        status: "needs_review",
        verification_status: "blocked",
        draft_payload_json: {
          title: "Stroke outcome concept set",
          role: "outcome",
          domain: "Condition",
          clinical_rationale: "Outcome concepts from protocol evidence.",
          search_terms: ["ischemic stroke"],
          concepts: [
            { concept_id: 312327, include_descendants: true, include_mapped: false },
            { concept_id: 999999999, include_descendants: true, include_mapped: false },
          ],
        },
        verification_json: {
          status: "blocked",
          blocking_reasons: ["Remove or replace concept IDs missing from vocab.concept: 999999999."],
          warnings: [],
          concepts: [
            { concept_id: 312327, include_descendants: true, include_mapped: false },
            { concept_id: 999999999, include_descendants: true, include_mapped: false },
          ],
          repair_suggestions: [{
            code: "remove_unverified_concepts",
            title: "Remove concepts that failed initial vocabulary checks",
            message: "Abby can remove missing concepts from this draft.",
            patch: {
              concepts: [
                { concept_id: 312327, include_descendants: true, include_mapped: false },
              ],
            },
          }],
        },
      }),
    ]));

    renderWithProviders(
      <StudyDesignWorkbench study={study} />,
      { initialRoute: "/studies/hypertension-study-v3-2?tab=design" },
    );

    fireEvent.click(screen.getByRole("button", { name: /verify all/i }));

    expect(verifyAllMutation.mutate).toHaveBeenCalledWith({
      slug: "hypertension-study-v3-2",
      sessionId: 7,
      versionId: 11,
    });

    fireEvent.click(screen.getByRole("button", { name: /apply abby patch/i }));

    expect(updateMutation.mutate).toHaveBeenCalledWith({
      slug: "hypertension-study-v3-2",
      sessionId: 7,
      assetId: 55,
      payload: expect.objectContaining({
        title: "Stroke outcome concept set",
        concepts: [{
          concept_id: 312327,
          is_excluded: false,
          include_descendants: true,
          include_mapped: false,
          rationale: null,
        }],
      }),
    });
  });

  it("applies Abby cohort repair patches only to the cohort draft payload", () => {
    const updateMutation = idleMutation();
    hookMocks.useUpdateStudyCohortDraft.mockReturnValue(updateMutation);
    hookMocks.useStudyDesignAssets.mockReturnValue(queryResult([
      designAsset({
        id: 66,
        asset_type: "cohort_draft",
        role: "target",
        status: "needs_review",
        verification_status: "blocked",
        draft_payload_json: {
          title: "Target hypertension cohort",
          role: "target",
          logic_description: "Draft missing primary criteria.",
          concept_set_ids: [12],
          concept_set_asset_ids: [55],
          source_asset_ids: [55],
          expression_json: {
            ConceptSets: [{
              id: 0,
              name: "Hypertension concept set",
              expression: { items: [] },
            }],
            PrimaryCriteria: {
              CriteriaList: [],
            },
          },
        },
        verification_json: {
          status: "blocked",
          blocking_reasons: ["The cohort expression must include a non-empty PrimaryCriteria CriteriaList."],
          warnings: [],
          repair_suggestions: [{
            code: "add_primary_criteria",
            title: "Add first-event primary criteria",
            message: "Abby can add a conservative first qualifying event criterion.",
            patch: {
              expression_json: {
                ConceptSets: [{
                  id: 0,
                  name: "Hypertension concept set",
                  expression: { items: [] },
                }],
                PrimaryCriteria: {
                  CriteriaList: [{
                    ConditionOccurrence: {
                      First: true,
                      CodesetId: 0,
                    },
                  }],
                  ObservationWindow: {
                    PriorDays: 365,
                    PostDays: 0,
                  },
                  PrimaryCriteriaLimit: {
                    Type: "First",
                  },
                },
                QualifiedLimit: { Type: "First" },
                ExpressionLimit: { Type: "First" },
                InclusionRules: [],
                CensoringCriteria: [],
                CollapseSettings: { CollapseType: "ERA", EraPad: 0 },
              },
            },
          }],
        },
      }),
    ]));

    renderWithProviders(
      <StudyDesignWorkbench study={study} />,
      { initialRoute: "/studies/hypertension-study-v3-2?tab=design" },
    );

    fireEvent.click(screen.getByRole("button", { name: /apply abby cohort patch/i }));

    expect(updateMutation.mutate).toHaveBeenCalledWith({
      slug: "hypertension-study-v3-2",
      sessionId: 7,
      assetId: 66,
      payload: expect.objectContaining({
        title: "Target hypertension cohort",
        role: "target",
        expression_json: expect.objectContaining({
          PrimaryCriteria: expect.objectContaining({
            CriteriaList: [{
              ConditionOccurrence: {
                First: true,
                CodesetId: 0,
              },
            }],
          }),
        }),
      }),
    });
  });

  it("turns cohort readiness blockers into direct link actions", () => {
    const linkMutation = idleMutation();
    hookMocks.useLinkStudyCohortDraft.mockReturnValue(linkMutation);
    hookMocks.useStudyDesignAssets.mockReturnValue(queryResult([
      designAsset({
        id: 77,
        asset_type: "cohort_draft",
        role: "target",
        status: "materialized",
        verification_status: "verified",
        materialized_id: 177,
        materialized_type: "App\\Models\\App\\CohortDefinition",
        draft_payload_json: {
          title: "Target hypertension cohort",
          role: "target",
          concept_set_ids: [12],
          expression_json: { PrimaryCriteria: { CriteriaList: [{ ConditionOccurrence: { CodesetId: 0 } }] } },
        },
        provenance_json: {},
      }),
    ]));
    hookMocks.useStudyCohortReadiness.mockReturnValue(queryResult({
      ready: false,
      status: "blocked",
      ready_for_feasibility: false,
      cohort_asset_count: 1,
      materialized_verified_count: 1,
      blocked_count: 0,
      required_roles: ["target"],
      present_roles: { target: 0 },
      missing_roles: ["target"],
      drafts: { total: 1, materialized: 1, linked: 0, unlinked_materialized: 1 },
      blockers: [{
        code: "missing_target_cohort",
        message: "Add a target cohort before running feasibility or analysis.",
        action: {
          type: "link_materialized_cohort",
          role: "target",
          asset_id: 77,
          asset_ids: [77],
          label: "Link target cohort",
        },
      }],
      warnings: [],
      action_targets: [{
        type: "link_materialized_cohort",
        role: "target",
        asset_id: 77,
        asset_ids: [77],
        label: "Link target cohort",
      }],
    }));

    renderWithProviders(
      <StudyDesignWorkbench study={study} />,
      { initialRoute: "/studies/hypertension-study-v3-2?tab=design" },
    );

    expect(screen.getByText("Missing roles: target")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Link target cohort" }));

    expect(linkMutation.mutate).toHaveBeenCalledWith({
      slug: "hypertension-study-v3-2",
      sessionId: 7,
      assetId: 77,
      role: "target",
    });
  });

  it("lets users select an explicit study role before linking materialized cohort drafts", () => {
    const linkMutation = idleMutation();
    hookMocks.useLinkStudyCohortDraft.mockReturnValue(linkMutation);
    hookMocks.useStudyDesignAssets.mockReturnValue(queryResult([
      designAsset({
        id: 88,
        asset_type: "cohort_draft",
        role: "target",
        status: "materialized",
        verification_status: "verified",
        materialized_id: 188,
        materialized_type: "App\\Models\\App\\CohortDefinition",
        draft_payload_json: {
          title: "Reusable hypertension cohort",
          role: "target",
          concept_set_ids: [12],
          expression_json: { PrimaryCriteria: { CriteriaList: [{ ConditionOccurrence: { CodesetId: 0 } }] } },
        },
        provenance_json: {},
      }),
    ]));
    hookMocks.useStudyCohortReadiness.mockReturnValue(queryResult({
      ready: false,
      status: "blocked",
      ready_for_feasibility: false,
      cohort_asset_count: 1,
      materialized_verified_count: 1,
      blocked_count: 0,
      required_roles: ["target", "comparator"],
      present_roles: { target: 0, comparator: 0 },
      missing_roles: ["target", "comparator"],
      drafts: { total: 1, materialized: 1, linked: 0, unlinked_materialized: 1 },
      blockers: [],
      warnings: [{
        code: "unlinked_materialized_drafts",
        message: "Materialized cohort drafts are not yet linked to study roles.",
        action: {
          type: "link_materialized_cohort",
          asset_ids: [88],
          label: "Link materialized cohort drafts",
        },
      }],
      action_targets: [],
    }));

    renderWithProviders(
      <StudyDesignWorkbench study={study} />,
      { initialRoute: "/studies/hypertension-study-v3-2?tab=design" },
    );

    fireEvent.change(screen.getByLabelText(/Cohort role for Reusable hypertension cohort/i), {
      target: { value: "comparator" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Link to Study" }));

    expect(linkMutation.mutate).toHaveBeenCalledWith({
      slug: "hypertension-study-v3-2",
      sessionId: 7,
      assetId: 88,
      role: "comparator",
    });
  });

  it("blocks feasibility runs until cohort readiness is satisfied", () => {
    const runMutation = idleMutation();
    hookMocks.useRunStudyFeasibility.mockReturnValue(runMutation);
    hookMocks.useStudyCohortReadiness.mockReturnValue(queryResult({
      ready: false,
      status: "blocked",
      ready_for_feasibility: false,
      cohort_asset_count: 1,
      materialized_verified_count: 1,
      blocked_count: 0,
      required_roles: ["target"],
      present_roles: { target: 0 },
      missing_roles: ["target"],
      blockers: [{
        code: "missing_target_cohort",
        message: "Add a target cohort before running feasibility or analysis.",
      }],
      warnings: [],
    }));

    renderWithProviders(
      <StudyDesignWorkbench study={study} />,
      { initialRoute: "/studies/hypertension-study-v3-2?tab=design" },
    );

    expect(screen.getByRole("button", { name: "Run Feasibility" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run Feasibility" })).toHaveAttribute(
      "title",
      "Link required study cohorts before source feasibility.",
    );
    expect(screen.getByText("Link required study cohorts before source feasibility.")).toBeInTheDocument();
    expect(runMutation.mutate).not.toHaveBeenCalled();
  });

  it("selects source presets, preserves thresholds, and explains feasibility blockers", async () => {
    const runMutation = idleMutation();
    hookMocks.useRunStudyFeasibility.mockReturnValue(runMutation);
    vi.mocked(fetchSources).mockResolvedValueOnce([
      studySource({
        id: 101,
        source_name: "Eunomia default",
        is_default: true,
        daimons: [
          { id: 1, source_id: 101, daimon_type: "cdm", table_qualifier: "cdm", priority: 1 },
          { id: 2, source_id: 101, daimon_type: "results", table_qualifier: "results", priority: 1 },
        ],
      }),
      studySource({
        id: 102,
        source_name: "Vocabulary only source",
        is_default: false,
        daimons: [
          { id: 3, source_id: 102, daimon_type: "cdm", table_qualifier: "cdm", priority: 1 },
        ],
      }),
    ]);
    hookMocks.useStudyCohortReadiness.mockReturnValue(queryResult({
      ready: true,
      status: "ready",
      ready_for_feasibility: true,
      cohort_asset_count: 1,
      materialized_verified_count: 1,
      blocked_count: 0,
      required_roles: ["target"],
      present_roles: { target: 1 },
      missing_roles: [],
      blockers: [],
      warnings: [],
    }));
    hookMocks.useStudyDesignAssets.mockReturnValue(queryResult([
      designAsset({
        id: 120,
        asset_type: "feasibility_result",
        status: "needs_review",
        verification_status: "blocked",
        draft_payload_json: {
          status: "blocked",
          ready_for_analysis: false,
          ready_source_count: 0,
          source_count: 1,
          min_cell_count: 11,
          ran_at: "2026-04-27T12:00:00Z",
          previous_run: {
            status: "blocked",
            ready_source_count: 0,
            source_count: 1,
            min_cell_count: 5,
            delta_ready_source_count: 0,
            delta_source_count: 0,
            threshold_changed: true,
          },
          blockers: [{
            code: "missing_cohort_generation",
            message: "Generate this cohort on the selected source before analysis planning.",
            action: {
              type: "generate_cohort_on_source",
              source_id: 101,
              label: "Generate cohort on source",
            },
          }],
          warnings: [],
          sources: [{
            source_id: 101,
            source_name: "Eunomia default",
            ready_for_analysis: false,
            blockers: [{
              code: "missing_cohort_generation",
              message: "Generate this cohort on the selected source before analysis planning.",
            }],
            warnings: [],
            cohorts: [{ study_cohort_id: 1, role: "target", person_count: null }],
            coverage: {
              date_coverage: { start_date: null, end_date: null },
              observation_period: { record_count: 5 },
              freshness: { status: "current" },
            },
            domain_availability: { available_role_count: 1, role_count: 1 },
            source_quality: { dqd: { pass_rate: null } },
          }],
        },
      }),
    ]));

    renderWithProviders(
      <StudyDesignWorkbench study={study} />,
      { initialRoute: "/studies/hypertension-study-v3-2?tab=design" },
    );

    await screen.findByRole("button", { name: "CDM + results" });

    expect(screen.getByText(/Previous run: 0\/1 ready/)).toBeInTheDocument();
    expect(screen.getByText(/Abby source gate: Generate the linked cohort on this CDM source/i)).toBeInTheDocument();
    expect(screen.getByText("Action target: Generate cohort on source")).toBeInTheDocument();
    expect(screen.getByLabelText("Small-cell threshold")).toHaveValue(11);

    fireEvent.click(screen.getByRole("button", { name: "CDM + results" }));
    fireEvent.change(screen.getByLabelText("Small-cell threshold"), {
      target: { value: "9" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Feasibility" }));

    expect(runMutation.mutate).toHaveBeenCalledWith({
      slug: "hypertension-study-v3-2",
      sessionId: 7,
      versionId: 11,
      sourceIds: [101],
      minCellCount: 9,
    });
  });

  it("lets users select analysis families and repair blocked HADES plans", () => {
    const draftMutation = idleMutation();
    const reviewMutation = idleMutation();
    hookMocks.useDraftStudyAnalysisPlans.mockReturnValue(draftMutation);
    hookMocks.useReviewStudyDesignAsset.mockReturnValue(reviewMutation);
    hookMocks.useStudyDesignVersions.mockReturnValue(queryResult([{
      ...importedVersion,
      normalized_spec_json: {
        study: {
          study_type: "comparative_effectiveness",
          research_question: "Does treatment reduce hypertension outcomes compared with usual care?",
          primary_objective: "Estimate comparative effectiveness.",
        },
        pico: {
          comparator: { summary: "Usual care comparator" },
          outcomes: [{ summary: "Stroke outcome", primary: true }],
        },
      },
    }]));
    hookMocks.useStudyDesignAssets.mockReturnValue(queryResult([
      designAsset({
        id: 150,
        asset_type: "feasibility_result",
        status: "accepted",
        verification_status: "verified",
        draft_payload_json: {
          status: "ready",
          ready_for_analysis: true,
          ready_source_count: 1,
          source_count: 1,
          min_cell_count: 5,
          ran_at: "2026-04-27T12:10:00Z",
          blockers: [],
          warnings: [],
          sources: [],
        },
      }),
      ...["target", "comparator", "outcome"].map((role, index) => designAsset({
        id: 160 + index,
        asset_type: "cohort_draft",
        role,
        status: "materialized",
        verification_status: "verified",
        draft_payload_json: {
          title: `${role} cohort`,
          role,
        },
      })),
      designAsset({
        id: 190,
        asset_type: "analysis_plan",
        status: "needs_review",
        verification_status: "blocked",
        draft_payload_json: {
          title: "Hypertension Study v3.2: Population-Level Estimation",
          analysis_type: "estimation",
          analysis_family: {
            id: "estimation",
            label: "Population-Level Estimation",
            hades_package: "CohortMethod",
            recommended: true,
            fit_score: 95,
            reason: "Target, comparator, and outcome roles support a comparative CohortMethod plan.",
          },
          description: "Estimate comparative effects.",
          hades_package: "CohortMethod",
          hades_capability: { installed: false, package: "CohortMethod", status: "not_installed" },
          hades_remediation: {
            package: "CohortMethod",
            message: "Install or enable CohortMethod in Darkstar, refresh the HADES package inventory, then verify this plan again.",
            action: { type: "install_hades_package", label: "Install HADES package" },
          },
          feasibility: { status: "ready", ready_source_count: 1, source_count: 1 },
          design_json: { targetCohortId: 1, comparatorCohortId: 2 },
          parameter_review: [{
            name: "target_cohort",
            label: "Target cohort",
            value: "Target analysis cohort",
            status: "pass",
            message: "Linked target cohort is available.",
          }],
          blockers: [{
            code: "missing_hades_package",
            message: "Darkstar does not report CohortMethod as installed.",
            action: { type: "install_hades_package", label: "Install HADES package" },
          }],
          warnings: [],
        },
        verification_json: {
          status: "blocked",
          blocking_reasons: ["Darkstar does not report CohortMethod as installed."],
          warnings: [],
        },
      }),
    ]));

    renderWithProviders(
      <StudyDesignWorkbench study={study} />,
      { initialRoute: "/studies/hypertension-study-v3-2?tab=design" },
    );

    expect(screen.getByText("Analysis family selection")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Population-Level Estimation/i })).toHaveTextContent("Recommended");

    fireEvent.click(screen.getByRole("button", { name: "Draft Selected Plans" }));
    expect(draftMutation.mutate).toHaveBeenCalledWith(expect.objectContaining({
      slug: "hypertension-study-v3-2",
      sessionId: 7,
      versionId: 11,
      payload: expect.objectContaining({
        analysis_types: expect.arrayContaining(["estimation"]),
      }),
    }));

    expect(screen.getByText(/Install or enable CohortMethod in Darkstar/i)).toBeInTheDocument();
    expect(screen.getByText("Action target: Install HADES package")).toBeInTheDocument();
    expect(screen.getByText("Target analysis cohort")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(reviewMutation.mutate).toHaveBeenCalledWith({
      slug: "hypertension-study-v3-2",
      sessionId: 7,
      assetId: 190,
      decision: "reject",
      reviewNotes: undefined,
    });

    fireEvent.click(screen.getByRole("button", { name: "Re-draft family" }));
    expect(draftMutation.mutate).toHaveBeenLastCalledWith({
      slug: "hypertension-study-v3-2",
      sessionId: 7,
      versionId: 11,
      payload: { analysis_types: ["estimation"] },
    });
  });

  it("shows package lock checklist, Abby final review, and manifest preview", () => {
    hookMocks.useStudyDesignLockReadiness.mockReturnValue(queryResult({
      ready: false,
      status: "blocked",
      can_lock: false,
      locked: false,
      blocking_reasons: [
        "Accept the design intent before locking.",
        "Ready feasibility evidence is required.",
      ],
      blockers: [
        { code: "lock_blocker_0", message: "Accept the design intent before locking." },
        { code: "lock_blocker_1", message: "Ready feasibility evidence is required." },
      ],
      warnings: [
        { code: "lock_warning_0", message: "No materialized concept set draft is recorded for this version." },
      ],
      summary: {
        accepted_recommendations: 1,
        materialized_concept_sets: 0,
        linked_cohorts: 1,
        feasibility_status: null,
        materialized_analysis_plans: 1,
        package_assets: 0,
      },
      checklist: [
        {
          id: "intent",
          label: "Intent",
          status: "blocked",
          message: "Accept the intent before package lock.",
          blockers: [{ message: "Accept the design intent before locking." }],
          warnings: [],
        },
        {
          id: "feasibility",
          label: "Feasibility",
          status: "blocked",
          message: "Run source feasibility before lock.",
          blockers: [{ message: "Ready feasibility evidence is required." }],
          warnings: [],
        },
      ],
      abby_final_review: {
        status: "blocked",
        summary: "Abby found lock blockers that must be resolved before package freeze.",
        recommendation: "Resolve blockers in the checklist before locking.",
        risk_notes: ["No materialized concept set draft is recorded for this version."],
      },
      manifest_preview: {
        schema_version: "study-package.v1",
        contents: {
          recommendations: 1,
          concept_sets: 0,
          cohorts: 1,
          feasibility: null,
          analysis_plans: 1,
        },
        artifact: null,
      },
      provenance_summary: {
        version_status: "review_ready",
        accepted_at: null,
        ai_events: 1,
        reviewed_assets: 2,
        verified_assets: 3,
        package_manifest_sha256: null,
      },
    }));

    renderWithProviders(
      <StudyDesignWorkbench study={study} />,
      { initialRoute: "/studies/hypertension-study-v3-2?tab=design" },
    );

    expect(screen.getByText("Abby final package review")).toBeInTheDocument();
    expect(screen.getByText("Abby found lock blockers that must be resolved before package freeze.")).toBeInTheDocument();
    expect(screen.getByText("Package manifest preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lock Package" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lock Package" })).toHaveAttribute(
      "title",
      "Accept the design intent before locking.",
    );
    expect(screen.getAllByText("Intent").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Feasibility").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Accept the design intent before locking.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ready feasibility evidence is required.").length).toBeGreaterThan(0);
  });
});

function studySource(overrides: Partial<Source> = {}): Source {
  return {
    id: 101,
    source_name: "Eunomia default",
    source_key: "eunomia",
    source_dialect: "postgresql",
    source_connection: null,
    is_cache_enabled: false,
    is_default: true,
    restricted_to_roles: null,
    imported_from_webapi: null,
    daimons: [],
    created_at: "2026-04-27T00:00:00Z",
    updated_at: "2026-04-27T00:00:00Z",
    ...overrides,
  };
}

function designAsset(overrides: Partial<StudyDesignAsset> = {}): StudyDesignAsset {
  return {
    id: 1,
    session_id: session.id,
    version_id: importedVersion.id,
    asset_type: "imported_study_cohort",
    role: null,
    status: "accepted",
    draft_payload_json: {},
    canonical_type: null,
    canonical_id: null,
    provenance_json: null,
    verification_status: "verified",
    verification_json: {
      status: "verified",
      blocking_reasons: [],
      warnings: [],
    },
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
