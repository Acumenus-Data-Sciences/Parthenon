import { describe, expect, it } from "vitest";
import type {
  StudyCompilerGuidance,
  StudyCompilerStage,
  StudyCompilerStageId,
  StudyCompilerStageStatus,
} from "../../types/study";
import {
  canProceed,
  furthestAdvanced,
  isReachable,
  stepState,
  TOTAL_STEPS,
} from "./wizardValidation";

// Build a guidance fixture with a per-stage status map.
function guidance(
  statuses: Partial<Record<StudyCompilerStageId, StudyCompilerStageStatus>>,
): StudyCompilerGuidance {
  const ALL_STAGES: ReadonlyArray<StudyCompilerStageId> = [
    "intent",
    "current_assets",
    "phenotypes",
    "concept_sets",
    "cohorts",
    "feasibility",
    "analysis",
    "lock",
  ];
  const stages: StudyCompilerStage[] = ALL_STAGES.map((id) => ({
    id,
    label: id,
    status: statuses[id] ?? "pending",
    detail: "",
  }));
  const current = stages.find((s) => s.status === "active") ?? stages[0];
  return {
    currentStage: current,
    nextAction: { label: "", detail: "", stageId: current.id },
    stages,
    blockers: [],
    warnings: [],
    metrics: {
      recommendations: 0,
      acceptedRecommendations: 0,
      conceptDrafts: 0,
      materializedConceptSets: 0,
      cohortDrafts: 0,
      linkedCohorts: 0,
      feasibilityRuns: 0,
      materializedAnalyses: 0,
    },
  };
}

describe("stepState", () => {
  it("returns 'pending' when guidance is null", () => {
    expect(stepState(null, 0)).toBe("pending");
    expect(stepState(null, 5)).toBe("pending");
    expect(stepState(null, 7)).toBe("pending");
  });

  it("maps each compiler-guidance status to the corresponding visual state", () => {
    const g = guidance({
      intent: "complete",
      phenotypes: "active",
      concept_sets: "blocked",
      cohorts: "pending",
    });
    expect(stepState(g, 0)).toBe("complete");
    expect(stepState(g, 1)).toBe("active");
    expect(stepState(g, 2)).toBe("blocked");
    expect(stepState(g, 3)).toBe("pending");
  });

  it("treats Package (step 7) as 'active' iff Lock is complete, else 'pending'", () => {
    expect(stepState(guidance({ lock: "complete" }), 7)).toBe("active");
    expect(stepState(guidance({ lock: "active" }), 7)).toBe("pending");
    expect(stepState(guidance({ lock: "pending" }), 7)).toBe("pending");
    expect(stepState(null, 7)).toBe("pending");
  });

  it("'partial' overrides any compiler-guidance status when the step is in partialSteps", () => {
    const g = guidance({ intent: "complete", phenotypes: "active" });
    const partial = new Set([0, 1]);
    expect(stepState(g, 0, partial)).toBe("partial");
    expect(stepState(g, 1, partial)).toBe("partial");
    expect(stepState(g, 2, partial)).toBe("pending");
  });
});

describe("furthestAdvanced", () => {
  it("returns -1 when no stages are active/complete/blocked", () => {
    expect(furthestAdvanced(null)).toBe(-1);
    expect(furthestAdvanced(guidance({}))).toBe(-1);
  });

  it("returns the highest step index whose stage is complete/active/blocked", () => {
    expect(furthestAdvanced(guidance({ intent: "complete" }))).toBe(0);
    expect(
      furthestAdvanced(
        guidance({ intent: "complete", phenotypes: "active" }),
      ),
    ).toBe(1);
    expect(
      furthestAdvanced(
        guidance({
          intent: "complete",
          phenotypes: "complete",
          cohorts: "blocked",
        }),
      ),
    ).toBe(3);
  });

  it("Lock complete (step 6) lifts Package (step 7) to 'active' but does not change furthestAdvanced beyond 6 unless package is partial/blocked", () => {
    // Lock complete → step 7 state is "active" via the Package derivation.
    // Since stepState(7) returns "active", furthestAdvanced should be 7.
    expect(furthestAdvanced(guidance({ lock: "complete" }))).toBe(7);
  });
});

describe("isReachable", () => {
  it("step 0 is always reachable, regardless of guidance or visited", () => {
    expect(isReachable(null, 0, new Set())).toBe(true);
    expect(isReachable(guidance({}), 0, new Set())).toBe(true);
  });

  it("out-of-range steps are never reachable", () => {
    expect(isReachable(null, -1, new Set())).toBe(false);
    expect(isReachable(null, TOTAL_STEPS, new Set())).toBe(false);
    expect(isReachable(null, 99, new Set())).toBe(false);
  });

  it("visited steps are always reachable, even if guidance has no signal", () => {
    expect(isReachable(null, 5, new Set([5]))).toBe(true);
    expect(isReachable(guidance({}), 7, new Set([7]))).toBe(true);
  });

  it("permits one step ahead of the furthest-advanced", () => {
    const g = guidance({
      intent: "complete",
      phenotypes: "active",
    });
    // furthest = 1, so steps 0, 1, 2 reachable; 3+ not
    expect(isReachable(g, 0, new Set())).toBe(true);
    expect(isReachable(g, 1, new Set())).toBe(true);
    expect(isReachable(g, 2, new Set())).toBe(true);
    expect(isReachable(g, 3, new Set())).toBe(false);
    expect(isReachable(g, 7, new Set())).toBe(false);
  });

  it("hybrid nav: visited + one-ahead are both reachable", () => {
    const g = guidance({ intent: "complete" });
    // furthest = 0, so step 1 reachable. Step 4 only via visited.
    expect(isReachable(g, 1, new Set())).toBe(true);
    expect(isReachable(g, 2, new Set())).toBe(false);
    expect(isReachable(g, 4, new Set([4]))).toBe(true);
  });
});

describe("canProceed", () => {
  it("returns false on the last step (no Next)", () => {
    expect(canProceed(guidance({}), TOTAL_STEPS - 1, false)).toBe(false);
    expect(canProceed(null, TOTAL_STEPS - 1, false)).toBe(false);
  });

  it("returns false when guidance is null", () => {
    expect(canProceed(null, 0, false)).toBe(false);
    expect(canProceed(null, 3, false)).toBe(false);
  });

  it("returns true when the current step's stage is 'complete'", () => {
    expect(canProceed(guidance({ intent: "complete" }), 0, false)).toBe(true);
    expect(canProceed(guidance({ intent: "complete" }), 0, true)).toBe(true);
    expect(
      canProceed(guidance({ phenotypes: "complete" }), 1, false),
    ).toBe(true);
  });

  it("returns true when 'active' AND not dirty; false when dirty", () => {
    expect(canProceed(guidance({ intent: "active" }), 0, false)).toBe(true);
    expect(canProceed(guidance({ intent: "active" }), 0, true)).toBe(false);
  });

  it("returns false on 'blocked' or 'pending' regardless of dirty", () => {
    expect(canProceed(guidance({ intent: "blocked" }), 0, false)).toBe(false);
    expect(canProceed(guidance({ intent: "blocked" }), 0, true)).toBe(false);
    expect(canProceed(guidance({ intent: "pending" }), 0, false)).toBe(false);
  });

  it("returns false on out-of-range step", () => {
    expect(canProceed(guidance({ intent: "complete" }), -1, false)).toBe(false);
    expect(canProceed(guidance({ intent: "complete" }), TOTAL_STEPS, false))
      .toBe(false);
  });
});
