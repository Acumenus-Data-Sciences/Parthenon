import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ForestPlot } from "../ForestPlot";
import type { PerSiteResult, PooledEstimate } from "../../types/evidenceSynthesis";

const mockPerSite: PerSiteResult[] = [
  { site_name: "Site A", log_rr: Math.log(0.70), se_log_rr: 0.15, hr: 0.70, ci_lower: 0.52, ci_upper: 0.94 },
  { site_name: "Site B", log_rr: Math.log(0.80), se_log_rr: 0.12, hr: 0.80, ci_lower: 0.63, ci_upper: 0.98 },
  { site_name: "Site C", log_rr: Math.log(1.10), se_log_rr: 0.20, hr: 1.10, ci_lower: 0.74, ci_upper: 1.63 },
];

const mockPooled: PooledEstimate = {
  log_rr: Math.log(0.80),
  se_log_rr: 0.08,
  hr: 0.80,
  ci_lower: 0.68,
  ci_upper: 0.94,
  tau: 0.10,
};

describe("ForestPlot", () => {
  it("renders heading", () => {
    render(<ForestPlot perSite={mockPerSite} pooled={mockPooled} />);
    expect(screen.getByText("Forest Plot")).toBeInTheDocument();
  });

  it("renders site names", () => {
    render(<ForestPlot perSite={mockPerSite} pooled={mockPooled} />);
    expect(screen.getByText("Site A")).toBeInTheDocument();
    expect(screen.getByText("Site B")).toBeInTheDocument();
    expect(screen.getByText("Site C")).toBeInTheDocument();
  });

  it("renders pooled label", () => {
    render(<ForestPlot perSite={mockPerSite} pooled={mockPooled} />);
    expect(screen.getByText("Pooled")).toBeInTheDocument();
  });

  it("renders weight % column header", () => {
    render(<ForestPlot perSite={mockPerSite} pooled={mockPooled} />);
    expect(screen.getByText("Wt%")).toBeInTheDocument();
  });

  it("renders weight percentages for each site", () => {
    render(<ForestPlot perSite={mockPerSite} pooled={mockPooled} />);
    // Check that weight elements exist via data-testid
    expect(screen.getByTestId("weight-0")).toBeInTheDocument();
    expect(screen.getByTestId("weight-1")).toBeInTheDocument();
    expect(screen.getByTestId("weight-2")).toBeInTheDocument();
  });

  it("weights sum approximately to 100%", () => {
    render(<ForestPlot perSite={mockPerSite} pooled={mockPooled} />);
    let totalWeight = 0;
    for (let i = 0; i < mockPerSite.length; i++) {
      const el = screen.getByTestId(`weight-${i}`);
      const text = el.textContent ?? "";
      const val = parseFloat(text.replace("%", ""));
      totalWeight += val;
    }
    expect(totalWeight).toBeCloseTo(100, 0);
  });

  it("renders prediction interval diamond when tau > 0", () => {
    render(<ForestPlot perSite={mockPerSite} pooled={mockPooled} />);
    expect(screen.getByTestId("prediction-interval-diamond")).toBeInTheDocument();
  });

  it("does not render prediction interval when tau = 0", () => {
    const noTauPooled = { ...mockPooled, tau: 0 };
    render(<ForestPlot perSite={mockPerSite} pooled={noTauPooled} />);
    expect(screen.queryByTestId("prediction-interval-diamond")).not.toBeInTheDocument();
  });

  it("renders HR and CI text for pooled estimate", () => {
    render(<ForestPlot perSite={mockPerSite} pooled={mockPooled} />);
    expect(screen.getByText(/0\.80 \[0\.68, 0\.94\]/)).toBeInTheDocument();
  });
});
