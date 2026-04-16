import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PredictionVerdictDashboard } from "../PredictionVerdictDashboard";
import type { PredictionResult } from "../../types/prediction";

// ---------------------------------------------------------------------------
// Realistic fixtures matching Darkstar PatientLevelPrediction output
// ---------------------------------------------------------------------------

/** Good model: Lasso logistic regression for 1-year MI risk prediction */
const goodModelResult: PredictionResult = {
  summary: {
    target_count: 45000,
    outcome_count: 2250,
    outcome_rate: 0.05,
  },
  performance: {
    auc: 0.82,
    auc_ci_lower: 0.79,
    auc_ci_upper: 0.85,
    brier_score: 0.038,
    calibration_slope: 1.05,
    calibration_intercept: -0.02,
    auprc: 0.31,
  },
  top_predictors: [
    { covariate_name: "Age", coefficient: 0.045, importance: 0.18 },
    { covariate_name: "Prior MI", coefficient: 1.82, importance: 0.15 },
    { covariate_name: "Diabetes mellitus", coefficient: 0.92, importance: 0.12 },
    { covariate_name: "Systolic BP > 160", coefficient: 0.78, importance: 0.10 },
    { covariate_name: "LDL cholesterol > 190", coefficient: 0.65, importance: 0.08 },
    { covariate_name: "Current smoker", coefficient: 0.55, importance: 0.07 },
    { covariate_name: "Male sex", coefficient: 0.42, importance: 0.06 },
    { covariate_name: "BMI > 30", coefficient: 0.38, importance: 0.05 },
    { covariate_name: "Statin use", coefficient: -0.72, importance: 0.04 },
    { covariate_name: "ACE inhibitor use", coefficient: -0.48, importance: 0.03 },
  ],
  roc_curve: [
    { fpr: 0.00, tpr: 0.00 },
    { fpr: 0.02, tpr: 0.15 },
    { fpr: 0.05, tpr: 0.32 },
    { fpr: 0.10, tpr: 0.52 },
    { fpr: 0.15, tpr: 0.65 },
    { fpr: 0.20, tpr: 0.73 },
    { fpr: 0.30, tpr: 0.82 },
    { fpr: 0.40, tpr: 0.88 },
    { fpr: 0.50, tpr: 0.92 },
    { fpr: 0.60, tpr: 0.95 },
    { fpr: 0.70, tpr: 0.97 },
    { fpr: 0.80, tpr: 0.98 },
    { fpr: 0.90, tpr: 0.99 },
    { fpr: 1.00, tpr: 1.00 },
  ],
  calibration: [
    { predicted: 0.01, observed: 0.009 },
    { predicted: 0.02, observed: 0.021 },
    { predicted: 0.03, observed: 0.028 },
    { predicted: 0.05, observed: 0.048 },
    { predicted: 0.07, observed: 0.072 },
    { predicted: 0.10, observed: 0.098 },
    { predicted: 0.15, observed: 0.155 },
    { predicted: 0.20, observed: 0.195 },
    { predicted: 0.30, observed: 0.310 },
    { predicted: 0.50, observed: 0.480 },
  ],
  net_benefit: [
    { threshold: 0.01, model: 0.048, treatAll: 0.040, treatNone: 0 },
    { threshold: 0.02, model: 0.045, treatAll: 0.030, treatNone: 0 },
    { threshold: 0.05, model: 0.038, treatAll: 0.000, treatNone: 0 },
    { threshold: 0.10, model: 0.028, treatAll: -0.050, treatNone: 0 },
    { threshold: 0.20, model: 0.015, treatAll: -0.188, treatNone: 0 },
    { threshold: 0.30, model: 0.008, treatAll: -0.357, treatNone: 0 },
    { threshold: 0.50, model: 0.002, treatAll: -0.900, treatNone: 0 },
  ],
  discrimination: {
    outcome_group: { min: 0.01, q1: 0.06, median: 0.12, q3: 0.22, max: 0.85, mean: 0.15 },
    no_outcome_group: { min: 0.00, q1: 0.01, median: 0.03, q3: 0.06, max: 0.65, mean: 0.04 },
  },
};

/** Poor model: AUC < 0.7 — gradient boosting on sparse features */
const poorModelResult: PredictionResult = {
  summary: {
    target_count: 8000,
    outcome_count: 320,
    outcome_rate: 0.04,
  },
  performance: {
    auc: 0.63,
    auc_ci_lower: 0.58,
    auc_ci_upper: 0.68,
    brier_score: 0.042,
    calibration_slope: 0.55,
    calibration_intercept: 0.15,
  },
  top_predictors: [
    { covariate_name: "Age", coefficient: 0.02, importance: 0.08 },
    { covariate_name: "Prior hospitalization", coefficient: 0.35, importance: 0.06 },
  ],
  roc_curve: [
    { fpr: 0.00, tpr: 0.00 },
    { fpr: 0.10, tpr: 0.20 },
    { fpr: 0.20, tpr: 0.35 },
    { fpr: 0.30, tpr: 0.48 },
    { fpr: 0.40, tpr: 0.58 },
    { fpr: 0.50, tpr: 0.65 },
    { fpr: 0.60, tpr: 0.72 },
    { fpr: 0.70, tpr: 0.80 },
    { fpr: 0.80, tpr: 0.88 },
    { fpr: 0.90, tpr: 0.95 },
    { fpr: 1.00, tpr: 1.00 },
  ],
  calibration: [
    { predicted: 0.02, observed: 0.04 },
    { predicted: 0.05, observed: 0.06 },
    { predicted: 0.10, observed: 0.08 },
  ],
};

