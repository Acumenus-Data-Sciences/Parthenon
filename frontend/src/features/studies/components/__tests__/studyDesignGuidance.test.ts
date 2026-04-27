import { describe, expect, it } from "vitest";
import type {
  StudyCohortReadiness,
  StudyDesignAsset,
  StudyDesignLockReadiness,
  StudyDesignVersion,
} from "../../types/study";
import { buildStudyDesignGuidance } from "../studyDesignGuidance";

describe("buildStudyDesignGuidance", () => {
  it("starts with protocol upload or intent generation when there is no version", () => {
    const guidance = buildStudyDesignGuidance({
      version: null,
      assets: [],
    });

    expect(guidance.currentStage.id).toBe("intent");
    expect(guidance.nextAction.label).toBe("Upload protocol or generate intent");
    expect(guidance.nextAction.action?.type).toBe("upload_protocol");
    expect(guidance.nextAction.action?.stage_id).toBe("intent");
    expect(guidance.stages[0].status).toBe("active");
  });

  it("moves from accepted intent to phenotype recommendations", () => {
    const guidance = buildStudyDesignGuidance({
      version: version({ status: "accepted", accepted_at: "2026-04-27T10:00:00Z" }),
      assets: [],
    });

    expect(guidance.currentStage.id).toBe("phenotypes");
    expect(guidance.nextAction.label).toBe("Recommend phenotypes");
    expect(guidance.nextAction.action?.type).toBe("recommend_phenotypes");
  });

  it("moves accepted recommendations into concept set drafting", () => {
    const guidance = buildStudyDesignGuidance({
      version: version({ status: "accepted", accepted_at: "2026-04-27T10:00:00Z" }),
      assets: [
        asset({
          asset_type: "phenotype_recommendation",
          status: "accepted",
          verification_status: "verified",
        }),
      ],
    });

    expect(guidance.currentStage.id).toBe("concept_sets");
    expect(guidance.nextAction.label).toBe("Draft concept sets");
    expect(guidance.nextAction.action?.type).toBe("draft_concept_sets");
    expect(guidance.metrics.acceptedRecommendations).toBe(1);
  });

  it("promotes verifier blockers into the next action", () => {
    const guidance = buildStudyDesignGuidance({
      version: version({ status: "accepted", accepted_at: "2026-04-27T10:00:00Z" }),
      assets: [
        asset({
          asset_type: "phenotype_recommendation",
          status: "accepted",
          verification_status: "verified",
        }),
        asset({
          id: 2,
          asset_type: "concept_set_draft",
          verification_status: "blocked",
          verification_json: {
            blocking_reasons: ["Concept 201826 is deprecated."],
          },
        }),
      ],
    });

    expect(guidance.currentStage.id).toBe("concept_sets");
    expect(guidance.currentStage.status).toBe("blocked");
    expect(guidance.nextAction.detail).toBe("Concept 201826 is deprecated.");
    expect(guidance.nextAction.action?.type).toBe("repair_concept_draft");
    expect(guidance.blockers).toContain("Concept 201826 is deprecated.");
  });

  it("advances linked cohorts to feasibility", () => {
    const guidance = buildStudyDesignGuidance({
      version: version({ status: "accepted", accepted_at: "2026-04-27T10:00:00Z" }),
      cohortReadiness: {
        ready: true,
        ready_for_feasibility: true,
        cohort_asset_count: 1,
        materialized_verified_count: 1,
        blocked_count: 0,
      } satisfies StudyCohortReadiness,
      assets: [
        asset({
          asset_type: "concept_set_draft",
          status: "materialized",
          verification_status: "verified",
          materialized_id: 100,
        }),
        asset({
          id: 2,
          asset_type: "cohort_draft",
          status: "materialized",
          verification_status: "verified",
          materialized_id: 200,
          provenance_json: { study_cohort_id: 300 },
        }),
      ],
    });

    expect(guidance.currentStage.id).toBe("feasibility");
    expect(guidance.nextAction.label).toBe("Run feasibility");
    expect(guidance.nextAction.action?.type).toBe("run_feasibility");
    expect(guidance.metrics.linkedCohorts).toBe(1);
  });

  it("does not let the optional current-assets step steal focus after lock", () => {
    const guidance = buildStudyDesignGuidance({
      version: version({ status: "locked", locked_at: "2026-04-27T11:00:00Z" }),
      lockReadiness: {
        ready: true,
        status: "ready",
        locked: true,
      } as StudyDesignLockReadiness,
      assets: [
        asset({
          asset_type: "feasibility_result",
          draft_payload_json: { status: "ready" },
        }),
        asset({
          id: 2,
          asset_type: "analysis_plan",
          status: "materialized",
          verification_status: "verified",
          materialized_id: 50,
        }),
      ],
    });

    expect(guidance.currentStage.id).toBe("lock");
    expect(guidance.currentStage.status).toBe("complete");
  });

  it("uses backend compiler guidance as the canonical rail when available", () => {
    const guidance = buildStudyDesignGuidance({
      version: version({ status: "accepted", accepted_at: "2026-04-27T10:00:00Z" }),
      assets: [],
      backendGuidance: {
        schema_version: "study-design-guidance.v1",
        initial_gate: {
          status: "ready",
          blocking_count: 0,
          issues: [],
        },
        sections: [
          {
            id: "intent",
            label: "Design Intent",
            status: "complete",
            summary: "The backend accepted the intent.",
            actions: [],
          },
          {
            id: "analysis_plans",
            label: "Analysis Plans",
            status: "blocked",
            summary: "Analysis plans need HADES package remediation.",
            blockers: [{ message: "CohortMethod is not installed." }],
            actions: [{
              type: "resolve_analysis_blockers",
              label: "Resolve analysis blockers",
              priority: "blocking",
            }],
          },
        ],
        next_best_actions: [{
          section: "analysis_plans",
          type: "resolve_analysis_blockers",
          label: "Resolve analysis blockers",
          priority: "blocking",
          issues: [{ message: "CohortMethod is not installed." }],
        }],
      },
    });

    expect(guidance.currentStage.id).toBe("analysis");
    expect(guidance.currentStage.status).toBe("blocked");
    expect(guidance.nextAction.label).toBe("Resolve analysis blockers");
    expect(guidance.nextAction.detail).toBe("CohortMethod is not installed.");
    expect(guidance.blockers).toContain("CohortMethod is not installed.");
  });
});

function version(overrides: Partial<StudyDesignVersion> = {}): StudyDesignVersion {
  return {
    id: 1,
    session_id: 1,
    version_number: 1,
    status: "draft",
    intent_json: null,
    normalized_spec_json: null,
    provenance_json: null,
    accepted_by: null,
    accepted_at: null,
    locked_at: null,
    created_at: "2026-04-27T00:00:00Z",
    updated_at: "2026-04-27T00:00:00Z",
    ...overrides,
  };
}

function asset(overrides: Partial<StudyDesignAsset> = {}): StudyDesignAsset {
  return {
    id: 1,
    session_id: 1,
    version_id: 1,
    asset_type: "phenotype_recommendation",
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
