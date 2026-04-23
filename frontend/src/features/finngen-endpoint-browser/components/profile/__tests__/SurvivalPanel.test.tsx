// Phase 18 (Plan 18-06) — SurvivalPanel real assertions (GREEN flip).
// Covers D-03 (age-at-death 5-year bins) and D-15 (source eligibility).
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SurvivalPanel } from "../SurvivalPanel";
import type {
  EndpointProfileKmPoint,
  EndpointProfileSummary,
} from "../../../api";

const BASE_SUMMARY: EndpointProfileSummary = {
  endpoint_name: "E4_DM2",
  source_key: "PANCREAS",
  expression_hash: "abc123",
  subject_count: 1000,
  death_count: 142,
  median_survival_days: 1533,
  age_at_death_mean: 68.4,
  age_at_death_median: 70,
  age_at_death_bins: [
    { age_bin: "60-64", bin_start: 60, count: 12 },
    { age_bin: "65-69", bin_start: 65, count: 25 },
    { age_bin: "70-74", bin_start: 70, count: 30 },
  ],
  computed_at: "2026-04-19T12:00:00Z",
  run_id: "01HFAKE",
};

const KM_POINTS: EndpointProfileKmPoint[] = [
  { time_days: 30, survival_prob: 0.97, at_risk: 950, events: 30 },
  { time_days: 365, survival_prob: 0.85, at_risk: 800, events: 100 },
];

describe("SurvivalPanel", () => {
  it("renders disabled-banner copy verbatim when sourceHasDeathData=false", () => {
    render(
      <SurvivalPanel
        summary={BASE_SUMMARY}
        kmPoints={[]}
        sourceHasDeathData={false}
        endpointDisplayName="Type 2 diabetes"
      />,
    );
    expect(
      screen.getByText(
        /No death data in this source — survival panel disabled\. Comorbidity \+ drug panels still render below\./,
      ),
    ).toBeTruthy();
  });

  it("renders 3 StatTiles (Median survival / Deaths / Subjects at index) when sourceHasDeathData=true", () => {
    render(
      <SurvivalPanel
        summary={BASE_SUMMARY}
        kmPoints={KM_POINTS}
        sourceHasDeathData={true}
        endpointDisplayName="Type 2 diabetes"
      />,
    );
    expect(screen.getByText("Median survival")).toBeTruthy();
    expect(screen.getByText("Deaths")).toBeTruthy();
    expect(screen.getByText("Subjects at index")).toBeTruthy();
  });

  it("renders '—' for Median survival when death_count < 20", () => {
    const tooFewDeaths: EndpointProfileSummary = {
      ...BASE_SUMMARY,
      death_count: 5,
      median_survival_days: null,
    };
    render(
      <SurvivalPanel
        summary={tooFewDeaths}
        kmPoints={KM_POINTS}
        sourceHasDeathData={true}
        endpointDisplayName="Type 2 diabetes"
      />,
    );
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("Too few deaths to estimate")).toBeTruthy();
  });

  it("renders the KaplanMeierPlot SVG when death_count > 0", () => {
    const { container } = render(
      <SurvivalPanel
        summary={BASE_SUMMARY}
        kmPoints={KM_POINTS}
        sourceHasDeathData={true}
        endpointDisplayName="Type 2 diabetes"
      />,
    );
    // KaplanMeierPlot tags its outer SVG with data-testid="kaplan-meier-plot".
    const km = container.querySelector('[data-testid="kaplan-meier-plot"]');
    expect(km).toBeTruthy();
  });

  it("renders the age-at-death heading when age_at_death_bins is non-empty", () => {
    render(
      <SurvivalPanel
        summary={BASE_SUMMARY}
        kmPoints={KM_POINTS}
        sourceHasDeathData={true}
        endpointDisplayName="Type 2 diabetes"
      />,
    );
    expect(screen.getByText("Age at death (5-year bins)")).toBeTruthy();
  });
});
