import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EvidenceSynthesisVerdictDashboard } from "../EvidenceSynthesisVerdictDashboard";
import type { EvidenceSynthesisResult } from "../../types/evidenceSynthesis";

// ---------------------------------------------------------------------------
// Realistic fixtures matching R runtime EvidenceSynthesis output
// ---------------------------------------------------------------------------

/** Multi-site Bayesian meta-analysis: ACE inhibitors for MI across 4 sites */
const completeBayesianResult: EvidenceSynthesisResult = {
  status: "completed",
  method: "bayesian",
  pooled: {
    log_rr: Math.log(0.72),
    se_log_rr: 0.098,
    hr: 0.72,
    ci_lower: 0.58,
    ci_upper: 0.89,
    tau: 0.12,
  },
  per_site: [
    {
      site_name: "Columbia University Medical Center",
      log_rr: Math.log(0.68),
      se_log_rr: 0.14,
      hr: 0.68,
      ci_lower: 0.52,
      ci_upper: 0.89,
    },
    {
      site_name: "Stanford Medicine",
      log_rr: Math.log(0.75),
      se_log_rr: 0.16,
      hr: 0.75,
      ci_lower: 0.55,
      ci_upper: 1.02,
    },
    {
      site_name: "Optum EHR",
      log_rr: Math.log(0.70),
      se_log_rr: 0.11,
      hr: 0.70,
      ci_lower: 0.56,
      ci_upper: 0.87,
    },
    {
      site_name: "CPRD GOLD",
      log_rr: Math.log(1.05),
      se_log_rr: 0.22,
      hr: 1.05,
      ci_lower: 0.68,
      ci_upper: 1.62,
    },
  ],
  elapsed_seconds: 14.2,
};

/** Fixed effect with single site */
const singleSiteFixedResult: EvidenceSynthesisResult = {
  status: "completed",
  method: "fixed",
  pooled: {
    log_rr: Math.log(0.81),
    se_log_rr: 0.13,
    hr: 0.81,
    ci_lower: 0.63,
    ci_upper: 1.04,
    tau: 0,
  },
  per_site: [
    {
      site_name: "IQVIA PharMetrics Plus",
      log_rr: Math.log(0.81),
      se_log_rr: 0.13,
      hr: 0.81,
      ci_lower: 0.63,
      ci_upper: 1.04,
    },
  ],
};

