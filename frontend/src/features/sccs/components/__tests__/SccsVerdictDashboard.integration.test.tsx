import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SccsVerdictDashboard } from "../SccsVerdictDashboard";
import type { SccsResult } from "../../types/sccs";

// ---------------------------------------------------------------------------
// Realistic fixtures matching Darkstar SelfControlledCaseSeries output
// ---------------------------------------------------------------------------

/** Complete SCCS: Fluoroquinolone antibiotics and acute tendon rupture */
const completeSccsResult: SccsResult = {
  status: "completed",
  estimates: [
    {
      covariate: "Fluoroquinolone exposure (0-28 days)",
      irr: 3.12,
      ci_lower: 2.34,
      ci_upper: 4.16,
      log_rr: 1.138,
      se_log_rr: 0.147,
    },
    {
      covariate: "Age (per 10 years)",
      irr: 1.08,
      ci_lower: 1.02,
      ci_upper: 1.14,
      log_rr: 0.077,
      se_log_rr: 0.029,
    },
    {
      covariate: "Corticosteroid co-medication",
      irr: 1.65,
      ci_lower: 1.12,
      ci_upper: 2.43,
      log_rr: 0.501,
      se_log_rr: 0.198,
    },
  ],
  population: {
    cases: 1842,
    outcomes: 2156,
    observation_periods: 3684,
  },
  eras: [
    {
      era_name: "Pre-exposure (-30 to -1)",
      era_type: "pre-exposure",
      start_day: -30,
      end_day: -1,
      event_count: 42,
      person_days: 18420,
      irr: 1.15,
      ci_lower: 0.82,
      ci_upper: 1.62,
    },
    {
      era_name: "Exposure (0-28 days)",
      era_type: "exposure",
      start_day: 0,
      end_day: 28,
      event_count: 189,
      person_days: 15340,
      irr: 3.12,
      ci_lower: 2.34,
      ci_upper: 4.16,
    },
    {
      era_name: "Post-exposure (29-60)",
      era_type: "post-exposure",
      start_day: 29,
      end_day: 60,
      event_count: 52,
      person_days: 16850,
      irr: 1.08,
      ci_lower: 0.78,
      ci_upper: 1.49,
    },
    {
      era_name: "Control (61-365)",
      era_type: "control",
      start_day: 61,
      end_day: 365,
      event_count: 1873,
      person_days: 560400,
      irr: 1.0,
      ci_lower: 0.92,
      ci_upper: 1.09,
    },
  ],
  elapsed_seconds: 32.5,
};

/** SCCS with pre-exposure trend test failure: elevated pre-exposure IRR > 1.5 */
const preExposureFailResult: SccsResult = {
  status: "completed",
  estimates: [
    {
      covariate: "NSAID exposure",
      irr: 2.1,
      ci_lower: 1.6,
      ci_upper: 2.76,
      log_rr: 0.742,
      se_log_rr: 0.139,
    },
  ],
  population: {
    cases: 980,
    outcomes: 1120,
    observation_periods: 1960,
  },
  eras: [
    {
      era_name: "Pre-exposure (-14 to -1)",
      era_type: "pre-exposure",
      start_day: -14,
      end_day: -1,
      event_count: 95,
      person_days: 4900,
      irr: 1.85,
      ci_lower: 1.35,
      ci_upper: 2.54,
    },
    {
      era_name: "Exposure (0-14 days)",
      era_type: "exposure",
      start_day: 0,
      end_day: 14,
      event_count: 120,
      person_days: 4800,
      irr: 2.1,
      ci_lower: 1.6,
      ci_upper: 2.76,
    },
    {
      era_name: "Control (15-365)",
      era_type: "control",
      start_day: 15,
      end_day: 365,
      event_count: 905,
      person_days: 343000,
      irr: 0.55,
      ci_lower: 0.42,
      ci_upper: 0.72,
    },
  ],
};

/** SCCS with no exposure era — only control period */
const noExposureEraResult: SccsResult = {
  status: "completed",
  estimates: [
    {
      covariate: "Seasonal adjustment",
      irr: 1.02,
      ci_lower: 0.95,
      ci_upper: 1.1,
      log_rr: 0.02,
      se_log_rr: 0.038,
    },
  ],
  population: {
    cases: 350,
    outcomes: 410,
    observation_periods: 700,
  },
  eras: [
    {
      era_name: "Control period",
      era_type: "control",
      start_day: 0,
      end_day: 365,
      event_count: 410,
      person_days: 127750,
    },
  ],
};

