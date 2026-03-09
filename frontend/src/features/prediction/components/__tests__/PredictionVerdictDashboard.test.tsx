import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PredictionVerdictDashboard } from "../PredictionVerdictDashboard";
import type { PredictionResult } from "../../types/prediction";

function makeResult(overrides: Partial<PredictionResult> = {}): PredictionResult {
  return {
    summary: { target_count: 10000, outcome_count: 500, outcome_rate: 0.05 },
    performance: {
      auc: 0.85,
      auc_ci_lower: 0.82,
      auc_ci_upper: 0.88,
      brier_score: 0.04,
      calibration_slope: 1.0,
      calibration_intercept: 0.01,
    },
    top_predictors: [],
    roc_curve: [
      { fpr: 0, tpr: 0 },
      { fpr: 0.1, tpr: 0.5 },
      { fpr: 0.2, tpr: 0.7 },
      { fpr: 0.4, tpr: 0.85 },
      { fpr: 0.6, tpr: 0.92 },
      { fpr: 0.8, tpr: 0.96 },
      { fpr: 1, tpr: 1 },
    ],
    calibration: [
      { predicted: 0.1, observed: 0.09 },
      { predicted: 0.5, observed: 0.52 },
    ],
    net_benefit: [
      { threshold: 0.05, model: 0.04, treatAll: 0.03, treatNone: 0 },
      { threshold: 0.10, model: 0.035, treatAll: 0.02, treatNone: 0 },
      { threshold: 0.20, model: 0.025, treatAll: 0.005, treatNone: 0 },
    ],
    ...overrides,
  };
}

describe("PredictionVerdictDashboard", () => {
  it("renders the dashboard container", () => {
    render(<PredictionVerdictDashboard result={makeResult()} />);
    expect(screen.getByTestId("prediction-verdict-dashboard")).toBeInTheDocument();
  });

  it("shows 'Ready for validation' when AUC >= 0.8 and slope 0.8-1.2", () => {
    render(<PredictionVerdictDashboard result={makeResult()} />);
    expect(screen.getByText("Ready for validation")).toBeInTheDocument();
  });

  it("shows 'Needs recalibration' when AUC >= 0.7 but slope outside range", () => {
    const result = makeResult({
      performance: {
        auc: 0.75,
        auc_ci_lower: 0.70,
        auc_ci_upper: 0.80,
        brier_score: 0.06,
        calibration_slope: 1.5,
        calibration_intercept: 0.1,
      },
    });
    render(<PredictionVerdictDashboard result={result} />);
    expect(screen.getByText("Needs recalibration")).toBeInTheDocument();
  });

  it("shows 'Insufficient discrimination' when AUC < 0.7", () => {
    const result = makeResult({
      performance: {
        auc: 0.60,
        auc_ci_lower: 0.55,
        auc_ci_upper: 0.65,
        brier_score: 0.10,
        calibration_slope: 1.0,
        calibration_intercept: 0.0,
      },
    });
    render(<PredictionVerdictDashboard result={result} />);
    expect(screen.getByText("Insufficient discrimination")).toBeInTheDocument();
  });

  it("renders traffic light badges for discrimination and calibration", () => {
    render(<PredictionVerdictDashboard result={makeResult()} />);
    const badges = screen.getAllByTestId("traffic-light-badge");
    // At least 3: verdict badge, AUC badge, slope badge
    expect(badges.length).toBeGreaterThanOrEqual(3);
  });

  it("renders metric cards for AUC, calibration slope, and clinical utility", () => {
    render(<PredictionVerdictDashboard result={makeResult()} />);
    expect(screen.getByText("Discrimination (AUC)")).toBeInTheDocument();
    expect(screen.getByText("Calibration Slope")).toBeInTheDocument();
    expect(screen.getByText("Clinical Utility")).toBeInTheDocument();
  });

  it("renders the threshold slider", () => {
    render(<PredictionVerdictDashboard result={makeResult()} />);
    const slider = screen.getByTestId("threshold-slider");
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute("min", "0.01");
    expect(slider).toHaveAttribute("max", "0.50");
  });

  it("updates operating characteristics when threshold changes", () => {
    render(<PredictionVerdictDashboard result={makeResult()} />);
    const slider = screen.getByTestId("threshold-slider");

    // Change threshold
    fireEvent.change(slider, { target: { value: "0.30" } });

    // Operating point values should be rendered
    expect(screen.getByTestId("operating-sensitivity")).toBeInTheDocument();
    expect(screen.getByTestId("operating-specificity")).toBeInTheDocument();
    expect(screen.getByTestId("operating-ppv")).toBeInTheDocument();
    expect(screen.getByTestId("operating-npv")).toBeInTheDocument();
  });

  it("shows N/A for clinical utility when no net_benefit data", () => {
    const result = makeResult({ net_benefit: undefined });
    render(<PredictionVerdictDashboard result={result} />);
    const cards = screen.getAllByTestId("chart-metric-card");
    const clinicalCard = cards[2]; // Third card
    expect(clinicalCard).toHaveTextContent("N/A");
  });

  it("hides threshold selector when no ROC data", () => {
    const result = makeResult({ roc_curve: [] });
    render(<PredictionVerdictDashboard result={result} />);
    expect(screen.queryByTestId("threshold-slider")).not.toBeInTheDocument();
  });
});
