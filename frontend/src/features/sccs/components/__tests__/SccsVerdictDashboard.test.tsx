import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SccsVerdictDashboard, InlineMiniForestPlot } from "../SccsVerdictDashboard";
import type { SccsResult } from "../../types/sccs";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseResult: SccsResult = {
  status: "completed",
  estimates: [
    { covariate: "Exposure", irr: 2.45, ci_lower: 1.82, ci_upper: 3.30, log_rr: 0.896, se_log_rr: 0.152 },
    { covariate: "Age", irr: 1.01, ci_lower: 0.98, ci_upper: 1.04, log_rr: 0.01, se_log_rr: 0.015 },
  ],
  population: { cases: 500, outcomes: 620, observation_periods: 1200 },
  eras: [
    { era_name: "Pre-exposure", era_type: "pre-exposure", start_day: -30, end_day: -1, event_count: 12, person_days: 5000, irr: 1.1, ci_lower: 0.8, ci_upper: 1.5 },
    { era_name: "Exposure window", era_type: "exposure", start_day: 0, end_day: 28, event_count: 45, person_days: 4000, irr: 2.45, ci_lower: 1.82, ci_upper: 3.30 },
    { era_name: "Post-exposure", era_type: "post-exposure", start_day: 29, end_day: 60, event_count: 18, person_days: 5200, irr: 1.3, ci_lower: 0.9, ci_upper: 1.8 },
    { era_name: "Control", era_type: "control", start_day: 61, end_day: 365, event_count: 80, person_days: 50000, irr: 1.0, ci_lower: 0.85, ci_upper: 1.18 },
  ],
};

const resultNoEras: SccsResult = {
  status: "completed",
  estimates: [
    { covariate: "Drug X", irr: 0.75, ci_lower: 0.55, ci_upper: 0.98, log_rr: -0.288, se_log_rr: 0.148 },
  ],
  population: { cases: 200, outcomes: 250, observation_periods: 400 },
};

const resultPreExposureFail: SccsResult = {
  ...baseResult,
  eras: [
    { era_name: "Pre-exposure", era_type: "pre-exposure", start_day: -30, end_day: -1, event_count: 30, person_days: 3000, irr: 2.0, ci_lower: 1.4, ci_upper: 2.9 },
    { era_name: "Exposure", era_type: "exposure", start_day: 0, end_day: 28, event_count: 45, person_days: 4000, irr: 2.45, ci_lower: 1.82, ci_upper: 3.30 },
    { era_name: "Control", era_type: "control", start_day: 29, end_day: 365, event_count: 80, person_days: 50000, irr: 0.6, ci_lower: 0.4, ci_upper: 0.8 },
  ],
};

// ---------------------------------------------------------------------------
// SccsVerdictDashboard
// ---------------------------------------------------------------------------

describe("SccsVerdictDashboard", () => {
  it("renders the dashboard wrapper", () => {
    render(<SccsVerdictDashboard result={baseResult} />);
    expect(screen.getByTestId("sccs-verdict-dashboard")).toBeInTheDocument();
  });

  it("displays primary exposure IRR", () => {
    render(<SccsVerdictDashboard result={baseResult} />);
    expect(screen.getByTestId("primary-irr")).toHaveTextContent("2.45");
  });

  it("shows direction arrow for elevated IRR", () => {
    render(<SccsVerdictDashboard result={baseResult} />);
    // Up arrow for IRR > 1
    expect(screen.getByTestId("direction-arrow")).toHaveTextContent("\u2191");
  });

  it("shows significance verdict badge for significant result", () => {
    render(<SccsVerdictDashboard result={baseResult} />);
    expect(screen.getByTestId("significance-verdict")).toHaveTextContent("Statistically Significant");
  });

  it("shows excess risk value", () => {
    render(<SccsVerdictDashboard result={baseResult} />);
    expect(screen.getByTestId("excess-risk")).toBeInTheDocument();
  });

  it("shows PASS badge when pre-exposure IRR <= 1.5", () => {
    render(<SccsVerdictDashboard result={baseResult} />);
    expect(screen.getByTestId("pre-exposure-badge")).toHaveTextContent("PASS");
  });

  it("shows FAIL badge when pre-exposure IRR > 1.5", () => {
    render(<SccsVerdictDashboard result={resultPreExposureFail} />);
    expect(screen.getByTestId("pre-exposure-badge")).toHaveTextContent("FAIL");
  });

  it("shows control period IRR", () => {
    render(<SccsVerdictDashboard result={baseResult} />);
    expect(screen.getByTestId("control-irr")).toHaveTextContent("1.00");
  });

  it("flags control period deviation from 1.0", () => {
    render(<SccsVerdictDashboard result={resultPreExposureFail} />);
    const controlIrr = screen.getByTestId("control-irr");
    expect(controlIrr).toHaveTextContent("0.60");
    expect(controlIrr).toHaveTextContent("misspecification");
  });

  it("renders multi-window comparison strip when eras exist", () => {
    render(<SccsVerdictDashboard result={baseResult} />);
    expect(screen.getByTestId("multi-window-strip")).toBeInTheDocument();
  });

  it("does not render multi-window strip when no eras", () => {
    render(<SccsVerdictDashboard result={resultNoEras} />);
    expect(screen.queryByTestId("multi-window-strip")).not.toBeInTheDocument();
  });

  it("renders window blocks for each era", () => {
    render(<SccsVerdictDashboard result={baseResult} />);
    expect(screen.getByTestId("window-block-pre-exposure")).toBeInTheDocument();
    expect(screen.getByTestId("window-block-exposure")).toBeInTheDocument();
    expect(screen.getByTestId("window-block-post-exposure")).toBeInTheDocument();
    expect(screen.getByTestId("window-block-control")).toBeInTheDocument();
  });

  it("handles result with no exposure era gracefully", () => {
    const noExposure: SccsResult = {
      status: "completed",
      estimates: [],
      population: { cases: 10, outcomes: 12, observation_periods: 20 },
      eras: [
        { era_name: "Control", era_type: "control", start_day: 0, end_day: 365, event_count: 5, person_days: 1000 },
      ],
    };
    render(<SccsVerdictDashboard result={noExposure} />);
    expect(screen.getByTestId("risk-window-summary")).toBeInTheDocument();
    expect(screen.getByText("No exposure era with IRR data available.")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// InlineMiniForestPlot
// ---------------------------------------------------------------------------

describe("InlineMiniForestPlot", () => {
  it("renders an SVG element", () => {
    const { container } = render(
      <InlineMiniForestPlot irr={2.0} ciLower={1.5} ciUpper={3.0} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("width")).toBe("120");
  });

  it("renders without CI bounds", () => {
    const { container } = render(<InlineMiniForestPlot irr={1.5} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    // Should have point estimate circle but no CI lines
    const circles = svg?.querySelectorAll("circle");
    expect(circles?.length).toBe(1);
  });

  it("renders CI whisker lines when bounds provided", () => {
    const { container } = render(
      <InlineMiniForestPlot irr={0.8} ciLower={0.5} ciUpper={1.1} />,
    );
    const svg = container.querySelector("svg");
    // Reference line + CI line + 2 caps = 4 lines total minimum
    const lines = svg?.querySelectorAll("line");
    expect(lines?.length).toBeGreaterThanOrEqual(4);
  });
});
