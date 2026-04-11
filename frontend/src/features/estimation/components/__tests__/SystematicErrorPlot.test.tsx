import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SystematicErrorPlot } from "../SystematicErrorPlot";

function makeNegativeControls() {
  return [
    {
      outcome_name: "NC1",
      log_rr: 0.1,
      se_log_rr: 0.2,
      ci_95_lower: -0.3,
      ci_95_upper: 0.5,
    },
    {
      outcome_name: "NC2",
      log_rr: -0.05,
      se_log_rr: 0.15,
      ci_95_lower: -0.35,
      ci_95_upper: 0.25,
    },
  ];
}

function makeNegativeControlsWithCalibration() {
  return [
    {
      outcome_name: "NC1",
      log_rr: 0.1,
      se_log_rr: 0.2,
      calibrated_log_rr: 0.03,
      calibrated_se_log_rr: 0.12,
      ci_95_lower: -0.3,
      ci_95_upper: 0.5,
    },
    {
      outcome_name: "NC2",
      log_rr: -0.05,
      se_log_rr: 0.15,
      calibrated_log_rr: -0.02,
      calibrated_se_log_rr: 0.10,
      ci_95_lower: -0.35,
      ci_95_upper: 0.25,
    },
  ];
}

describe("SystematicErrorPlot", () => {
  it("renders an SVG element", () => {
    render(<SystematicErrorPlot negativeControls={makeNegativeControls()} />);
    expect(screen.getByTestId("systematic-error-plot")).toBeInTheDocument();
  });

  it("returns null for empty negative controls", () => {
    const { container } = render(
      <SystematicErrorPlot negativeControls={[]} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders filled data circles by default (no calibration)", () => {
    render(<SystematicErrorPlot negativeControls={makeNegativeControls()} />);
    const svg = screen.getByTestId("systematic-error-plot");
    const circles = svg.querySelectorAll("circle");
    // NC data circles have fill="var(--success)" and r=4 (legend circles have r=3)
    const dataCircles = Array.from(circles).filter(
      (c) => c.getAttribute("r") === "4" && c.getAttribute("fill") !== "none",
    );
    expect(dataCircles.length).toBe(2);
  });

  it("renders open circles for originals when showCalibration is true", () => {
    render(
      <SystematicErrorPlot
        negativeControls={makeNegativeControlsWithCalibration()}
        showCalibration
      />,
    );
    const svg = screen.getByTestId("systematic-error-plot");
    // Original NC data circles (r=4) should have fill="none"
    const openDataCircles = Array.from(svg.querySelectorAll("circle")).filter(
      (c) => c.getAttribute("r") === "4" && c.getAttribute("fill") === "none",
    );
    expect(openDataCircles.length).toBe(2);
  });

  it("renders calibrated points when showCalibration is true", () => {
    render(
      <SystematicErrorPlot
        negativeControls={makeNegativeControlsWithCalibration()}
        showCalibration
      />,
    );
    const calibratedPoints = screen.getAllByTestId("calibrated-point");
    expect(calibratedPoints.length).toBe(2);
  });

  it("renders calibration arrows when showCalibration is true", () => {
    render(
      <SystematicErrorPlot
        negativeControls={makeNegativeControlsWithCalibration()}
        showCalibration
      />,
    );
    const arrows = screen.getAllByTestId("calibration-arrow");
    expect(arrows.length).toBe(2);
  });

  it("does not render calibration when showCalibration is false", () => {
    render(
      <SystematicErrorPlot
        negativeControls={makeNegativeControlsWithCalibration()}
        showCalibration={false}
      />,
    );
    expect(screen.queryByTestId("calibrated-point")).not.toBeInTheDocument();
    expect(screen.queryByTestId("calibration-arrow")).not.toBeInTheDocument();
  });

  it("shows Pre-calibration / Post-calibration legend when calibrated", () => {
    render(
      <SystematicErrorPlot
        negativeControls={makeNegativeControlsWithCalibration()}
        showCalibration
      />,
    );
    const svg = screen.getByTestId("systematic-error-plot");
    const texts = Array.from(svg.querySelectorAll("text")).map(
      (t) => t.textContent,
    );
    expect(texts.some((t) => t?.includes("Pre-calibration"))).toBe(true);
    expect(texts.some((t) => t?.includes("Post-calibration"))).toBe(true);
  });

  it("shows Negative Controls legend when not calibrated", () => {
    render(<SystematicErrorPlot negativeControls={makeNegativeControls()} />);
    const svg = screen.getByTestId("systematic-error-plot");
    const texts = Array.from(svg.querySelectorAll("text")).map(
      (t) => t.textContent,
    );
    expect(texts.some((t) => t?.includes("Negative Controls (2)"))).toBe(true);
  });
});
