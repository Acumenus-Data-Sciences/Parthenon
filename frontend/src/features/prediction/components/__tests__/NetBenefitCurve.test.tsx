import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NetBenefitCurve } from "../NetBenefitCurve";

const sampleData = [
  { threshold: 0.05, model: 0.04, treatAll: 0.03, treatNone: 0 },
  { threshold: 0.10, model: 0.035, treatAll: 0.02, treatNone: 0 },
  { threshold: 0.15, model: 0.025, treatAll: 0.01, treatNone: 0 },
  { threshold: 0.20, model: 0.018, treatAll: 0.005, treatNone: 0 },
  { threshold: 0.30, model: 0.010, treatAll: -0.01, treatNone: 0 },
  { threshold: 0.40, model: 0.005, treatAll: -0.03, treatNone: 0 },
  { threshold: 0.50, model: -0.002, treatAll: -0.05, treatNone: 0 },
];

describe("NetBenefitCurve", () => {
  it("renders the SVG", () => {
    render(<NetBenefitCurve data={sampleData} />);
    expect(screen.getByTestId("net-benefit-curve-svg")).toBeInTheDocument();
  });

  it("renders benefit region shading", () => {
    render(<NetBenefitCurve data={sampleData} />);
    const regions = screen.getAllByTestId("benefit-region");
    expect(regions.length).toBeGreaterThanOrEqual(1);
  });

  it("renders crossover labels at intersection points", () => {
    // Model crosses treat-none between idx 5 (0.005) and 6 (-0.002)
    render(<NetBenefitCurve data={sampleData} />);
    const labels = screen.getAllByTestId("crossover-label");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("renders nothing for empty data", () => {
    const { container } = render(<NetBenefitCurve data={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows legend with Model, Treat All, Treat None", () => {
    render(<NetBenefitCurve data={sampleData} />);
    expect(screen.getByText("Model")).toBeInTheDocument();
    expect(screen.getByText("Treat All")).toBeInTheDocument();
    expect(screen.getByText("Treat None")).toBeInTheDocument();
  });
});
