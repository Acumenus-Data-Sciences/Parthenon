import type {
  StudyCompilerGuidance,
  StudyCompilerStage,
  StudyCompilerStageId,
} from "../../types/study";

// Pure helpers that drive the Study Designer Wizard's stepper visual state,
// reachability, and Next-button gating. Kept out of the Zustand store so they
// can take live `compilerGuidance` (TanStack-Query owned) without syncing.

export const TOTAL_STEPS = 8;

// Wizard stepper display states. `partial` is the v2 acknowledge-warnings
// affordance — surfaced when any asset on this step has
// verification_status === "partial". `blocked` is the compiler-guidance
// "blocked" status (needs attention but already-touched).
export type WizardStepState =
  | "complete"
  | "active"
  | "partial"
  | "blocked"
  | "pending";

// Map wizard step index → guidance stage id.
// Step 7 (Package) has no upstream guidance — derives from Lock (step 6).
export const STEP_TO_SOURCE: ReadonlyArray<StudyCompilerStageId | null> = [
  "intent",
  "phenotypes",
  "concept_sets",
  "cohorts",
  "feasibility",
  "analysis",
  "lock",
  null,
];

// i18n key roots for each step's label. Resolved at render time via tAuto.
export const STEP_LABEL_KEYS: ReadonlyArray<string> = [
  "studies.v2.wizard.steps.intent",
  "studies.v2.wizard.steps.phenotypes",
  "studies.v2.wizard.steps.conceptSets",
  "studies.v2.wizard.steps.cohorts",
  "studies.v2.wizard.steps.feasibility",
  "studies.v2.wizard.steps.analyses",
  "studies.v2.wizard.steps.lock",
  "studies.v2.wizard.steps.package",
];

function stageFor(
  guidance: StudyCompilerGuidance | null,
  sourceId: StudyCompilerStageId | null,
): StudyCompilerStage | null {
  if (!guidance || !sourceId) return null;
  return guidance.stages.find((s) => s.id === sourceId) ?? null;
}

// Compute the display state for a single wizard step.
// `partialSteps` is computed by the caller from assets[verification_status].
export function stepState(
  guidance: StudyCompilerGuidance | null,
  step: number,
  partialSteps?: ReadonlySet<number>,
): WizardStepState {
  if (partialSteps?.has(step)) return "partial";

  const sourceId = STEP_TO_SOURCE[step] ?? null;

  // Step 7 (Package) — terminal. Active iff Lock is complete; pending otherwise.
  if (sourceId === null) {
    const lock = stageFor(guidance, "lock");
    return lock?.status === "complete" ? "active" : "pending";
  }

  const stage = stageFor(guidance, sourceId);
  if (!stage) return "pending";

  switch (stage.status) {
    case "complete":
      return "complete";
    case "active":
      return "active";
    case "blocked":
      return "blocked";
    case "pending":
    default:
      return "pending";
  }
}

// Find the highest step index whose guidance status is complete/active/blocked.
// Used by isReachable to permit "one step ahead of furthest advanced" navigation.
export function furthestAdvanced(
  guidance: StudyCompilerGuidance | null,
): number {
  let furthest = -1;
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const state = stepState(guidance, i);
    if (state === "complete" || state === "active" || state === "blocked") {
      furthest = i;
    }
  }
  return furthest;
}

// Hybrid nav: free-click on visited steps, plus any step ≤ furthest+1.
// Step 0 is always reachable.
export function isReachable(
  guidance: StudyCompilerGuidance | null,
  step: number,
  visited: ReadonlySet<number>,
): boolean {
  if (!Number.isInteger(step) || step < 0 || step >= TOTAL_STEPS) return false;
  if (step === 0) return true;
  if (visited.has(step)) return true;
  return step <= furthestAdvanced(guidance) + 1;
}

// Next-button gate. Returns true only when the current step's source stage is
// `complete` OR (`active` AND the user has no unsaved changes).
export function canProceed(
  guidance: StudyCompilerGuidance | null,
  step: number,
  isDirty: boolean,
): boolean {
  if (step < 0 || step >= TOTAL_STEPS - 1) return false;
  const sourceId = STEP_TO_SOURCE[step] ?? null;
  if (sourceId === null) return false;
  const stage = stageFor(guidance, sourceId);
  if (!stage) return false;
  if (stage.status === "complete") return true;
  if (stage.status === "active") return !isDirty;
  return false;
}
