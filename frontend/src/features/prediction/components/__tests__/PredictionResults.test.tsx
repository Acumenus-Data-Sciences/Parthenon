import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PredictionResults } from "../PredictionResults";
import type { AnalysisExecution } from "@/features/analyses/types/analysis";

describe("PredictionResults", () => {
  it("renders safely with partial completed payloads", () => {
    const execution: AnalysisExecution = {
      id: 1,
      analysis_type: "prediction",
      analysis_id: 1,
      source_id: 1,
      status: "completed",
      started_at: null,
      completed_at: null,
      fail_message: null,
      created_at: "2026-03-14T00:00:00Z",
      result_json: {
        status: "completed",
        performance: {
          auc: 0.71,
        },
        summary: {},
        top_predictors: [
          {
            covariate_name: undefined,
            coefficient: 0.42,
            importance: 0.42,
          },
        ],
      },
    };

    render(<PredictionResults execution={execution} />);

    expect(screen.getByText("AUC")).toBeInTheDocument();
    expect(screen.getByText("Predictor 1")).toBeInTheDocument();
  });

  it("surfaces the actionable fail_message in the r_not_implemented branch", () => {
    const execution: AnalysisExecution = {
      id: 2,
      analysis_type: "prediction",
      analysis_id: 1,
      source_id: 1,
      status: "failed",
      started_at: null,
      completed_at: null,
      fail_message:
        "Patient-level prediction could not produce results: the compute execution environment (PatientLevelPrediction) is not available in this deployment. Contact your administrator to enable the R analytics sidecar.",
      created_at: "2026-03-14T00:00:00Z",
      result_json: {
        status: "r_not_implemented",
        message: "R PatientLevelPrediction package not configured.",
        design_validated: true,
      },
    };

    render(<PredictionResults execution={execution} />);

    expect(
      screen.getByText(/Contact your administrator to enable the R analytics sidecar/),
    ).toBeInTheDocument();
  });
});
