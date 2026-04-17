// v1.0 UX pass — WorkbenchStepper smoke. Dropped "Select source" (the
// session is bound to a source at creation time), so the stepper now
// has 5 steps starting at Import cohorts.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkbenchStepper } from "../components/WorkbenchStepper";
import { WORKBENCH_STEPS } from "../lib/workbenchSteps";

describe("WorkbenchStepper", () => {
  it("renders all 5 steps", () => {
    render(
      <WorkbenchStepper
        current="import-cohorts"
        completed={new Set()}
        onStepChange={vi.fn()}
      />,
    );
    for (const step of WORKBENCH_STEPS) {
      expect(screen.getByText(step.label)).toBeDefined();
    }
  });

  it("clicking a step fires onStepChange with the step key", () => {
    const onStepChange = vi.fn();
    render(
      <WorkbenchStepper
        current="import-cohorts"
        completed={new Set()}
        onStepChange={onStepChange}
      />,
    );
    fireEvent.click(screen.getByText("Operate"));
    expect(onStepChange).toHaveBeenCalledWith("operate");
  });

  it("renders 5 steps total in WORKBENCH_STEPS export", () => {
    expect(WORKBENCH_STEPS).toHaveLength(5);
    expect(WORKBENCH_STEPS.map((s) => s.key)).toEqual([
      "import-cohorts",
      "operate",
      "match",
      "materialize",
      "handoff",
    ]);
  });
});
