// frontend/src/features/finngen-analyses/__tests__/ResultViewerSwitch.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultViewerSwitch } from "../components/results/ResultViewerSwitch";
import type { CodeWASDisplay } from "../types";

// Minimal mock display data
const mockCodeWASDisplay: CodeWASDisplay = {
  signals: [
    {
      concept_id: 1,
      concept_name: "Test Concept",
      domain_id: "Condition",
      p_value: 0.001,
      beta: 1.5,
      se: 0.2,
      n_cases: 100,
      n_controls: 200,
    },
  ],
  thresholds: { bonferroni: 0.000025, suggestive: 0.0001 },
  summary: { total_codes_tested: 1, significant_count: 1 },
};

describe("ResultViewerSwitch", () => {
  it("renders CodeWASResults for co2.codewas module key", () => {
    render(
      <ResultViewerSwitch moduleKey="co2.codewas" display={mockCodeWASDisplay} />,
    );
    // CodeWASResults renders "codes tested" in summary
    expect(screen.getByText(/codes tested/i)).toBeDefined();
  });

  it("renders GenericResultViewer for unknown module key", () => {
    render(
      <ResultViewerSwitch
        moduleKey={"unknown.module" as "co2.codewas"}
        display={{ some: "data" }}
      />,
    );
    // GenericResultViewer renders "Raw Results (JSON)"
    expect(screen.getByText(/Raw Results/i)).toBeDefined();
  });
});