/** Protective effect (IRR < 1) — vaccine study */
const protectiveSccsResult: SccsResult = {
  status: "completed",
  estimates: [
    {
      covariate: "Influenza vaccine (0-42 days)",
      irr: 0.72,
      ci_lower: 0.58,
      ci_upper: 0.89,
      log_rr: -0.329,
      se_log_rr: 0.109,
    },
  ],
  population: {
    cases: 2500,
    outcomes: 2850,
    observation_periods: 5000,
  },
  eras: [
    {
      era_name: "Pre-vaccination",
      era_type: "pre-exposure",
      start_day: -14,
      end_day: -1,
      event_count: 55,
      person_days: 12500,
      irr: 1.05,
      ci_lower: 0.78,
      ci_upper: 1.42,
    },
    {
      era_name: "Post-vaccination (0-42)",
      era_type: "exposure",
      start_day: 0,
      end_day: 42,
      event_count: 180,
      person_days: 35000,
      irr: 0.72,
      ci_lower: 0.58,
      ci_upper: 0.89,
    },
    {
      era_name: "Control",
      era_type: "control",
      start_day: 43,
      end_day: 365,
      event_count: 2615,
      person_days: 805000,
      irr: 1.0,
      ci_lower: 0.95,
      ci_upper: 1.05,
    },
  ],
};

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe("SccsVerdictDashboard Integration", () => {
  describe("complete result with all eras", () => {
    it("renders the dashboard container", () => {
      render(<SccsVerdictDashboard result={completeSccsResult} />);
      expect(screen.getByTestId("sccs-verdict-dashboard")).toBeInTheDocument();
    });

    it("displays primary exposure IRR", () => {
      render(<SccsVerdictDashboard result={completeSccsResult} />);
      expect(screen.getByTestId("primary-irr")).toHaveTextContent("3.12");
    });

    it("shows up arrow for IRR > 1", () => {
      render(<SccsVerdictDashboard result={completeSccsResult} />);
      expect(screen.getByTestId("direction-arrow")).toHaveTextContent("\u2191");
    });

    it("shows Statistically Significant badge", () => {
      render(<SccsVerdictDashboard result={completeSccsResult} />);
      expect(screen.getByTestId("significance-verdict")).toHaveTextContent(
        "Statistically Significant",
      );
    });

    it("displays 95% CI for primary IRR", () => {
      render(<SccsVerdictDashboard result={completeSccsResult} />);
      expect(screen.getByText(/95% CI: 2\.34 - 4\.16/)).toBeInTheDocument();
    });

    it("displays absolute excess risk", () => {
      render(<SccsVerdictDashboard result={completeSccsResult} />);
      expect(screen.getByTestId("excess-risk")).toBeInTheDocument();
    });

    it("shows PASS for pre-exposure trend (IRR 1.15 <= 1.5)", () => {
      render(<SccsVerdictDashboard result={completeSccsResult} />);
      expect(screen.getByTestId("pre-exposure-badge")).toHaveTextContent("PASS");
    });

    it("displays control period IRR close to 1.0", () => {
      render(<SccsVerdictDashboard result={completeSccsResult} />);
      expect(screen.getByTestId("control-irr")).toHaveTextContent("1.00");
    });

    it("renders multi-window comparison strip", () => {
      render(<SccsVerdictDashboard result={completeSccsResult} />);
      expect(screen.getByTestId("multi-window-strip")).toBeInTheDocument();
    });

    it("renders window blocks for all 4 eras", () => {
      render(<SccsVerdictDashboard result={completeSccsResult} />);
      expect(screen.getByTestId("window-block-pre-exposure")).toBeInTheDocument();
      expect(screen.getByTestId("window-block-exposure")).toBeInTheDocument();
      expect(screen.getByTestId("window-block-post-exposure")).toBeInTheDocument();
      expect(screen.getByTestId("window-block-control")).toBeInTheDocument();
    });
  });

  describe("pre-exposure trend test failure", () => {
    it("shows FAIL badge when pre-exposure IRR > 1.5", () => {
      render(<SccsVerdictDashboard result={preExposureFailResult} />);
      expect(screen.getByTestId("pre-exposure-badge")).toHaveTextContent("FAIL");
    });

    it("flags control period deviation from 1.0 (IRR 0.55)", () => {
      render(<SccsVerdictDashboard result={preExposureFailResult} />);
      const controlIrr = screen.getByTestId("control-irr");
      expect(controlIrr).toHaveTextContent("0.55");
      expect(controlIrr).toHaveTextContent("misspecification");
    });
  });

  describe("no exposure era", () => {
    it("renders gracefully with no exposure era message", () => {
      render(<SccsVerdictDashboard result={noExposureEraResult} />);
      expect(screen.getByTestId("risk-window-summary")).toBeInTheDocument();
      expect(
        screen.getByText("No exposure era with IRR data available."),
      ).toBeInTheDocument();
    });

    it("still renders multi-window strip for existing eras", () => {
      render(<SccsVerdictDashboard result={noExposureEraResult} />);
      expect(screen.getByTestId("multi-window-strip")).toBeInTheDocument();
      expect(screen.getByTestId("window-block-control")).toBeInTheDocument();
    });
  });

  describe("protective effect (IRR < 1)", () => {
    it("shows down arrow for protective IRR", () => {
      render(<SccsVerdictDashboard result={protectiveSccsResult} />);
      expect(screen.getByTestId("direction-arrow")).toHaveTextContent("\u2193");
    });

    it("shows Statistically Significant badge for protective effect", () => {
      render(<SccsVerdictDashboard result={protectiveSccsResult} />);
      expect(screen.getByTestId("significance-verdict")).toHaveTextContent(
        "Statistically Significant",
      );
    });

    it("displays IRR value below 1", () => {
      render(<SccsVerdictDashboard result={protectiveSccsResult} />);
      expect(screen.getByTestId("primary-irr")).toHaveTextContent("0.72");
    });
  });
});
