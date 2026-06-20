import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { PsmPanel } from "../PsmPanel";
import type { PropensityMatchResult } from "../../types/patientSimilarity";

vi.mock("../PreferenceScoreDistribution", () => ({
  PreferenceScoreDistribution: () => (
    <div data-testid="preference-score-distribution" />
  ),
}));

vi.mock("../LovePlot", () => ({
  LovePlot: () => <div data-testid="love-plot" />,
}));

function buildResult(
  overrides: Partial<PropensityMatchResult> = {},
): PropensityMatchResult {
  return {
    propensity_scores: [],
    matched_pairs: [
      {
        target_id: 101,
        comparator_id: 202,
        distance: 0.04,
      },
    ],
    balance: {
      before: [
        {
          covariate: "Age",
          smd: 0.3,
          type: "continuous",
          domain: "Demographics",
        },
      ],
      after: [
        {
          covariate: "Age",
          smd: 0.05,
          type: "continuous",
          domain: "Demographics",
        },
      ],
    },
    model_metrics: {
      auc: 0.78,
      n_covariates: 24,
      n_target: 100,
      n_comparator: 120,
      caliper: 0.2,
    },
    unmatched: { target_ids: [], comparator_ids: [] },
    preference_distribution: {
      bins: [0, 0.5, 1],
      target_density: [0.2, 0.8],
      comparator_density: [0.3, 0.7],
    },
    ...overrides,
  };
}

describe("PsmPanel", () => {
  it("calls onExportMatched when matched pairs exist", () => {
    const onExportMatched = vi.fn();

    renderWithProviders(
      <PsmPanel
        result={buildResult()}
        onExportMatched={onExportMatched}
        onContinue={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Export Matched Cohort" }),
    );

    expect(onExportMatched).toHaveBeenCalledTimes(1);
  });

  it("disables matched cohort export when no matched pairs exist", () => {
    renderWithProviders(
      <PsmPanel
        result={buildResult({ matched_pairs: [] })}
        onExportMatched={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Export Matched Cohort" }),
    ).toBeDisabled();
  });
});
