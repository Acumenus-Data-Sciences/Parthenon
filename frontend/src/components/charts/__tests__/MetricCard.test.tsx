import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChartMetricCard } from "../MetricCard";

describe("ChartMetricCard", () => {
  it("renders label and value", () => {
    render(<ChartMetricCard label="Hazard Ratio" value="0.72" />);
    expect(screen.getByText("Hazard Ratio")).toBeInTheDocument();
    expect(screen.getByText("0.72")).toBeInTheDocument();
  });

  it("renders numeric value", () => {
    render(<ChartMetricCard label="Count" value={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<ChartMetricCard label="HR" value="1.2" subtitle="vs comparator" />);
    expect(screen.getByText("vs comparator")).toBeInTheDocument();
  });

  it("does not render subtitle when not provided", () => {
    const { container } = render(<ChartMetricCard label="HR" value="1.2" />);
    const subtitleElements = container.querySelectorAll(".text-\\[\\#5A5650\\]");
    expect(subtitleElements.length).toBe(0);
  });

  it("renders children", () => {
    render(
      <ChartMetricCard label="HR" value="0.9">
        <span data-testid="child">Extra content</span>
      </ChartMetricCard>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<ChartMetricCard label="HR" value="1.0" className="w-full" />);
    const card = screen.getByTestId("chart-metric-card");
    expect(card.className).toContain("w-full");
  });
});
