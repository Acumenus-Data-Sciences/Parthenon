import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CharacterizationResults } from "../CharacterizationResults";
import type { AnalysisExecution } from "../../types/analysis";

describe("CharacterizationResults", () => {
  it("renders safely when feature rows are missing string fields", () => {
    const execution: AnalysisExecution = {
      id: 1,
      analysis_type: "characterization",
      analysis_id: 1,
      source_id: 1,
      status: "completed",
      started_at: null,
      completed_at: null,
      fail_message: null,
      created_at: "2026-03-14T00:00:00Z",
      result_json: [
        {
          cohort_id: 10,
          cohort_name: "Target",
          person_count: 100,
          features: {
            demographics: [
              {
                category: undefined,
                feature_name: undefined,
                count: 12,
                percent: 12,
              },
            ],
          },
        },
      ] as unknown as Record<string, unknown>,
    };

    render(<CharacterizationResults execution={execution} />);

    expect(screen.getByText("Unnamed feature 1")).toBeInTheDocument();
  });
});
