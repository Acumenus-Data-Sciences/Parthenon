import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IncidenceRateVerdictDashboard } from "../IncidenceRateVerdictDashboard";
import type { IncidenceRateResult } from "../../types/analysis";

function makeResult(
  overrides: Partial<IncidenceRateResult> = {},
): IncidenceRateResult {
  return {
    outcome_cohort_id: 1,
    outcome_cohort_name: "MI",
    persons_at_risk: 5000,
    persons_with_outcome: 100,
    person_years: 10000,
    incidence_rate: 10.0,
    rate_95_ci_lower: 8.0,
    rate_95_ci_upper: 12.0,
    ...overrides,
  };
}

describe("IncidenceRateVerdictDashboard", () => {
  it("renders nothing when results are empty", () => {
    const { container } = render(
      <IncidenceRateVerdictDashboard results={[]} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders single-result mode with IR value and metric cards", () => {
    const result = makeResult();
    render(<IncidenceRateVerdictDashboard results={[result]} />);

    expect(screen.getByTestId("ir-verdict-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("verdict-ir-value")).toHaveTextContent("10.00");

    // Should have 4 metric cards
    const cards = screen.getAllByTestId("chart-metric-card");
    expect(cards).toHaveLength(4);
  });

  it("renders comparative mode with IRD and IRR when 2 results provided", () => {
    const r1 = makeResult({
      outcome_cohort_id: 1,
      outcome_cohort_name: "Drug A",
      incidence_rate: 15.0,
      rate_95_ci_lower: 12.0,
      rate_95_ci_upper: 18.0,
      person_years: 8000,
      persons_with_outcome: 120,
    });
    const r2 = makeResult({
      outcome_cohort_id: 2,
      outcome_cohort_name: "Drug B",
      incidence_rate: 8.0,
      rate_95_ci_lower: 6.0,
      rate_95_ci_upper: 10.0,
      person_years: 9000,
      persons_with_outcome: 72,
    });

    render(<IncidenceRateVerdictDashboard results={[r1, r2]} />);

    expect(screen.getByTestId("verdict-ir-value-1")).toHaveTextContent("15.00");
    expect(screen.getByTestId("verdict-ir-value-2")).toHaveTextContent("8.00");
    expect(screen.getByTestId("ird-value")).toBeInTheDocument();
    expect(screen.getByTestId("irr-value")).toBeInTheDocument();
    expect(screen.getByTestId("ir-verdict-badge")).toBeInTheDocument();
  });

  it("shows 'no significant difference' when IRD CI spans zero", () => {
    const r1 = makeResult({
      outcome_cohort_id: 1,
      outcome_cohort_name: "A",
      incidence_rate: 10.0,
      person_years: 100, // small PY -> wide CI
      persons_with_outcome: 1,
    });
    const r2 = makeResult({
      outcome_cohort_id: 2,
      outcome_cohort_name: "B",
      incidence_rate: 9.5,
      person_years: 100,
      persons_with_outcome: 1,
    });

    render(<IncidenceRateVerdictDashboard results={[r1, r2]} />);

    expect(screen.getByTestId("ir-verdict-badge")).toHaveTextContent(
      "No significant difference",
    );
  });

  it("shows 'significantly higher' when IRD is positive and CI does not span zero", () => {
    const r1 = makeResult({
      outcome_cohort_id: 1,
      outcome_cohort_name: "High Risk",
      incidence_rate: 50.0,
      person_years: 100000,
      persons_with_outcome: 5000,
    });
    const r2 = makeResult({
      outcome_cohort_id: 2,
      outcome_cohort_name: "Low Risk",
      incidence_rate: 5.0,
      person_years: 100000,
      persons_with_outcome: 500,
    });

    render(<IncidenceRateVerdictDashboard results={[r1, r2]} />);

    expect(screen.getByTestId("ir-verdict-badge")).toHaveTextContent(
      "Significantly higher rate",
    );
  });

  it("renders stratified comparisons when both results have strata", () => {
    const strata = [
      {
        stratum_name: "Gender",
        stratum_value: "Male",
        persons_at_risk: 2500,
        persons_with_outcome: 60,
        person_years: 5000,
        incidence_rate: 12.0,
      },
      {
        stratum_name: "Gender",
        stratum_value: "Female",
        persons_at_risk: 2500,
        persons_with_outcome: 40,
        person_years: 5000,
        incidence_rate: 8.0,
      },
    ];

    const r1 = makeResult({
      outcome_cohort_id: 1,
      outcome_cohort_name: "A",
      incidence_rate: 50.0,
      person_years: 100000,
      persons_with_outcome: 5000,
      strata,
    });
    const r2 = makeResult({
      outcome_cohort_id: 2,
      outcome_cohort_name: "B",
      incidence_rate: 5.0,
      person_years: 100000,
      persons_with_outcome: 500,
      strata: strata.map((s) => ({
        ...s,
        incidence_rate: s.incidence_rate * 0.5,
        persons_with_outcome: Math.round(s.persons_with_outcome * 0.5),
      })),
    });

    render(<IncidenceRateVerdictDashboard results={[r1, r2]} />);

    expect(screen.getByText("Stratified Comparisons")).toBeInTheDocument();
    const cards = screen.getAllByTestId("stratum-card");
    expect(cards.length).toBe(2);
  });

  it("flags reversed direction strata", () => {
    const r1 = makeResult({
      outcome_cohort_id: 1,
      outcome_cohort_name: "A",
      incidence_rate: 50.0,
      person_years: 100000,
      persons_with_outcome: 5000,
      strata: [
        {
          stratum_name: "Age",
          stratum_value: "Young",
          persons_at_risk: 2500,
          persons_with_outcome: 60,
          person_years: 5000,
          incidence_rate: 12.0,
        },
        {
          stratum_name: "Age",
          stratum_value: "Old",
          persons_at_risk: 2500,
          persons_with_outcome: 40,
          person_years: 5000,
          incidence_rate: 3.0, // lower than r2's Old stratum -> direction reversed
        },
      ],
    });
    const r2 = makeResult({
      outcome_cohort_id: 2,
      outcome_cohort_name: "B",
      incidence_rate: 5.0,
      person_years: 100000,
      persons_with_outcome: 500,
      strata: [
        {
          stratum_name: "Age",
          stratum_value: "Young",
          persons_at_risk: 2500,
          persons_with_outcome: 30,
          person_years: 5000,
          incidence_rate: 6.0,
        },
        {
          stratum_name: "Age",
          stratum_value: "Old",
          persons_at_risk: 2500,
          persons_with_outcome: 50,
          person_years: 5000,
          incidence_rate: 10.0,
        },
      ],
    });

    render(<IncidenceRateVerdictDashboard results={[r1, r2]} />);

    // The Old stratum has reversed direction (r1 < r2 while overall r1 > r2)
    const reversedFlags = screen.getAllByTestId("direction-reversed-flag");
    expect(reversedFlags.length).toBeGreaterThanOrEqual(1);
  });
});
