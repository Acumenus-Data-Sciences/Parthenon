import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IncidenceRateVerdictDashboard } from "../IncidenceRateVerdictDashboard";
import type { IncidenceRateResult } from "../../types/analysis";

// ---------------------------------------------------------------------------
// Realistic fixtures matching Darkstar IncidenceRate output
// ---------------------------------------------------------------------------

/** Complete IR result: Type 2 Diabetes on ACE inhibitors */
const irResultDiabetes: IncidenceRateResult = {
  outcome_cohort_id: 10,
  outcome_cohort_name: "New-onset Type 2 Diabetes",
  persons_at_risk: 24500,
  persons_with_outcome: 612,
  person_years: 48200,
  incidence_rate: 12.7,
  rate_95_ci_lower: 11.7,
  rate_95_ci_upper: 13.7,
  strata: [
    {
      stratum_name: "Gender",
      stratum_value: "Male",
      persons_at_risk: 12800,
      persons_with_outcome: 380,
      person_years: 25100,
      incidence_rate: 15.14,
    },
    {
      stratum_name: "Gender",
      stratum_value: "Female",
      persons_at_risk: 11700,
      persons_with_outcome: 232,
      person_years: 23100,
      incidence_rate: 10.04,
    },
    {
      stratum_name: "Age",
      stratum_value: "18-44",
      persons_at_risk: 5200,
      persons_with_outcome: 52,
      person_years: 10400,
      incidence_rate: 5.0,
    },
    {
      stratum_name: "Age",
      stratum_value: "45-64",
      persons_at_risk: 11000,
      persons_with_outcome: 275,
      person_years: 21600,
      incidence_rate: 12.73,
    },
    {
      stratum_name: "Age",
      stratum_value: "65+",
      persons_at_risk: 8300,
      persons_with_outcome: 285,
      person_years: 16200,
      incidence_rate: 17.59,
    },
  ],
};

/** Comparator result: Type 2 Diabetes on ARBs */
const irResultDiabetesComparator: IncidenceRateResult = {
  outcome_cohort_id: 11,
  outcome_cohort_name: "New-onset T2DM (ARB Cohort)",
  persons_at_risk: 22100,
  persons_with_outcome: 730,
  person_years: 43800,
  incidence_rate: 16.67,
  rate_95_ci_lower: 15.5,
  rate_95_ci_upper: 17.9,
  strata: [
    {
      stratum_name: "Gender",
      stratum_value: "Male",
      persons_at_risk: 11500,
      persons_with_outcome: 437,
      person_years: 22800,
      incidence_rate: 19.17,
    },
    {
      stratum_name: "Gender",
      stratum_value: "Female",
      persons_at_risk: 10600,
      persons_with_outcome: 293,
      person_years: 21000,
      incidence_rate: 13.95,
    },
    {
      stratum_name: "Age",
      stratum_value: "18-44",
      persons_at_risk: 4700,
      persons_with_outcome: 56,
      person_years: 9400,
      incidence_rate: 5.96,
    },
    {
      stratum_name: "Age",
      stratum_value: "45-64",
      persons_at_risk: 10200,
      persons_with_outcome: 326,
      person_years: 20100,
      incidence_rate: 16.22,
    },
    {
      stratum_name: "Age",
      stratum_value: "65+",
      persons_at_risk: 7200,
      persons_with_outcome: 348,
      person_years: 14300,
      incidence_rate: 24.34,
    },
  ],
};

/** Direction-reversed strata scenario: overall r1 > r2, but one stratum reverses */
const irReversalR1: IncidenceRateResult = {
  outcome_cohort_id: 20,
  outcome_cohort_name: "GI Bleed (Drug A)",
  persons_at_risk: 15000,
  persons_with_outcome: 450,
  person_years: 30000,
  incidence_rate: 15.0,
  rate_95_ci_lower: 13.6,
  rate_95_ci_upper: 16.4,
  strata: [
    {
      stratum_name: "Age",
      stratum_value: "Young (<65)",
      persons_at_risk: 8000,
      persons_with_outcome: 320,
      person_years: 16000,
      incidence_rate: 20.0,
    },
    {
      stratum_name: "Age",
      stratum_value: "Elderly (65+)",
      persons_at_risk: 7000,
      persons_with_outcome: 130,
      person_years: 14000,
      incidence_rate: 9.29, // Lower than comparator => reversed
    },
  ],
};

