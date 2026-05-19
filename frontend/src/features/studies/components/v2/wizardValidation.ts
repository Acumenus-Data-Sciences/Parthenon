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

// Inverse: guidance stage id → wizard step index. `current_assets` is folded
// into Intent (step 0), matching the v1 rail behavior which also skipped it.
// Used to jump the wizard to the user's last-active stage on first mount.
export const SOURCE_TO_STEP: Readonly<Record<StudyCompilerStageId, number>> = {
  intent: 0,
  current_assets: 0,
  phenotypes: 1,
  concept_sets: 2,
  cohorts: 3,
  feasibility: 4,
  analysis: 5,
  lock: 6,
};

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

// Resolve the wizard step the user was last working on, for first-mount
// auto-jump. Returns 0 (Intent) when guidance is unavailable or the current
// stage is unknown. `current_assets` folds back to Intent (it has no
// dedicated step).
export function computeInitialStep(
  guidance: StudyCompilerGuidance | null,
): number {
  if (!guidance) return 0;
  const id = guidance.currentStage.id;
  return SOURCE_TO_STEP[id] ?? 0;
}

// Next-button gate. The compiler-guidance state machine transitions
// pending → active → complete as the user takes the canonical action for a
// step. "active" means the user still has work to do on this step, so Next
// is only enabled when the current step's source stage is "complete".
// Users can still free-navigate forward by clicking the next step's circle
// if it's reachable (within one-ahead of furthestAdvanced).
export function canProceed(
  guidance: StudyCompilerGuidance | null,
  step: number,
): boolean {
  if (step < 0 || step >= TOTAL_STEPS - 1) return false;
  const sourceId = STEP_TO_SOURCE[step] ?? null;
  if (sourceId === null) return false;
  const stage = stageFor(guidance, sourceId);
  return stage?.status === "complete";
}
