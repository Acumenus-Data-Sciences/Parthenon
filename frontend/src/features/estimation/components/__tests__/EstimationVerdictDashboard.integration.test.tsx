import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EstimationVerdictDashboard } from "../EstimationVerdictDashboard";
import type { EstimationResult } from "../../types/estimation";

// ---------------------------------------------------------------------------
// Realistic fixtures matching Darkstar CohortMethod output structure
// ---------------------------------------------------------------------------

/** Complete estimation result: ACE inhibitors vs ARBs for MI — protective effect */
const completeApiResponse: EstimationResult = {
  summary: {
    target_count: 12847,
    comparator_count: 11923,
    outcome_counts: { "Myocardial Infarction": 342, "Stroke": 198 },
  },
  estimates: [
    {
      outcome_id: 101,
      outcome_name: "Myocardial Infarction",
      hazard_ratio: 0.74,
      ci_95_lower: 0.59,
      ci_95_upper: 0.93,
      p_value: 0.009,
      log_hr: -0.301,
      se_log_hr: 0.116,
      target_outcomes: 142,
      comparator_outcomes: 200,
    },
    {
      outcome_id: 102,
      outcome_name: "Stroke",
      hazard_ratio: 0.88,
      ci_95_lower: 0.65,
      ci_95_upper: 1.19,
      p_value: 0.41,
      log_hr: -0.128,
      se_log_hr: 0.155,
      target_outcomes: 89,
      comparator_outcomes: 109,
    },
  ],
  propensity_score: {
    auc: 0.73,
    equipoise: 0.82,
    mean_smd_before: 0.14,
    mean_smd_after: 0.02,
    max_smd_before: 0.42,
    max_smd_after: 0.06,
    distribution: {
      target: [
        { x: 0.0, y: 0.8 },
        { x: 0.1, y: 2.3 },
        { x: 0.2, y: 4.1 },
        { x: 0.3, y: 5.6 },
        { x: 0.4, y: 6.2 },
        { x: 0.5, y: 5.8 },
        { x: 0.6, y: 4.5 },
        { x: 0.7, y: 3.1 },
        { x: 0.8, y: 1.7 },
        { x: 0.9, y: 0.6 },
        { x: 1.0, y: 0.1 },
      ],
      comparator: [
        { x: 0.0, y: 0.2 },
        { x: 0.1, y: 1.1 },
        { x: 0.2, y: 2.8 },
        { x: 0.3, y: 4.9 },
        { x: 0.4, y: 6.5 },
        { x: 0.5, y: 6.1 },
        { x: 0.6, y: 4.8 },
        { x: 0.7, y: 3.3 },
        { x: 0.8, y: 1.9 },
        { x: 0.9, y: 0.8 },
        { x: 1.0, y: 0.2 },
      ],
    },
  },
  kaplan_meier: {
    target: [
      { time: 0, survival: 1.0, lower: 0.99, upper: 1.0 },
      { time: 30, survival: 0.98, lower: 0.97, upper: 0.99 },
      { time: 90, survival: 0.96, lower: 0.95, upper: 0.97 },
      { time: 180, survival: 0.93, lower: 0.91, upper: 0.95 },
      { time: 365, survival: 0.89, lower: 0.87, upper: 0.91 },
    ],
    comparator: [
      { time: 0, survival: 1.0, lower: 0.99, upper: 1.0 },
      { time: 30, survival: 0.97, lower: 0.96, upper: 0.98 },
      { time: 90, survival: 0.94, lower: 0.92, upper: 0.96 },
      { time: 180, survival: 0.90, lower: 0.88, upper: 0.92 },
      { time: 365, survival: 0.84, lower: 0.81, upper: 0.87 },
    ],
  },
  covariate_balance: [
    {
      covariate_name: "Age group: 65-74",
      smd_before: 0.15,
      smd_after: 0.02,
      mean_target_before: 0.32,
      mean_comp_before: 0.25,
      mean_target_after: 0.30,
      mean_comp_after: 0.29,
    },
    {
      covariate_name: "Diabetes mellitus",
      smd_before: 0.22,
      smd_after: 0.03,
      mean_target_before: 0.41,
      mean_comp_before: 0.30,
      mean_target_after: 0.38,
      mean_comp_after: 0.37,
    },
    {
      covariate_name: "Prior MI",
      smd_before: 0.08,
      smd_after: 0.01,
      mean_target_before: 0.12,
      mean_comp_before: 0.10,
      mean_target_after: 0.11,
      mean_comp_after: 0.11,
    },
  ],
  negative_controls: [
    {
      outcome_name: "Ingrown toenail",
      log_rr: 0.02,
      se_log_rr: 0.18,
      calibrated_log_rr: 0.01,
      calibrated_se_log_rr: 0.12,
      ci_95_lower: -0.33,
      ci_95_upper: 0.37,
    },
    {
      outcome_name: "Appendicitis",
      log_rr: -0.05,
      se_log_rr: 0.22,
      calibrated_log_rr: -0.03,
      calibrated_se_log_rr: 0.14,
      ci_95_lower: -0.48,
      ci_95_upper: 0.38,
    },
    {
      outcome_name: "Fracture of nasal bone",
      log_rr: 0.08,
      se_log_rr: 0.25,
      calibrated_log_rr: 0.04,
      calibrated_se_log_rr: 0.16,
      ci_95_lower: -0.41,
      ci_95_upper: 0.57,
    },
  ],
  attrition: [
    { step: "Original cohorts", target: 15200, comparator: 14800 },
    { step: "First exposure only", target: 13500, comparator: 13100 },
    { step: "Having outcome", target: 12847, comparator: 11923 },
  ],
};

