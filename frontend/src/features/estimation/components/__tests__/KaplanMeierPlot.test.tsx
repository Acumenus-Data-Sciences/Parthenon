import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KaplanMeierPlot } from "../KaplanMeierPlot";

function makeTargetCurve() {
  return [
    { time: 0, surv: 1.0, survLower: 0.98, survUpper: 1.0, nAtRisk: 100, nEvents: 0, nCensored: 0 },
    { time: 30, surv: 0.95, survLower: 0.92, survUpper: 0.98, nAtRisk: 95, nEvents: 5, nCensored: 0 },
    { time: 60, surv: 0.88, survLower: 0.84, survUpper: 0.92, nAtRisk: 88, nEvents: 7, nCensored: 0 },
    { time: 90, surv: 0.82, survLower: 0.77, survUpper: 0.87, nAtRisk: 82, nEvents: 6, nCensored: 0 },
  ];
}

function makeComparatorCurve() {
  return [
    { time: 0, surv: 1.0, survLower: 0.98, survUpper: 1.0, nAtRisk: 100, nEvents: 0, nCensored: 0 },
    { time: 30, surv: 0.90, survLower: 0.86, survUpper: 0.94, nAtRisk: 90, nEvents: 10, nCensored: 0 },
    { time: 60, surv: 0.80, survLower: 0.75, survUpper: 0.85, nAtRisk: 80, nEvents: 10, nCensored: 0 },
    { time: 90, surv: 0.70, survLower: 0.64, survUpper: 0.76, nAtRisk: 70, nEvents: 10, nCensored: 0 },
  ];
}

describe("KaplanMeierPlot", () => {
  it("renders an SVG element", () => {
    render(
      <KaplanMeierPlot
        targetCurve={makeTargetCurve()}
        comparatorCurve={makeComparatorCurve()}
      />,
    );
    expect(screen.getByTestId("kaplan-meier-plot")).toBeInTheDocument();
  });

  it("renders risk difference area when showRiskDifference is true", () => {
    render(
      <KaplanMeierPlot
        targetCurve={makeTargetCurve()}
        comparatorCurve={makeComparatorCurve()}
        showRiskDifference
      />,
    );
    expect(screen.getByTestId("risk-difference-area")).toBeInTheDocument();
  });

  it("does not render risk difference area by default", () => {
    render(
      <KaplanMeierPlot
        targetCurve={makeTargetCurve()}
        comparatorCurve={makeComparatorCurve()}
      />,
    );
    expect(screen.queryByTestId("risk-difference-area")).not.toBeInTheDocument();
  });

  it("renders RMST annotation when showRMST is true", () => {
    render(
      <KaplanMeierPlot
        targetCurve={makeTargetCurve()}
        comparatorCurve={makeComparatorCurve()}
        showRMST
      />,
    );
    expect(screen.getByTestId("rmst-annotation")).toBeInTheDocument();
  });

  it("does not render RMST annotation by default", () => {
    render(
      <KaplanMeierPlot
        targetCurve={makeTargetCurve()}
        comparatorCurve={makeComparatorCurve()}
      />,
    );
    expect(screen.queryByTestId("rmst-annotation")).not.toBeInTheDocument();
  });

  it("shows hover cursor on mouse move when interactive", () => {
    render(
      <KaplanMeierPlot
        targetCurve={makeTargetCurve()}
        comparatorCurve={makeComparatorCurve()}
        interactive
      />,
    );
    const svg = screen.getByTestId("kaplan-meier-plot");

    // Simulate mouse move over the plot area
    fireEvent.mouseMove(svg, { clientX: 200, clientY: 100 });
    // The hover cursor group should appear
    expect(screen.getByTestId("km-hover-cursor")).toBeInTheDocument();
  });

  it("hides hover cursor on mouse leave when interactive", () => {
    render(
      <KaplanMeierPlot
        targetCurve={makeTargetCurve()}
        comparatorCurve={makeComparatorCurve()}
        interactive
      />,
    );
    const svg = screen.getByTestId("kaplan-meier-plot");

    fireEvent.mouseMove(svg, { clientX: 200, clientY: 100 });
    expect(screen.getByTestId("km-hover-cursor")).toBeInTheDocument();

    fireEvent.mouseLeave(svg);
    expect(screen.queryByTestId("km-hover-cursor")).not.toBeInTheDocument();
  });

  it("hides confidence bands when showCI is false", () => {
    const { container } = render(
      <KaplanMeierPlot
        targetCurve={makeTargetCurve()}
        comparatorCurve={makeComparatorCurve()}
        showCI={false}
      />,
    );
    const svg = container.querySelector("svg")!;
    // CI bands are paths with opacity 0.08 - without showCI there should be none
    const paths = svg.querySelectorAll("path");
    const bandPaths = Array.from(paths).filter(
      (p) => p.getAttribute("opacity") === "0.08",
    );
    expect(bandPaths.length).toBe(0);
  });

  it("shows confidence bands by default (showCI defaults to true)", () => {
    const { container } = render(
      <KaplanMeierPlot
        targetCurve={makeTargetCurve()}
        comparatorCurve={makeComparatorCurve()}
      />,
    );
    const svg = container.querySelector("svg")!;
    const paths = svg.querySelectorAll("path");
    const bandPaths = Array.from(paths).filter(
      (p) => p.getAttribute("opacity") === "0.08",
    );
    // Two bands: target + comparator
    expect(bandPaths.length).toBe(2);
  });
});
