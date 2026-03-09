import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EstimationVerdictDashboard } from "../EstimationVerdictDashboard";
import type { EstimationResult } from "../../types/estimation";

function makeResult(overrides: Partial<EstimationResult> = {}): EstimationResult {
  return {
    summary: {
      target_count: 5000,
      comparator_count: 5000,
      outcome_counts: { "MI": 120 },
    },
    estimates: [
      {
        outcome_id: 1,
        outcome_name: "Myocardial Infarction",
        hazard_ratio: 0.72,
        ci_95_lower: 0.55,
        ci_95_upper: 0.91,
        p_value: 0.008,
        log_hr: -0.3285,
        se_log_hr: 0.12,
        target_outcomes: 45,
        comparator_outcomes: 75,
      },
    ],
    ...overrides,
  };
}

describe("EstimationVerdictDashboard", () => {
  it("renders the dashboard container", () => {
    render(<EstimationVerdictDashboard result={makeResult()} />);
    expect(screen.getByTestId("estimation-verdict-dashboard")).toBeInTheDocument();
  });

  it("displays the HR value", () => {
    render(<EstimationVerdictDashboard result={makeResult()} />);
    expect(screen.getByTestId("verdict-hr-value")).toHaveTextContent("0.72");
  });

  it("displays significance verdict badge", () => {
    render(<EstimationVerdictDashboard result={makeResult()} />);
    expect(screen.getByTestId("significance-verdict-badge")).toBeInTheDocument();
    expect(screen.getByTestId("significance-verdict-badge")).toHaveTextContent(
      "Significant protective effect",
    );
  });

  it("renders CI bar", () => {
    render(<EstimationVerdictDashboard result={makeResult()} />);
    expect(screen.getByTestId("ci-bar")).toBeInTheDocument();
  });

  it("renders metric cards for target and comparator counts", () => {
    render(<EstimationVerdictDashboard result={makeResult()} />);
    const cards = screen.getAllByTestId("chart-metric-card");
    expect(cards.length).toBe(4);
  });

  it("returns null when no estimates are present", () => {
    const { container } = render(
      <EstimationVerdictDashboard result={makeResult({ estimates: [] })} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("displays harmful verdict for HR > 1", () => {
    const result = makeResult({
      estimates: [
        {
          outcome_id: 1,
          outcome_name: "GI Bleed",
          hazard_ratio: 1.85,
          ci_95_lower: 1.30,
          ci_95_upper: 2.60,
          p_value: 0.001,
          log_hr: 0.615,
          se_log_hr: 0.18,
          target_outcomes: 90,
          comparator_outcomes: 50,
        },
      ],
    });
    render(<EstimationVerdictDashboard result={result} />);
    expect(screen.getByTestId("significance-verdict-badge")).toHaveTextContent(
      "Significant harmful effect",
    );
  });

  it("shows NNT/NNH as N/A when KM data is absent", () => {
    render(<EstimationVerdictDashboard result={makeResult()} />);
    const cards = screen.getAllByTestId("chart-metric-card");
    // The 4th card is NNT/NNH
    expect(cards[3]).toHaveTextContent("N/A");
  });

  it("shows NNT when KM data is present and target survival > comparator", () => {
    const result = makeResult({
      kaplan_meier: {
        target: [
          { time: 0, survival: 1.0, lower: 0.98, upper: 1.0 },
          { time: 365, survival: 0.85, lower: 0.80, upper: 0.90 },
        ],
        comparator: [
          { time: 0, survival: 1.0, lower: 0.98, upper: 1.0 },
          { time: 365, survival: 0.75, lower: 0.70, upper: 0.80 },
        ],
      },
    });
    render(<EstimationVerdictDashboard result={result} />);
    const cards = screen.getAllByTestId("chart-metric-card");
    expect(cards[3]).toHaveTextContent("NNT");
    expect(cards[3]).toHaveTextContent("10"); // 1/(0.85-0.75)=10
  });

  it("shows calibrated p-value when negative controls have calibrated data", () => {
    const result = makeResult({
      negative_controls: [
        {
          outcome_name: "NC1",
          log_rr: 0.1,
          se_log_rr: 0.2,
          calibrated_log_rr: 0.05,
          calibrated_se_log_rr: 0.15,
          ci_95_lower: -0.3,
          ci_95_upper: 0.5,
        },
      ],
    });
    render(<EstimationVerdictDashboard result={result} />);
    expect(screen.getByTestId("calibrated-p")).toBeInTheDocument();
  });
});
