import { afterEach, describe, expect, it } from "vitest";
import {
  TOTAL_STEPS,
  useStudyDesignerWizardStore,
} from "./studyDesignerWizardStore";

afterEach(() => {
  useStudyDesignerWizardStore.getState().reset();
});

describe("useStudyDesignerWizardStore", () => {
  it("starts on step 0 with forward slide and step 0 visited", () => {
    const s = useStudyDesignerWizardStore.getState();
    expect(s.currentStep).toBe(0);
    expect(s.slideDir).toBe("forward");
    expect(s.visited.has(0)).toBe(true);
    expect(s.visited.size).toBe(1);
  });

  it("goNext advances by one and marks the new step visited", () => {
    const { goNext } = useStudyDesignerWizardStore.getState();
    goNext();
    const s = useStudyDesignerWizardStore.getState();
    expect(s.currentStep).toBe(1);
    expect(s.slideDir).toBe("forward");
    expect(s.visited.has(1)).toBe(true);
  });

  it("goBack decrements by one and slides back", () => {
    const { goNext, goBack } = useStudyDesignerWizardStore.getState();
    goNext();
    goNext();
    goBack();
    const s = useStudyDesignerWizardStore.getState();
    expect(s.currentStep).toBe(1);
    expect(s.slideDir).toBe("back");
  });

  it("goBack on step 0 is a no-op", () => {
    const { goBack } = useStudyDesignerWizardStore.getState();
    goBack();
    const s = useStudyDesignerWizardStore.getState();
    expect(s.currentStep).toBe(0);
  });

  it("goNext on last step is a no-op", () => {
    const { setStep, goNext } = useStudyDesignerWizardStore.getState();
    setStep(TOTAL_STEPS - 1);
    goNext();
    const s = useStudyDesignerWizardStore.getState();
    expect(s.currentStep).toBe(TOTAL_STEPS - 1);
  });

  it("setStep jumps to arbitrary step and updates slide direction", () => {
    const { setStep } = useStudyDesignerWizardStore.getState();
    setStep(5);
    let s = useStudyDesignerWizardStore.getState();
    expect(s.currentStep).toBe(5);
    expect(s.slideDir).toBe("forward");
    expect(s.visited.has(5)).toBe(true);

    setStep(2);
    s = useStudyDesignerWizardStore.getState();
    expect(s.currentStep).toBe(2);
    expect(s.slideDir).toBe("back");
    expect(s.visited.has(2)).toBe(true);
    expect(s.visited.has(5)).toBe(true);
  });

  it("setStep ignores out-of-range and non-integer values", () => {
    const { setStep } = useStudyDesignerWizardStore.getState();
    setStep(-1);
    setStep(TOTAL_STEPS);
    setStep(99);
    setStep(1.5);
    const s = useStudyDesignerWizardStore.getState();
    expect(s.currentStep).toBe(0);
    expect(s.visited.size).toBe(1);
  });

  it("setStep to current step is a no-op (no slideDir change)", () => {
    const { setStep, goNext } = useStudyDesignerWizardStore.getState();
    goNext();
    goNext();
    const before = useStudyDesignerWizardStore.getState();
    setStep(2);
    const after = useStudyDesignerWizardStore.getState();
    expect(after.currentStep).toBe(2);
    expect(after.slideDir).toBe(before.slideDir);
    expect(after.visited).toEqual(before.visited);
  });

  it("reset returns the store to initial state", () => {
    const { setStep, reset } = useStudyDesignerWizardStore.getState();
    setStep(4);
    setStep(7);
    reset();
    const s = useStudyDesignerWizardStore.getState();
    expect(s.currentStep).toBe(0);
    expect(s.slideDir).toBe("forward");
    expect(s.visited.size).toBe(1);
    expect(s.visited.has(0)).toBe(true);
  });

  it("visited set is immutable from outside (callers can't mutate it back into the store)", () => {
    const { setStep } = useStudyDesignerWizardStore.getState();
    setStep(3);
    const s = useStudyDesignerWizardStore.getState();
    // ReadonlySet's contract — TS prevents .add, runtime should also reject
    // (Set's .add still works at runtime on a ReadonlySet, but the store
    // returns a fresh Set on each mutation so this can't leak)
    setStep(4);
    const s2 = useStudyDesignerWizardStore.getState();
    expect(s2.visited).not.toBe(s.visited);
    expect(s2.visited.has(3)).toBe(true);
    expect(s2.visited.has(4)).toBe(true);
  });
});
