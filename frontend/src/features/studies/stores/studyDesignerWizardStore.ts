import { create } from "zustand";

// Study Designer Wizard navigation store — mirrors the cohort-definitions
// CohortWizard pattern (currentStep + slideDir + Back/Next gating) but adapted
// for the 8-step study-designer pipeline.
//
// The store is strictly navigation state. Validation gates (canProceed,
// isReachable) live in ./wizardValidation.ts as pure functions that take the
// external compilerGuidance — we don't sync TanStack-Query state into Zustand.
//
// Hybrid navigation contract (per 2026-05-18 spec):
//   - Free-nav across visited steps (visited set persists across renders)
//   - Linear Next is gated by canProceed(guidance, step, isDirty)
//   - Reachability is computed externally — the store doesn't know about
//     compiler guidance.

export const TOTAL_STEPS = 8;

export interface StudyDesignerWizardStore {
  currentStep: number;
  slideDir: "forward" | "back";
  visited: ReadonlySet<number>;

  setStep: (step: number) => void;
  goNext: () => void;
  goBack: () => void;
  reset: () => void;
}

function initialVisited(): ReadonlySet<number> {
  return new Set<number>([0]);
}

const initialState = {
  currentStep: 0,
  slideDir: "forward" as const,
  visited: initialVisited(),
};

export const useStudyDesignerWizardStore = create<StudyDesignerWizardStore>(
  (set, get) => ({
    ...initialState,

    setStep: (step) => {
      if (!Number.isInteger(step) || step < 0 || step >= TOTAL_STEPS) return;
      const { currentStep, visited } = get();
      if (step === currentStep) return;
      const nextVisited = new Set(visited);
      nextVisited.add(step);
      set({
        currentStep: step,
        slideDir: step > currentStep ? "forward" : "back",
        visited: nextVisited,
      });
    },

    goNext: () => {
      const { currentStep, visited } = get();
      if (currentStep >= TOTAL_STEPS - 1) return;
      const target = currentStep + 1;
      const nextVisited = new Set(visited);
      nextVisited.add(target);
      set({
        currentStep: target,
        slideDir: "forward",
        visited: nextVisited,
      });
    },

    goBack: () => {
      const { currentStep } = get();
      if (currentStep <= 0) return;
      set({
        currentStep: currentStep - 1,
        slideDir: "back",
      });
    },

    reset: () =>
      set({
        currentStep: 0,
        slideDir: "forward",
        visited: initialVisited(),
      }),
  }),
);
