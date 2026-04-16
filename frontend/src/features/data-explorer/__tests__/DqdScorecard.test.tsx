import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DqdScorecard } from "@/features/data-explorer/components/dqd/DqdScorecard";
import type { DqdRunSummary } from "@/features/data-explorer/types/dataExplorer";

/** Helper to build a DqdRunSummary with sensible defaults. */
function makeSummary(
  overrides: Partial<DqdRunSummary> = {},
): DqdRunSummary {
  return {
    run_id: "run-1",
    total_checks: 100,
    passed: 90,
    failed: 8,
    warnings: 2,
    by_category: [
      { category: "completeness", total: 40, passed: 38, failed: 2, pass_rate: 95 },
      { category: "conformance", total: 35, passed: 30, failed: 5, pass_rate: 85.7 },
      { category: "plausibility", total: 25, passed: 22, failed: 3, pass_rate: 88 },
    ],
    ...overrides,
  };
}

describe("DqdScorecard", () => {
  it("renders empty state when summary is null", () => {
    render(<DqdScorecard summary={null} />);
    expect(
      screen.getByText("No DQD results available"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Run a Data Quality Dashboard analysis to see results"),
    ).toBeInTheDocument();
  });

  it("renders overall score ring", () => {
    const { container } = render(<DqdScorecard summary={makeSummary()} />);
    // The "Overall Score" label should be present
    expect(screen.getByText("Overall Score")).toBeInTheDocument();
    // Should show "passed/total passed" text: "90/100 passed"
    expect(screen.getByText("90/100 passed")).toBeInTheDocument();
    // There should be SVG score rings (overall + 3 categories = 4)
    const rings = container.querySelectorAll("svg.-rotate-90");
    expect(rings).toHaveLength(4);
  });

  it("renders category score rings", () => {
    render(<DqdScorecard summary={makeSummary()} />);
    // Category labels
    expect(screen.getByText("Completeness")).toBeInTheDocument();
    expect(screen.getByText("Conformance")).toBeInTheDocument();
    expect(screen.getByText("Plausibility")).toBeInTheDocument();
    // Per-category passed/total
    expect(screen.getByText("38/40 passed")).toBeInTheDocument();
    expect(screen.getByText("30/35 passed")).toBeInTheDocument();
    expect(screen.getByText("22/25 passed")).toBeInTheDocument();
  });

  it("shows correct pass rate percentages", () => {
    // Overall: 90/100 = 90%, Completeness: 38/40 = 95%, Conformance: 30/35 ~86%, Plausibility: 22/25 = 88%
    render(<DqdScorecard summary={makeSummary()} />);
    expect(screen.getByText("90%")).toBeInTheDocument();  // overall
    expect(screen.getByText("95%")).toBeInTheDocument();  // completeness
    expect(screen.getByText("86%")).toBeInTheDocument();  // conformance (Math.round(85.71))
    expect(screen.getByText("88%")).toBeInTheDocument();  // plausibility
  });

  it("uses teal color for high pass rates", () => {
    // A high pass rate (>= 90%) uses teal (#2DD4BF) for the ring stroke
    const highSummary = makeSummary({
      total_checks: 100,
      passed: 95,
      failed: 5,
      by_category: [
        { category: "completeness", total: 100, passed: 95, failed: 5, pass_rate: 95 },
      ],
    });
    const { container } = render(<DqdScorecard summary={highSummary} />);
    // The second circle in each SVG ring is the progress arc - check stroke color
    const progressArcs = container.querySelectorAll(
      'svg.-rotate-90 circle:nth-child(2)',
    );
    // At least one arc should have the teal stroke
    const tealArcs = Array.from(progressArcs).filter(
      (el) => el.getAttribute("stroke") === "var(--success)",
    );
    expect(tealArcs.length).toBeGreaterThan(0);
  });

  it("uses crimson color for low pass rates", () => {
    // A low pass rate (< 70%) uses crimson (#E85A6B) for the ring stroke
    const lowSummary = makeSummary({
      total_checks: 100,
      passed: 50,
      failed: 50,
      by_category: [
        { category: "completeness", total: 100, passed: 50, failed: 50, pass_rate: 50 },
      ],
    });
    const { container } = render(<DqdScorecard summary={lowSummary} />);
    const progressArcs = container.querySelectorAll(
      'svg.-rotate-90 circle:nth-child(2)',
    );
    // At least one arc should have the crimson stroke
    const crimsonArcs = Array.from(progressArcs).filter(
      (el) => el.getAttribute("stroke") === "var(--critical)",
    );
    expect(crimsonArcs.length).toBeGreaterThan(0);
  });
});
