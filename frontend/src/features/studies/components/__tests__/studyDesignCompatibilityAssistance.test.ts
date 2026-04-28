import { describe, expect, it } from "vitest";
import type { StudyDesignAsset } from "../../types/study";
import { buildCompatibilityAssistance } from "../studyDesignCompatibilityAssistance";
import { analysisDetailPath } from "../workbench/studyDesignWorkbenchHelpers";

describe("analysisDetailPath (consolidated helper)", () => {
  it.each([
    ["\\OHDSI\\Cohorts\\CohortMethod", 7, "/analyses/estimations/7"],
    ["\\OHDSI\\PatientLevelPrediction", 12, "/analyses/predictions/12"],
    ["\\OHDSI\\SelfControlledCaseSeries", 5, "/analyses/sccs/5"],
    ["\\OHDSI\\TreatmentPatterns", 9, "/analyses/pathways/9"],
    ["\\OHDSI\\CohortIncidence", 3, "/analyses/incidence-rates/3"],
    ["\\OHDSI\\EvidenceSynthesis", 11, "/analyses/evidence-synthesis/11"],
    ["\\OHDSI\\Characterizations", 21, "/analyses/characterizations/21"],
    ["\\OHDSI\\SelfControlledCohort", 14, "/analyses/self-controlled-cohorts/14"],
  ])("maps long PHP namespace %s → %s", (type, id, expected) => {
    expect(analysisDetailPath(type, id)).toBe(expected);
  });

  it.each([
    ["characterization", 1, "/analyses/characterizations/1"],
    ["incidence_rate", 2, "/analyses/incidence-rates/2"],
    ["pathway", 3, "/analyses/pathways/3"],
    ["estimation", 4, "/analyses/estimations/4"],
    ["prediction", 5, "/analyses/predictions/5"],
    ["sccs", 6, "/analyses/sccs/6"],
    ["self_controlled_cohort", 7, "/analyses/self-controlled-cohorts/7"],
    ["evidence_synthesis", 8, "/analyses/evidence-synthesis/8"],
  ])("preserves short key %s → %s", (type, id, expected) => {
    expect(analysisDetailPath(type, id)).toBe(expected);
  });

  it("returns null when id is null", () => {
    expect(analysisDetailPath("cohortmethod", null)).toBe(null);
  });

  it("returns null when type is unknown", () => {
    expect(analysisDetailPath("nonsense", 42)).toBe(null);
  });

  it("returns null when type is undefined", () => {
    expect(analysisDetailPath(undefined, 42)).toBe(null);
  });
});

describe("buildCompatibilityAssistance", () => {
  it("groups imported native assets by downstream compiler stage", () => {
    const assistance = buildCompatibilityAssistance([
      asset({
        id: 10,
        asset_type: "imported_concept_set",
        status: "materialized",
        materialized_id: 40,
        draft_payload_json: {
          title: "Antihypertensive medications",
          description: "Existing concept set",
        },
      }),
      asset({
        id: 11,
        asset_type: "imported_study_cohort",
        role: "target",
        materialized_id: 50,
        draft_payload_json: {
          label: "Target cohort",
          cohort_definition_name: "New ACE inhibitor users",
        },
      }),
    ]);

    expect(assistance.metrics.imported).toBe(2);
    expect(assistance.metrics.nativeLinks).toBe(2);
    expect(assistance.groups.find((group) => group.id === "concept_sets")?.importedAssets[0]).toEqual(
      expect.objectContaining({
        label: "Antihypertensive medications",
        nativeLink: "/concept-sets/40",
      }),
    );
    expect(assistance.groups.find((group) => group.id === "cohorts")?.importedAssets[0]).toEqual(
      expect.objectContaining({
        role: "target",
        nativeLink: "/cohort-definitions/50",
      }),
    );
  });

  it("turns critique findings into actionable grouped tasks", () => {
    const assistance = buildCompatibilityAssistance([
      critique({
        id: 20,
        draft_payload_json: {
          code: "missing_feasibility_evidence",
          severity: "blocking",
          message: "Run source-aware feasibility before analysis planning or lock.",
          meta: {},
          policy: "Bottom-up critique creates reviewable design findings without changing existing cohorts, analyses, or study metadata.",
        },
      }),
      critique({
        id: 21,
        draft_payload_json: {
          code: "deprecated_cohort",
          severity: "blocking",
          message: "Replace deprecated cohort definitions before lock or execution.",
          meta: { cohort_definition_id: 77 },
        },
      }),
    ]);

    expect(assistance.status).toBe("blocked");
    expect(assistance.metrics.blocking).toBe(2);
    expect(assistance.policy).toContain("do not modify existing cohorts");
    expect(assistance.groups.find((group) => group.id === "feasibility")?.tasks[0]).toEqual(
      expect.objectContaining({
        actionLabel: "Run feasibility",
        actionTarget: expect.stringContaining("source-aware feasibility"),
      }),
    );
    expect(assistance.groups.find((group) => group.id === "cohorts")?.tasks[0]).toEqual(
      expect.objectContaining({
        actionLabel: "Replace deprecated cohort",
        nativeLink: "/cohort-definitions/77",
      }),
    );
  });

  it("reports empty state before current assets are imported", () => {
    const assistance = buildCompatibilityAssistance([]);

    expect(assistance.status).toBe("empty");
    expect(assistance.summary).toContain("Import current study assets");
  });
});

function critique(overrides: Partial<StudyDesignAsset> = {}): StudyDesignAsset {
  return asset({
    asset_type: "design_critique",
    status: "needs_review",
    verification_status: "verified",
    ...overrides,
  });
}

function asset(overrides: Partial<StudyDesignAsset> = {}): StudyDesignAsset {
  return {
    id: 1,
    session_id: 1,
    version_id: 1,
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