/** Minimal result with no KM, no negative controls — harmful effect */
const harmfulMinimalResult: EstimationResult = {
  summary: {
    target_count: 3200,
    comparator_count: 3100,
    outcome_counts: { "GI Bleed": 95 },
  },
  estimates: [
    {
      outcome_id: 201,
      outcome_name: "GI Bleed",
      hazard_ratio: 1.42,
      ci_95_lower: 1.08,
      ci_95_upper: 1.87,
      p_value: 0.013,
      log_hr: 0.351,
      se_log_hr: 0.14,
      target_outcomes: 55,
      comparator_outcomes: 40,
    },
  ],
};

/** Result with non-significant effect */
const nonSignificantResult: EstimationResult = {
  summary: {
    target_count: 8000,
    comparator_count: 7500,
    outcome_counts: { "Heart failure": 210 },
  },
  estimates: [
    {
      outcome_id: 301,
      outcome_name: "Heart failure",
      hazard_ratio: 0.95,
      ci_95_lower: 0.72,
      ci_95_upper: 1.25,
      p_value: 0.71,
      log_hr: -0.051,
      se_log_hr: 0.14,
      target_outcomes: 100,
      comparator_outcomes: 110,
    },
  ],
};

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe("EstimationVerdictDashboard Integration", () => {
  describe("complete API response with all fields", () => {
    it("renders dashboard with full API response data", () => {
      render(<EstimationVerdictDashboard result={completeApiResponse} />);
      expect(screen.getByTestId("estimation-verdict-dashboard")).toBeInTheDocument();
    });

    it("displays the primary HR from the first estimate", () => {
      render(<EstimationVerdictDashboard result={completeApiResponse} />);
      expect(screen.getByTestId("verdict-hr-value")).toHaveTextContent("0.74");
    });

    it("renders the protective verdict badge for HR < 1 with CI below 1", () => {
      render(<EstimationVerdictDashboard result={completeApiResponse} />);
      const badge = screen.getByTestId("significance-verdict-badge");
      expect(badge).toHaveTextContent(/protective/i);
    });

    it("renders p-value from estimate", () => {
      render(<EstimationVerdictDashboard result={completeApiResponse} />);
      // p = 0.009 => should display as "<0.001" or "0.009" depending on formatting
      expect(screen.getByText(/p-value/)).toBeInTheDocument();
    });

    it("renders NNT from Kaplan-Meier data", () => {
      render(<EstimationVerdictDashboard result={completeApiResponse} />);
      const cards = screen.getAllByTestId("chart-metric-card");
      // Last card should show NNT (target survival 0.89 - comp survival 0.84 = 0.05 => NNT = 20)
      const nntCard = cards[3];
      expect(nntCard).toHaveTextContent("NNT");
      expect(nntCard).toHaveTextContent("20");
    });

    it("renders calibrated p-value from negative controls", () => {
      render(<EstimationVerdictDashboard result={completeApiResponse} />);
      expect(screen.getByTestId("calibrated-p")).toBeInTheDocument();
    });

    it("renders 4 metric cards", () => {
      render(<EstimationVerdictDashboard result={completeApiResponse} />);
      const cards = screen.getAllByTestId("chart-metric-card");
      expect(cards).toHaveLength(4);
    });

    it("displays target cohort count from summary", () => {
      render(<EstimationVerdictDashboard result={completeApiResponse} />);
      const cards = screen.getAllByTestId("chart-metric-card");
      expect(cards[0]).toHaveTextContent("12,847");
    });

    it("displays comparator cohort count from summary", () => {
      render(<EstimationVerdictDashboard result={completeApiResponse} />);
      const cards = screen.getAllByTestId("chart-metric-card");
      expect(cards[1]).toHaveTextContent("11,923");
    });

    it("computes target events as sum across all estimates", () => {
      render(<EstimationVerdictDashboard result={completeApiResponse} />);
      const cards = screen.getAllByTestId("chart-metric-card");
      // 142 + 89 = 231
      expect(cards[2]).toHaveTextContent("231");
    });

    it("renders CI bar component", () => {
      render(<EstimationVerdictDashboard result={completeApiResponse} />);
      expect(screen.getByTestId("ci-bar")).toBeInTheDocument();
    });

    it("displays CI range text", () => {
      render(<EstimationVerdictDashboard result={completeApiResponse} />);
      expect(screen.getByText("0.59 - 0.93")).toBeInTheDocument();
    });
  });

  describe("missing optional fields", () => {
    it("shows NNT/NNH as N/A when no KM data", () => {
      render(<EstimationVerdictDashboard result={harmfulMinimalResult} />);
      const cards = screen.getAllByTestId("chart-metric-card");
      expect(cards[3]).toHaveTextContent("N/A");
    });

    it("does not show calibrated p-value when no negative controls", () => {
      render(<EstimationVerdictDashboard result={harmfulMinimalResult} />);
      expect(screen.queryByTestId("calibrated-p")).not.toBeInTheDocument();
    });
  });

  describe("harmful effect (HR > 1)", () => {
    it("displays HR > 1 with harmful verdict", () => {
      render(<EstimationVerdictDashboard result={harmfulMinimalResult} />);
      expect(screen.getByTestId("verdict-hr-value")).toHaveTextContent("1.42");
      expect(screen.getByTestId("significance-verdict-badge")).toHaveTextContent(
        /harmful/i,
      );
    });

    it("shows up arrow for harmful direction", () => {
      render(<EstimationVerdictDashboard result={harmfulMinimalResult} />);
      // Direction arrow should be up for harmful
      const arrow = screen.getByLabelText("Direction: harmful");
      expect(arrow).toHaveTextContent("\u2191");
    });
  });

  describe("non-significant effect", () => {
    it("displays neutral verdict for CI spanning 1", () => {
      render(<EstimationVerdictDashboard result={nonSignificantResult} />);
      expect(screen.getByTestId("verdict-hr-value")).toHaveTextContent("0.95");
      expect(screen.getByTestId("significance-verdict-badge")).toHaveTextContent(
        /not statistically significant/i,
      );
    });
  });
});
