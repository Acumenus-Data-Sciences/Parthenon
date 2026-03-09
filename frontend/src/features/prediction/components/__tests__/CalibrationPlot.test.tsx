import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalibrationPlot } from "../CalibrationPlot";

const sampleData = [
  { predicted: 0.1, observed: 0.08 },
  { predicted: 0.2, observed: 0.22 },
  { predicted: 0.3, observed: 0.28 },
  { predicted: 0.5, observed: 0.53 },
  { predicted: 0.7, observed: 0.68 },
  { predicted: 0.9, observed: 0.85 },
];

describe("CalibrationPlot", () => {
  it("renders the SVG", () => {
    render(<CalibrationPlot data={sampleData} slope={1.0} intercept={0.0} />);
    expect(screen.getByTestId("calibration-plot-svg")).toBeInTheDocument();
  });

  it("displays ICI and E-max annotations", () => {
    render(<CalibrationPlot data={sampleData} slope={1.0} intercept={0.0} />);
    expect(screen.getByTestId("ici-emax-annotation")).toBeInTheDocument();
    expect(screen.getByTestId("ici-value")).toBeInTheDocument();
    expect(screen.getByTestId("emax-value")).toBeInTheDocument();
  });

  it("computes ICI as mean absolute difference", () => {
    // |0.08-0.1|=0.02, |0.22-0.2|=0.02, |0.28-0.3|=0.02, |0.53-0.5|=0.03, |0.68-0.7|=0.02, |0.85-0.9|=0.05
    // Mean = (0.02+0.02+0.02+0.03+0.02+0.05)/6 = 0.16/6 ≈ 0.0267
    render(<CalibrationPlot data={sampleData} slope={1.0} intercept={0.0} />);
    const ici = screen.getByTestId("ici-value");
    expect(ici.textContent).toContain("ICI:");
    expect(ici.textContent).toContain("0.02"); // Starts with 0.02
  });

  it("computes E-max as max absolute difference", () => {
    // Max is |0.85-0.9| = 0.05
    render(<CalibrationPlot data={sampleData} slope={1.0} intercept={0.0} />);
    const emax = screen.getByTestId("emax-value");
    expect(emax.textContent).toContain("E-max:");
    expect(emax.textContent).toContain("0.05");
  });

  it("renders decile population bars", () => {
    render(<CalibrationPlot data={sampleData} slope={1.0} intercept={0.0} />);
    expect(screen.getByTestId("decile-bars")).toBeInTheDocument();
  });

  it("shows slope and intercept", () => {
    render(<CalibrationPlot data={sampleData} slope={0.95} intercept={0.02} />);
    expect(screen.getByText(/Slope: 0\.950/)).toBeInTheDocument();
    expect(screen.getByText(/Intercept: 0\.020/)).toBeInTheDocument();
  });

  it("handles empty data gracefully", () => {
    render(<CalibrationPlot data={[]} slope={1.0} intercept={0.0} />);
    expect(screen.getByTestId("calibration-plot-svg")).toBeInTheDocument();
  });
});