const irReversalR2: IncidenceRateResult = {
  outcome_cohort_id: 21,
  outcome_cohort_name: "GI Bleed (Drug B)",
  persons_at_risk: 14000,
  persons_with_outcome: 280,
  person_years: 28000,
  incidence_rate: 10.0,
  rate_95_ci_lower: 8.9,
  rate_95_ci_upper: 11.1,
  strata: [
    {
      stratum_name: "Age",
      stratum_value: "Young (<65)",
      persons_at_risk: 7500,
      persons_with_outcome: 150,
      person_years: 15000,
      incidence_rate: 10.0,
    },
    {
      stratum_name: "Age",
      stratum_value: "Elderly (65+)",
      persons_at_risk: 6500,
      persons_with_outcome: 130,
      person_years: 13000,
      incidence_rate: 10.0,
    },
  ],
};

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe("IncidenceRateVerdictDashboard Integration", () => {
  describe("single outcome (no comparison)", () => {
    it("renders single-result mode with IR value", () => {
      render(<IncidenceRateVerdictDashboard results={[irResultDiabetes]} />);
      expect(screen.getByTestId("ir-verdict-dashboard")).toBeInTheDocument();
      expect(screen.getByTestId("verdict-ir-value")).toHaveTextContent("12.70");
    });

    it("renders 4 metric cards with summary data", () => {
      render(<IncidenceRateVerdictDashboard results={[irResultDiabetes]} />);
      const cards = screen.getAllByTestId("chart-metric-card");
      expect(cards).toHaveLength(4);
      expect(cards[0]).toHaveTextContent("24,500"); // persons at risk
      expect(cards[1]).toHaveTextContent("612"); // events
    });

    it("displays per 1,000 PY unit label", () => {
      render(<IncidenceRateVerdictDashboard results={[irResultDiabetes]} />);
      expect(screen.getByText("per 1,000 PY")).toBeInTheDocument();
    });
  });

  describe("comparative mode with two outcomes", () => {
    it("renders both cohort rates side by side", () => {
      render(
        <IncidenceRateVerdictDashboard
          results={[irResultDiabetes, irResultDiabetesComparator]}
        />,
      );
      expect(screen.getByTestId("verdict-ir-value-1")).toHaveTextContent("12.70");
      expect(screen.getByTestId("verdict-ir-value-2")).toHaveTextContent("16.67");
    });

    it("renders IRD and IRR panels", () => {
      render(
        <IncidenceRateVerdictDashboard
          results={[irResultDiabetes, irResultDiabetesComparator]}
        />,
      );
      expect(screen.getByTestId("ird-value")).toBeInTheDocument();
      expect(screen.getByText(/Rate Difference/)).toBeInTheDocument();
      expect(screen.getByText(/Rate Ratio/)).toBeInTheDocument();
    });

    it("computes negative IRD when first rate < second rate", () => {
      render(
        <IncidenceRateVerdictDashboard
          results={[irResultDiabetes, irResultDiabetesComparator]}
        />,
      );
      // IRD = 12.7 - 16.67 = -3.97
      const irdValue = screen.getByTestId("ird-value");
      expect(irdValue.textContent).toMatch(/-3\.97/);
    });

    it("renders significance verdict badge", () => {
      render(
        <IncidenceRateVerdictDashboard
          results={[irResultDiabetes, irResultDiabetesComparator]}
        />,
      );
      expect(screen.getByTestId("ir-verdict-badge")).toBeInTheDocument();
    });

    it("renders stratified comparison cards when both have strata", () => {
      render(
        <IncidenceRateVerdictDashboard
          results={[irResultDiabetes, irResultDiabetesComparator]}
        />,
      );
      expect(screen.getByText("Stratified Comparisons")).toBeInTheDocument();
      const stratumCards = screen.getAllByTestId("stratum-card");
      // 5 strata matched by name:value pairs
      expect(stratumCards.length).toBe(5);
    });

    it("displays cohort names", () => {
      render(
        <IncidenceRateVerdictDashboard
          results={[irResultDiabetes, irResultDiabetesComparator]}
        />,
      );
      expect(screen.getByText("New-onset Type 2 Diabetes")).toBeInTheDocument();
      expect(screen.getByText("New-onset T2DM (ARB Cohort)")).toBeInTheDocument();
    });
  });

  describe("strata with direction reversal", () => {
    it("flags reversed direction in at least one stratum", () => {
      render(
        <IncidenceRateVerdictDashboard
          results={[irReversalR1, irReversalR2]}
        />,
      );
      // Overall r1 (15.0) > r2 (10.0), but Elderly stratum r1 (9.29) < r2 (10.0) => reversed
      const reversedFlags = screen.getAllByTestId("direction-reversed-flag");
      expect(reversedFlags.length).toBeGreaterThanOrEqual(1);
    });

    it("displays Reversed label on the reversed stratum card", () => {
      render(
        <IncidenceRateVerdictDashboard
          results={[irReversalR1, irReversalR2]}
        />,
      );
      expect(screen.getByText("Reversed")).toBeInTheDocument();
    });
  });
});
