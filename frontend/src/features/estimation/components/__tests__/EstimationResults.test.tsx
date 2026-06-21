import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EstimationResults } from "../EstimationResults";
import type { AnalysisExecution } from "@/features/analyses/types/analysis";

describe("EstimationResults", () => {
  it("does not crash when a completed execution has no estimates array", () => {
    const execution: AnalysisExecution = {
      id: 1,
      analysis_type: "estimation",
      analysis_id: 1,
      source_id: 1,
      status: "completed",
      started_at: null,
      completed_at: null,
      fail_message: null,
      created_at: "2026-03-14T00:00:00Z",
      result_json: {
        status: "completed",
        summary: {
          target_count: 12,
          comparator_count: 10,
          outcome_counts: {},
        },
        propensity_score: {
          auc: 0.71,
          distribution: {
            target: [],
            comparator: [],
          },
        },
      },
    };

    render(<EstimationResults execution={execution} />);

    expect(screen.getByText("Target Count")).toBeInTheDocument();
    expect(screen.queryByTestId("estimation-verdict-dashboard")).not.toBeInTheDocument();
  });

  it("surfaces the actionable fail_message in the r_not_implemented branch", () => {
    const execution: AnalysisExecution = {
      id: 2,
      analysis_type: "estimation",
      analysis_id: 1,
      source_id: 1,
      status: "failed",
      started_at: null,
      completed_at: null,
      fail_message:
        "Population-level effect estimation could not produce results: the R statistical execution environment (CohortMethod) is not available in this deployment. Contact your administrator to enable the R analytics sidecar.",
      created_at: "2026-03-14T00:00:00Z",
      result_json: {
        status: "r_not_implemented",
        message: "R CohortMethod package not configured.",
        design_validated: true,
      },
    };

    render(<EstimationResults execution={execution} />);

    // The actionable, package-specific fail_message is shown rather than the
    // short generic result.message.
    expect(
      screen.getByText(/Contact your administrator to enable the R analytics sidecar/),
    ).toBeInTheDocument();
  });
});
