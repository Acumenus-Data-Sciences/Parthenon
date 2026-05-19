import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  StudyDesignerStepper,
  type StepperStep,
} from "./StudyDesignerStepper";
import type { WizardStepState } from "./wizardValidation";

function mkStep(
  label: string,
  state: WizardStepState,
  reachable: boolean,
): StepperStep {
  return { key: `step-${label}`, label, state, reachable };
}

const SAMPLE_STEPS: ReadonlyArray<StepperStep> = [
  mkStep("Intent", "complete", true),
  mkStep("Phenotypes", "active", true),
  mkStep("Concept Sets", "pending", true),
  mkStep("Cohorts", "pending", false),
  mkStep("Feasibility", "pending", false),
  mkStep("Analyses", "pending", false),
  mkStep("Lock", "pending", false),
  mkStep("Package", "pending", false),
];

describe("StudyDesignerStepper", () => {
  it("renders all step labels in order", () => {
    render(
      <StudyDesignerStepper
        steps={SAMPLE_STEPS}
        currentStep={1}
        onStepClick={vi.fn()}
      />,
    );

    for (const step of SAMPLE_STEPS) {
      expect(screen.getByText(step.label)).toBeInTheDocument();
    }
  });

  it("marks the current step's button with aria-current='step'", () => {
    render(
      <StudyDesignerStepper
        steps={SAMPLE_STEPS}
        currentStep={1}
        onStepClick={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("tab");
    expect(buttons[1]).toHaveAttribute("aria-current", "step");
    expect(buttons[0]).not.toHaveAttribute("aria-current", "step");
    expect(buttons[2]).not.toHaveAttribute("aria-current", "step");
  });

  it("disables unreachable steps via the disabled attribute and aria-disabled", () => {
    render(
      <StudyDesignerStepper
        steps={SAMPLE_STEPS}
        currentStep={1}
        onStepClick={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("tab");
    // Step 3 (Cohorts) is unreachable in our fixture
    expect(buttons[3]).toBeDisabled();
    expect(buttons[3]).toHaveAttribute("aria-disabled", "true");
    // Step 0 (Intent) is reachable
    expect(buttons[0]).not.toBeDisabled();
  });

  it("renders the check icon for completed steps", () => {
    const { container } = render(
      <StudyDesignerStepper
        steps={SAMPLE_STEPS}
        currentStep={1}
        onStepClick={vi.fn()}
      />,
    );

    // The check icon is a Lucide <svg>; it's rendered inside the completed
    // step's button. Step 0 = Intent = complete.
    const buttons = screen.getAllByRole("tab");
    expect(within(buttons[0]).queryByText("1")).toBeNull();
    // lucide-react renders the check as an inline svg
    expect(container.querySelector("svg.lucide-check")).toBeTruthy();
  });

  it("renders the AlertTriangle icon for partial steps", () => {
    const partial = [
      mkStep("Intent", "complete", true),
      mkStep("Phenotypes", "partial", true),
      ...SAMPLE_STEPS.slice(2),
    ];
    const { container } = render(
      <StudyDesignerStepper
        steps={partial}
        currentStep={1}
        onStepClick={vi.fn()}
      />,
    );
    // Lucide renders the icon as <svg class="lucide lucide-triangle-alert">
    // (and the older class was lucide-alert-triangle). Match either.
    const svg =
      container.querySelector("svg.lucide-triangle-alert") ??
      container.querySelector("svg.lucide-alert-triangle");
    expect(svg).toBeTruthy();
  });

  it("invokes onStepClick when a reachable step is clicked", () => {
    const onStepClick = vi.fn();
    render(
      <StudyDesignerStepper
        steps={SAMPLE_STEPS}
        currentStep={1}
        onStepClick={onStepClick}
      />,
    );

    const buttons = screen.getAllByRole("tab");
    fireEvent.click(buttons[0]);
    expect(onStepClick).toHaveBeenCalledWith(0);
  });

  it("does not invoke onStepClick when an unreachable step is clicked", () => {
    const onStepClick = vi.fn();
    render(
      <StudyDesignerStepper
        steps={SAMPLE_STEPS}
        currentStep={1}
        onStepClick={onStepClick}
      />,
    );

    const buttons = screen.getAllByRole("tab");
    fireEvent.click(buttons[3]);
    expect(onStepClick).not.toHaveBeenCalled();
  });

  it("ArrowRight skips to the next reachable step", () => {
    const onStepClick = vi.fn();
    render(
      <StudyDesignerStepper
        steps={SAMPLE_STEPS}
        currentStep={1}
        onStepClick={onStepClick}
      />,
    );

    const buttons = screen.getAllByRole("tab");
    fireEvent.keyDown(buttons[1], { key: "ArrowRight" });
    // Step 2 is reachable (pending but visited per sample) → focus moves there
    expect(onStepClick).toHaveBeenCalledWith(2);
  });

  it("ArrowLeft skips to the previous reachable step", () => {
    const onStepClick = vi.fn();
    render(
      <StudyDesignerStepper
        steps={SAMPLE_STEPS}
        currentStep={2}
        onStepClick={onStepClick}
      />,
    );

    const buttons = screen.getAllByRole("tab");
    fireEvent.keyDown(buttons[2], { key: "ArrowLeft" });
    expect(onStepClick).toHaveBeenCalledWith(1);
  });

  it("ArrowRight stays put when no reachable step is forward", () => {
    const onStepClick = vi.fn();
    // Only step 0 reachable; everything after is unreachable.
    const stuck: ReadonlyArray<StepperStep> = [
      mkStep("Intent", "active", true),
      ...SAMPLE_STEPS.slice(1).map((s) => ({ ...s, reachable: false })),
    ];
    render(
      <StudyDesignerStepper
        steps={stuck}
        currentStep={0}
        onStepClick={onStepClick}
      />,
    );

    const buttons = screen.getAllByRole("tab");
    fireEvent.keyDown(buttons[0], { key: "ArrowRight" });
    expect(onStepClick).not.toHaveBeenCalled();
  });
});