/** Needs recalibration: AUC >= 0.7 but slope outside 0.8-1.2 */
const recalibrateResult: PredictionResult = {
  summary: {
    target_count: 20000,
    outcome_count: 1200,
    outcome_rate: 0.06,
  },
  performance: {
    auc: 0.78,
    auc_ci_lower: 0.75,
    auc_ci_upper: 0.81,
    brier_score: 0.052,
    calibration_slope: 1.45,
    calibration_intercept: -0.12,
  },
  top_predictors: [],
  roc_curve: [
    { fpr: 0.00, tpr: 0.00 },
    { fpr: 0.10, tpr: 0.40 },
    { fpr: 0.30, tpr: 0.70 },
    { fpr: 0.50, tpr: 0.85 },
    { fpr: 0.70, tpr: 0.93 },
    { fpr: 1.00, tpr: 1.00 },
  ],
  calibration: [
    { predicted: 0.05, observed: 0.03 },
    { predicted: 0.10, observed: 0.07 },
    { predicted: 0.20, observed: 0.15 },
  ],
  net_benefit: [
    { threshold: 0.05, model: 0.035, treatAll: 0.005, treatNone: 0 },
    { threshold: 0.10, model: 0.030, treatAll: -0.040, treatNone: 0 },
    { threshold: 0.20, model: 0.018, treatAll: -0.175, treatNone: 0 },
  ],
};

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe("PredictionVerdictDashboard Integration", () => {
  describe("good model (AUC >= 0.8, slope 0.8-1.2)", () => {
    it("renders the dashboard container", () => {
      render(<PredictionVerdictDashboard result={goodModelResult} />);
      expect(screen.getByTestId("prediction-verdict-dashboard")).toBeInTheDocument();
    });

    it("shows Ready for validation verdict", () => {
      render(<PredictionVerdictDashboard result={goodModelResult} />);
      expect(screen.getByText("Ready for validation")).toBeInTheDocument();
    });

    it("renders traffic light badges at correct levels", () => {
      render(<PredictionVerdictDashboard result={goodModelResult} />);
      const badges = screen.getAllByTestId("traffic-light-badge");
      // At least 3: verdict badge, AUC badge, slope badge
      expect(badges.length).toBeGreaterThanOrEqual(3);
      expect(screen.getByText("Good")).toBeInTheDocument();
      expect(screen.getByText("Well calibrated")).toBeInTheDocument();
    });

    it("renders AUC metric card with value and CI", () => {
      render(<PredictionVerdictDashboard result={goodModelResult} />);
      expect(screen.getByText("Discrimination (AUC)")).toBeInTheDocument();
      // AUC value 0.82
      expect(screen.getByText("0.820")).toBeInTheDocument();
      // CI range from subValue
      expect(screen.getByText("0.790 - 0.850")).toBeInTheDocument();
    });

    it("renders calibration slope metric card", () => {
      render(<PredictionVerdictDashboard result={goodModelResult} />);
      expect(screen.getByText("Calibration Slope")).toBeInTheDocument();
      expect(screen.getByText("1.050")).toBeInTheDocument();
    });

    it("renders clinical utility with net benefit at default threshold", () => {
      render(<PredictionVerdictDashboard result={goodModelResult} />);
      expect(screen.getByText("Clinical Utility")).toBeInTheDocument();
      // Default threshold is 0.10 => net benefit = 0.028
      expect(screen.getByText("0.0280")).toBeInTheDocument();
    });

    it("renders threshold slider with correct range", () => {
      render(<PredictionVerdictDashboard result={goodModelResult} />);
      const slider = screen.getByTestId("threshold-slider");
      expect(slider).toHaveAttribute("min", "0.01");
      expect(slider).toHaveAttribute("max", "0.50");
    });

    it("updates operating characteristics when threshold changes", () => {
      render(<PredictionVerdictDashboard result={goodModelResult} />);
      const slider = screen.getByTestId("threshold-slider");

      fireEvent.change(slider, { target: { value: "0.20" } });

      expect(screen.getByTestId("operating-sensitivity")).toBeInTheDocument();
      expect(screen.getByTestId("operating-specificity")).toBeInTheDocument();
      expect(screen.getByTestId("operating-ppv")).toBeInTheDocument();
      expect(screen.getByTestId("operating-npv")).toBeInTheDocument();
    });
  });

  describe("poor model (AUC < 0.7)", () => {
    it("shows Insufficient discrimination verdict", () => {
      render(<PredictionVerdictDashboard result={poorModelResult} />);
      expect(screen.getByText("Insufficient discrimination")).toBeInTheDocument();
    });

    it("renders AUC value of 0.63", () => {
      render(<PredictionVerdictDashboard result={poorModelResult} />);
      expect(screen.getByText("0.630")).toBeInTheDocument();
    });

    it("shows N/A for clinical utility when no net_benefit data", () => {
      render(<PredictionVerdictDashboard result={poorModelResult} />);
      const cards = screen.getAllByTestId("chart-metric-card");
      const clinicalCard = cards[2];
      expect(clinicalCard).toHaveTextContent("N/A");
    });
  });

  describe("needs recalibration (AUC >= 0.7, slope outside 0.8-1.2)", () => {
    it("shows Needs recalibration verdict", () => {
      render(<PredictionVerdictDashboard result={recalibrateResult} />);
      expect(screen.getByText("Needs recalibration")).toBeInTheDocument();
    });

    it("renders AUC value from API response", () => {
      render(<PredictionVerdictDashboard result={recalibrateResult} />);
      expect(screen.getByText("0.780")).toBeInTheDocument();
    });

    it("renders calibration slope value from API response", () => {
      render(<PredictionVerdictDashboard result={recalibrateResult} />);
      expect(screen.getByText("1.450")).toBeInTheDocument();
    });
  });
});
