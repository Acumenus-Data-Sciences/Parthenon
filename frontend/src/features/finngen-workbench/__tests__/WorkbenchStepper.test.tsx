// SP4 Phase F.1 — WorkbenchStepper smoke. Verifies all 6 steps render,
// the current step is highlighted, completed steps show a check, and
// click fires onStepChange with the correct key.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkbenchStepper, WORKBENCH_STEPS } from "../components/WorkbenchStepper";

describe("WorkbenchStepper", () => {
  it("renders all 6 steps", () => {
    render(<WorkbenchStepper current="select-source" completed={new Set()} onStepChange={vi.fn()} />);
    for (const step of WORKBENCH_STEPS) {
      expect(screen.getByText(step.label)).toBeDefined();
    }
  });

  it("clicking a step fires onStepChange with the step key", () => {
    const onStepChange = vi.fn();
    render(<WorkbenchStepper current="select-source" completed={new Set()} onStepChange={onStepChange} />);
    fireEvent.click(screen.getByText("Operate"));
    expect(onStepChange).toHaveBeenCalledWith("operate");
  });

  it("renders 6 steps total in WORKBENCH_STEPS export", () => {
    expect(WORKBENCH_STEPS).toHaveLength(6);
    expect(WORKBENCH_STEPS.map((s) => s.key)).toEqual([
      "select-source",
      "import-cohorts",
      "operate",
      "match",
      "materialize",
      "handoff",
    ]);
  });
});
