import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ForestPlot } from "../ForestPlot";
import type { EstimateEntry } from "../../types/estimation";

function makeEstimates(): (EstimateEntry & { weight?: number })[] {
  return [
    {
      outcome_id: 1,
      outcome_name: "MI",
      hazard_ratio: 0.72,
      ci_95_lower: 0.55,
      ci_95_upper: 0.91,
      p_value: 0.008,
      log_hr: -0.33,
      se_log_hr: 0.12,
      target_outcomes: 45,
      comparator_outcomes: 75,
    },
    {
      outcome_id: 2,
      outcome_name: "Stroke",
      hazard_ratio: 1.15,
      ci_95_lower: 0.85,
      ci_95_upper: 1.55,
      p_value: 0.37,
      log_hr: 0.14,
      se_log_hr: 0.15,
      target_outcomes: 30,
      comparator_outcomes: 25,
    },
  ];
}

describe("ForestPlot", () => {
  it("renders an SVG element", () => {
    render(<ForestPlot estimates={makeEstimates()} />);
    expect(screen.getByTestId("forest-plot")).toBeInTheDocument();
  });

  it("returns null for empty estimates", () => {
    const { container } = render(<ForestPlot estimates={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders wider SVG when showNNT is true", () => {
    render(<ForestPlot estimates={makeEstimates()} showNNT />);
    const svg = screen.getByTestId("forest-plot");
    expect(Number(svg.getAttribute("width"))).toBe(880);
  });

  it("renders NNT/NNH labels when showNNT is true", () => {
    render(<ForestPlot estimates={makeEstimates()} showNNT />);
    const svg = screen.getByTestId("forest-plot");
    // Should have NNT/NNH header text
    const texts = svg.querySelectorAll("text");
    const nntHeader = Array.from(texts).find(
      (t) => t.textContent === "NNT/NNH",
    );
    expect(nntHeader).toBeDefined();
  });

  it("renders prediction interval on last row when provided", () => {
    render(
      <ForestPlot
        estimates={makeEstimates()}
        predictionInterval={{ lower: 0.3, upper: 2.5 }}
      />,
    );
    expect(screen.getByTestId("prediction-interval")).toBeInTheDocument();
    const line = screen.getByTestId("prediction-interval");
    expect(line.getAttribute("stroke-dasharray")).toBe("6 3");
  });

  it("renders squares instead of diamonds when estimates have weights", () => {
    const estimates = makeEstimates().map((e, i) => ({
      ...e,
      weight: (i + 1) * 10,
    }));
    render(<ForestPlot estimates={estimates} />);
    const svg = screen.getByTestId("forest-plot");
    // Should have rect elements for weighted point estimates (not polygons for data)
    const rects = svg.querySelectorAll("rect");
    // Background rects + boundary + data rects = at least 2 data rects
    const dataRects = Array.from(rects).filter(
      (r) =>
        r.getAttribute("fill") === "#2DD4BF" ||
        r.getAttribute("fill") === "#E85A6B" ||
        r.getAttribute("fill") === "#8A857D",
    );
    expect(dataRects.length).toBe(2);
  });

  it("renders default width when showNNT is false", () => {
    render(<ForestPlot estimates={makeEstimates()} />);
    const svg = screen.getByTestId("forest-plot");
    expect(Number(svg.getAttribute("width"))).toBe(800);
  });
});
