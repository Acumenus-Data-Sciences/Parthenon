import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EvidenceSynthesisVerdictDashboard } from "../EvidenceSynthesisVerdictDashboard";
import type { EvidenceSynthesisResult } from "../../types/evidenceSynthesis";

const mockResult: EvidenceSynthesisResult = {
  status: "completed",
  method: "bayesian",
  pooled: {
    log_rr: Math.log(0.75),
    se_log_rr: 0.1,
    hr: 0.75,
    ci_lower: 0.60,
    ci_upper: 0.90,
    tau: 0.15,
  },
  per_site: [
    { site_name: "Site A", log_rr: Math.log(0.70), se_log_rr: 0.15, hr: 0.70, ci_lower: 0.52, ci_upper: 0.94 },
    { site_name: "Site B", log_rr: Math.log(0.80), se_log_rr: 0.12, hr: 0.80, ci_lower: 0.63, ci_upper: 0.98 },
    { site_name: "Site C", log_rr: Math.log(1.10), se_log_rr: 0.20, hr: 1.10, ci_lower: 0.74, ci_upper: 1.63 },
  ],
};

describe("EvidenceSynthesisVerdictDashboard", () => {
  it("renders method label", () => {
    render(<EvidenceSynthesisVerdictDashboard result={mockResult} />);
    expect(screen.getByText("Bayesian RE Pooled Estimate")).toBeInTheDocument();
  });

  it("renders pooled HR", () => {
    render(<EvidenceSynthesisVerdictDashboard result={mockResult} />);
    expect(screen.getByText(/HR 0\.750/)).toBeInTheDocument();
  });

  it("renders 95% CI", () => {
    render(<EvidenceSynthesisVerdictDashboard result={mockResult} />);
    expect(screen.getByText(/95% CI \[0\.600, 0\.900\]/)).toBeInTheDocument();
  });

  it("renders prediction interval for bayesian RE", () => {
    render(<EvidenceSynthesisVerdictDashboard result={mockResult} />);
    expect(screen.getByText(/PI \[/)).toBeInTheDocument();
  });

  it("does not render prediction interval for fixed effect", () => {
    const fixedResult: EvidenceSynthesisResult = {
      ...mockResult,
      method: "fixed",
      pooled: { ...mockResult.pooled, tau: 0 },
    };
    render(<EvidenceSynthesisVerdictDashboard result={fixedResult} />);
    expect(screen.queryByText(/PI \[/)).not.toBeInTheDocument();
  });

  it("renders significance badge as protective", () => {
    render(<EvidenceSynthesisVerdictDashboard result={mockResult} />);
    expect(screen.getByText("Significant (Protective)")).toBeInTheDocument();
  });

  it("renders site agreement count", () => {
    render(<EvidenceSynthesisVerdictDashboard result={mockResult} />);
    expect(screen.getByText("2 of 3 sites show protective effect")).toBeInTheDocument();
  });

  it("renders I-squared metric", () => {
    render(<EvidenceSynthesisVerdictDashboard result={mockResult} />);
    expect(screen.getByText("I-squared")).toBeInTheDocument();
  });

  it("renders tau-squared metric", () => {
    render(<EvidenceSynthesisVerdictDashboard result={mockResult} />);
    expect(screen.getByText("Tau-squared")).toBeInTheDocument();
  });

  it("renders Cochran Q metric", () => {
    render(<EvidenceSynthesisVerdictDashboard result={mockResult} />);
    expect(screen.getByText("Cochran's Q")).toBeInTheDocument();
  });

  it("renders fixed effect label when method is fixed", () => {
    const fixedResult: EvidenceSynthesisResult = {
      ...mockResult,
      method: "fixed",
      pooled: { ...mockResult.pooled, tau: 0 },
    };
    render(<EvidenceSynthesisVerdictDashboard result={fixedResult} />);
    expect(screen.getByText("Fixed Effect Pooled Estimate")).toBeInTheDocument();
  });

  it("renders heterogeneity map", () => {
    render(<EvidenceSynthesisVerdictDashboard result={mockResult} />);
    expect(screen.getByText("Site Heterogeneity Map")).toBeInTheDocument();
  });

  it("renders not significant badge when CI spans 1", () => {
    const nsResult: EvidenceSynthesisResult = {
      ...mockResult,
      pooled: { ...mockResult.pooled, hr: 0.95, ci_lower: 0.80, ci_upper: 1.15 },
    };
    render(<EvidenceSynthesisVerdictDashboard result={nsResult} />);
    expect(screen.getByText("Not Significant")).toBeInTheDocument();
  });

  it("renders harmful badge when HR>1 and CI excludes 1", () => {
    const harmfulResult: EvidenceSynthesisResult = {
      ...mockResult,
      pooled: { ...mockResult.pooled, hr: 1.50, ci_lower: 1.10, ci_upper: 2.00 },
    };
    render(<EvidenceSynthesisVerdictDashboard result={harmfulResult} />);
    expect(screen.getByText("Significant (Harmful)")).toBeInTheDocument();
  });
});