/** Harmful pooled effect — all sites agree on direction */
const harmfulConsensusResult: EvidenceSynthesisResult = {
  status: "completed",
  method: "bayesian",
  pooled: {
    log_rr: Math.log(1.45),
    se_log_rr: 0.11,
    hr: 1.45,
    ci_lower: 1.17,
    ci_upper: 1.80,
    tau: 0.08,
  },
  per_site: [
    {
      site_name: "Site Alpha",
      log_rr: Math.log(1.38),
      se_log_rr: 0.15,
      hr: 1.38,
      ci_lower: 1.03,
      ci_upper: 1.85,
    },
    {
      site_name: "Site Beta",
      log_rr: Math.log(1.52),
      se_log_rr: 0.13,
      hr: 1.52,
      ci_lower: 1.18,
      ci_upper: 1.96,
    },
    {
      site_name: "Site Gamma",
      log_rr: Math.log(1.41),
      se_log_rr: 0.18,
      hr: 1.41,
      ci_lower: 0.99,
      ci_upper: 2.01,
    },
  ],
};

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe("EvidenceSynthesisVerdictDashboard Integration", () => {
  describe("complete Bayesian multi-site result", () => {
    it("renders the Bayesian RE method label", () => {
      render(<EvidenceSynthesisVerdictDashboard result={completeBayesianResult} />);
      expect(screen.getByText("Bayesian RE Pooled Estimate")).toBeInTheDocument();
    });

    it("displays pooled HR from API response", () => {
      render(<EvidenceSynthesisVerdictDashboard result={completeBayesianResult} />);
      expect(screen.getByText(/HR 0\.720/)).toBeInTheDocument();
    });

    it("displays 95% CI from pooled estimate", () => {
      render(<EvidenceSynthesisVerdictDashboard result={completeBayesianResult} />);
      expect(screen.getByText(/95% CI \[0\.580, 0\.890\]/)).toBeInTheDocument();
    });

    it("renders prediction interval for Bayesian with tau > 0", () => {
      render(<EvidenceSynthesisVerdictDashboard result={completeBayesianResult} />);
      expect(screen.getByText(/PI \[/)).toBeInTheDocument();
    });

    it("renders significance badge as protective", () => {
      render(<EvidenceSynthesisVerdictDashboard result={completeBayesianResult} />);
      expect(screen.getByText("Significant (Protective)")).toBeInTheDocument();
    });

    it("computes correct site agreement count", () => {
      render(<EvidenceSynthesisVerdictDashboard result={completeBayesianResult} />);
      // 3 of 4 sites have HR < 1
      expect(screen.getByText("3 of 4 sites show protective effect")).toBeInTheDocument();
    });

    it("renders heterogeneity metric cards", () => {
      render(<EvidenceSynthesisVerdictDashboard result={completeBayesianResult} />);
      expect(screen.getByText("I-squared")).toBeInTheDocument();
      expect(screen.getByText("Tau-squared")).toBeInTheDocument();
      expect(screen.getByText("Cochran's Q")).toBeInTheDocument();
      expect(screen.getByText("Sites")).toBeInTheDocument();
    });

    it("displays sites protective fraction", () => {
      render(<EvidenceSynthesisVerdictDashboard result={completeBayesianResult} />);
      expect(screen.getByText("3/4")).toBeInTheDocument();
    });

    it("renders heterogeneity map with correct number of sites", () => {
      render(<EvidenceSynthesisVerdictDashboard result={completeBayesianResult} />);
      expect(screen.getByText("Site Heterogeneity Map")).toBeInTheDocument();
    });
  });

  describe("single site — no heterogeneity", () => {
    it("renders Fixed Effect label for fixed method", () => {
      render(<EvidenceSynthesisVerdictDashboard result={singleSiteFixedResult} />);
      expect(screen.getByText("Fixed Effect Pooled Estimate")).toBeInTheDocument();
    });

    it("does not render prediction interval for fixed effect with tau=0", () => {
      render(<EvidenceSynthesisVerdictDashboard result={singleSiteFixedResult} />);
      expect(screen.queryByText(/PI \[/)).not.toBeInTheDocument();
    });

    it("shows Not Significant when CI spans 1", () => {
      render(<EvidenceSynthesisVerdictDashboard result={singleSiteFixedResult} />);
      expect(screen.getByText("Not Significant")).toBeInTheDocument();
    });

    it("shows 1/1 sites protective for single protective site", () => {
      render(<EvidenceSynthesisVerdictDashboard result={singleSiteFixedResult} />);
      expect(screen.getByText("1/1")).toBeInTheDocument();
      expect(screen.getByText("1 of 1 sites show protective effect")).toBeInTheDocument();
    });

    it("renders I-squared as 0 for single site", () => {
      render(<EvidenceSynthesisVerdictDashboard result={singleSiteFixedResult} />);
      // I-squared = 0 when df=0
      expect(screen.getByText("0.0%")).toBeInTheDocument();
    });
  });

  describe("harmful consensus result", () => {
    it("renders Significant (Harmful) badge", () => {
      render(<EvidenceSynthesisVerdictDashboard result={harmfulConsensusResult} />);
      expect(screen.getByText("Significant (Harmful)")).toBeInTheDocument();
    });

    it("shows 0 of 3 sites protective", () => {
      render(<EvidenceSynthesisVerdictDashboard result={harmfulConsensusResult} />);
      expect(screen.getByText("0 of 3 sites show protective effect")).toBeInTheDocument();
    });

    it("displays pooled HR > 1", () => {
      render(<EvidenceSynthesisVerdictDashboard result={harmfulConsensusResult} />);
      expect(screen.getByText(/HR 1\.450/)).toBeInTheDocument();
    });
  });
});
