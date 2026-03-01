import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PipelineStepper } from "@/features/ingestion/components/PipelineStepper";

const STEP_LABELS = [
  "Profiling",
  "Schema Mapping",
  "Concept Mapping",
  "Review",
  "CDM Writing",
  "Validation",
];

describe("PipelineStepper", () => {
  it("renders all 6 pipeline steps", () => {
    render(<PipelineStepper currentStep={null} status="pending" />);
    const steps = STEP_LABELS.map((label) => screen.getByText(label));
    expect(steps).toHaveLength(6);
  });

  it("shows correct step labels", () => {
    render(<PipelineStepper currentStep={null} status="pending" />);
    for (const label of STEP_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks completed steps with checkmark icon and teal styling", () => {
    // currentStep is "concept_mapping" (index 2), status running
    // Steps 0 (profiling) and 1 (schema_mapping) should be completed
    const { container } = render(
      <PipelineStepper currentStep="concept_mapping" status="running" />,
    );

    // The completed step circles should have teal background
    const stepCircles = container.querySelectorAll(
      ".flex.items-center.justify-center.w-9.h-9",
    );

    // First two steps (index 0, 1) should be completed with teal bg
    expect(stepCircles[0]?.className).toContain("bg-[#2DD4BF]");
    expect(stepCircles[1]?.className).toContain("bg-[#2DD4BF]");

    // Completed step labels should have teal text
    expect(screen.getByText("Profiling").className).toContain("text-[#2DD4BF]");
    expect(screen.getByText("Schema Mapping").className).toContain(
      "text-[#2DD4BF]",
    );
  });

  it("shows active step with pulse animation", () => {
    const { container } = render(
      <PipelineStepper currentStep="concept_mapping" status="running" />,
    );

    const stepCircles = container.querySelectorAll(
      ".flex.items-center.justify-center.w-9.h-9",
    );

    // Third step (index 2) is the active step
    expect(stepCircles[2]?.className).toContain("animate-pulse");
    expect(stepCircles[2]?.className).toContain("bg-[#9B1B30]");
  });

  it("shows pending steps as gray", () => {
    const { container } = render(
      <PipelineStepper currentStep="profiling" status="running" />,
    );

    const stepCircles = container.querySelectorAll(
      ".flex.items-center.justify-center.w-9.h-9",
    );

    // Steps 1-5 should be pending with gray border
    for (let i = 1; i < stepCircles.length; i++) {
      expect(stepCircles[i]?.className).toContain("border-[#323238]");
      expect(stepCircles[i]?.className).toContain("text-[#5A5650]");
    }

    // Pending step labels should have gray text
    expect(screen.getByText("Schema Mapping").className).toContain(
      "text-[#5A5650]",
    );
  });

  it("shows step numbers for non-completed steps", () => {
    render(<PipelineStepper currentStep="profiling" status="running" />);

    // Pending steps show their number (2-6 for steps at index 1-5)
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("marks all steps completed when last step status is completed", () => {
    const { container } = render(
      <PipelineStepper currentStep="validation" status="completed" />,
    );

    const stepCircles = container.querySelectorAll(
      ".flex.items-center.justify-center.w-9.h-9",
    );

    // All 6 steps should be completed (teal)
    for (const circle of stepCircles) {
      expect(circle.className).toContain("bg-[#2DD4BF]");
    }
  });

  it("shows failed state with red styling on the failed step", () => {
    const { container } = render(
      <PipelineStepper currentStep="cdm_writing" status="failed" />,
    );

    const stepCircles = container.querySelectorAll(
      ".flex.items-center.justify-center.w-9.h-9",
    );

    // cdm_writing is index 4 - should be red (failed)
    expect(stepCircles[4]?.className).toContain("bg-[#E85A6B]");

    // Its label should also be red
    expect(screen.getByText("CDM Writing").className).toContain(
      "text-[#E85A6B]",
    );
  });
});
