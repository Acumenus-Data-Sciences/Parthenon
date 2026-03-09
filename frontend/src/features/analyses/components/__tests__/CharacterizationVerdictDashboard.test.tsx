import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CharacterizationVerdictDashboard } from "../CharacterizationVerdictDashboard";
import type { CovariateBalanceEntry } from "@/features/estimation/types/estimation";

function makeEntry(
  name: string,
  smdBefore: number,
  smdAfter: number,
): CovariateBalanceEntry {
  return {
    covariate_name: name,
    smd_before: smdBefore,
    smd_after: smdAfter,
    mean_target_before: 0.5,
    mean_comp_before: 0.3,
    mean_target_after: 0.4,
    mean_comp_after: 0.35,
  };
}

describe("CharacterizationVerdictDashboard", () => {
  it("renders nothing when balanceEntries is empty", () => {
    const { container } = render(
      <CharacterizationVerdictDashboard balanceEntries={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders 'Well balanced' when >90% covariates have |SMD| < 0.1", () => {
    // 10 entries: 9 with SMD < 0.1, 1 with SMD > 0.1 → 90%
    const entries: CovariateBalanceEntry[] = [];
    for (let i = 0; i < 9; i++) {
      entries.push(makeEntry(`cov_${i}`, 0.05, 0.05));
    }
    entries.push(makeEntry("cov_high", 0.15, 0.15));

    render(<CharacterizationVerdictDashboard balanceEntries={entries} />);
    expect(screen.getByTestId("verdict-label")).toHaveTextContent(
      "Well balanced",
    );
  });

  it("renders 'Marginal imbalance' when 75-90% covariates have |SMD| < 0.1", () => {
    // 10 entries: 8 with SMD < 0.1, 2 with SMD > 0.1 → 80%
    const entries: CovariateBalanceEntry[] = [];
    for (let i = 0; i < 8; i++) {
      entries.push(makeEntry(`cov_${i}`, 0.05, 0.05));
    }
    entries.push(makeEntry("cov_high1", 0.15, 0.15));
    entries.push(makeEntry("cov_high2", 0.25, 0.25));

    render(<CharacterizationVerdictDashboard balanceEntries={entries} />);
    expect(screen.getByTestId("verdict-label")).toHaveTextContent(
      "Marginal imbalance",
    );
  });

  it("renders 'Significant imbalance' when <75% covariates have |SMD| < 0.1", () => {
    // 4 entries: 2 with SMD < 0.1, 2 with SMD > 0.1 → 50%
    const entries = [
      makeEntry("cov1", 0.05, 0.05),
      makeEntry("cov2", 0.05, 0.05),
      makeEntry("cov3", 0.25, 0.25),
      makeEntry("cov4", 0.3, 0.3),
    ];

    render(<CharacterizationVerdictDashboard balanceEntries={entries} />);
    expect(screen.getByTestId("verdict-label")).toHaveTextContent(
      "Significant imbalance",
    );
  });

  it("shows before/after comparison when smd_before differs from smd_after", () => {
    const entries = [
      makeEntry("cov1", 0.3, 0.05),
      makeEntry("cov2", 0.25, 0.04),
      makeEntry("cov3", 0.2, 0.03),
    ];

    render(<CharacterizationVerdictDashboard balanceEntries={entries} />);
    expect(screen.getByText("Before matching")).toBeInTheDocument();
    expect(screen.getByText("After matching")).toBeInTheDocument();
  });

  it("shows single metric strip when before equals after", () => {
    const entries = [
      makeEntry("cov1", 0.05, 0.05),
      makeEntry("cov2", 0.05, 0.05),
    ];

    render(<CharacterizationVerdictDashboard balanceEntries={entries} />);
    expect(screen.queryByText("Before matching")).not.toBeInTheDocument();
    expect(screen.queryByText("After matching")).not.toBeInTheDocument();
  });

  it("renders top imbalanced covariates as diverging bars", () => {
    const entries = [
      makeEntry("High SMD Covariate", 0.35, 0.35),
      makeEntry("Medium SMD", 0.15, 0.15),
      makeEntry("Low SMD", 0.05, 0.05),
    ];

    render(<CharacterizationVerdictDashboard balanceEntries={entries} />);
    expect(screen.getByText("Top Imbalanced Covariates")).toBeInTheDocument();
    const bars = screen.getAllByTestId("imbalanced-bar");
    expect(bars.length).toBeGreaterThanOrEqual(2);
  });

  it("shows the dashboard container with data-testid", () => {
    const entries = [makeEntry("cov1", 0.05, 0.05)];
    render(<CharacterizationVerdictDashboard balanceEntries={entries} />);
    expect(
      screen.getByTestId("characterization-verdict-dashboard"),
    ).toBeInTheDocument();
  });

  it("uses custom target and comparator labels", () => {
    const entries = [makeEntry("cov1", 0.3, 0.3)];

    render(
      <CharacterizationVerdictDashboard
        balanceEntries={entries}
        targetLabel="ACE Inhibitors"
        comparatorLabel="ARBs"
      />,
    );
    const aceMatches = screen.getAllByText(/ACE Inhibitors/);
    expect(aceMatches.length).toBeGreaterThan(0);
    const arbMatches = screen.getAllByText(/ARBs/);
    expect(arbMatches.length).toBeGreaterThan(0);
  });

  it("limits imbalanced covariates to top 10", () => {
    const entries: CovariateBalanceEntry[] = [];
    for (let i = 0; i < 15; i++) {
      entries.push(makeEntry(`cov_${i}`, 0.2 + i * 0.01, 0.2 + i * 0.01));
    }

    render(<CharacterizationVerdictDashboard balanceEntries={entries} />);
    const bars = screen.getAllByTestId("imbalanced-bar");
    expect(bars).toHaveLength(10);
  });
});
