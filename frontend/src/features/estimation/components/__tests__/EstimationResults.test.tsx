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
});
