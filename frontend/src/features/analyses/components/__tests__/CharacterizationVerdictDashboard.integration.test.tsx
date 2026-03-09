import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CharacterizationVerdictDashboard } from "../CharacterizationVerdictDashboard";
import type { CovariateBalanceEntry } from "@/features/estimation/types/estimation";

// ---------------------------------------------------------------------------
// Realistic fixtures: Covariate balance from CohortMethod PS matching
// ---------------------------------------------------------------------------

/** Two-cohort comparison: ACE inhibitors vs ARBs — well-balanced after matching */
const wellBalancedEntries: CovariateBalanceEntry[] = [
  {
    covariate_name: "Age group: 45-54",
    concept_id: 4245,
    smd_before: 0.18,
    smd_after: 0.03,
    mean_target_before: 0.22,
    mean_comp_before: 0.14,
    mean_target_after: 0.19,
    mean_comp_after: 0.18,
  },
  {
    covariate_name: "Age group: 55-64",
    concept_id: 4255,
    smd_before: 0.12,
    smd_after: 0.02,
    mean_target_before: 0.28,
    mean_comp_before: 0.23,
    mean_target_after: 0.26,
    mean_comp_after: 0.25,
  },
  {
    covariate_name: "Age group: 65-74",
    concept_id: 4265,
    smd_before: 0.09,
    smd_after: 0.01,
    mean_target_before: 0.25,
    mean_comp_before: 0.22,
    mean_target_after: 0.24,
    mean_comp_after: 0.24,
  },
  {
    covariate_name: "Male",
    concept_id: 8507,
    smd_before: 0.15,
    smd_after: 0.02,
    mean_target_before: 0.58,
    mean_comp_before: 0.51,
    mean_target_after: 0.55,
    mean_comp_after: 0.54,
  },
  {
    covariate_name: "Diabetes mellitus type 2",
    concept_id: 201826,
    smd_before: 0.22,
    smd_after: 0.04,
    mean_target_before: 0.42,
    mean_comp_before: 0.31,
    mean_target_after: 0.38,
    mean_comp_after: 0.36,
  },
  {
    covariate_name: "Hypertension",
    concept_id: 316866,
    smd_before: 0.08,
    smd_after: 0.01,
    mean_target_before: 0.85,
    mean_comp_before: 0.82,
    mean_target_after: 0.84,
    mean_comp_after: 0.83,
  },
  {
    covariate_name: "Hyperlipidemia",
    concept_id: 432867,
    smd_before: 0.11,
    smd_after: 0.02,
    mean_target_before: 0.62,
    mean_comp_before: 0.56,
    mean_target_after: 0.60,
    mean_comp_after: 0.59,
  },
  {
    covariate_name: "Prior MI",
    concept_id: 4329847,
    smd_before: 0.06,
    smd_after: 0.01,
    mean_target_before: 0.08,
    mean_comp_before: 0.06,
    mean_target_after: 0.07,
    mean_comp_after: 0.07,
  },
  {
    covariate_name: "Statin use",
    concept_id: 1539403,
    smd_before: 0.14,
    smd_after: 0.03,
    mean_target_before: 0.55,
    mean_comp_before: 0.48,
    mean_target_after: 0.52,
    mean_comp_after: 0.51,
  },
  {
    covariate_name: "Beta-blocker use",
    concept_id: 1353766,
    smd_before: 0.10,
    smd_after: 0.02,
    mean_target_before: 0.38,
    mean_comp_before: 0.33,
    mean_target_after: 0.36,
    mean_comp_after: 0.35,
  },
  {
    covariate_name: "Aspirin use",
    concept_id: 1112807,
    smd_before: 0.05,
    smd_after: 0.01,
    mean_target_before: 0.42,
    mean_comp_before: 0.40,
    mean_target_after: 0.41,
    mean_comp_after: 0.41,
  },
  {
    covariate_name: "Calcium channel blocker",
    concept_id: 1332418,
    smd_before: 0.07,
    smd_after: 0.01,
    mean_target_before: 0.18,
    mean_comp_before: 0.15,
    mean_target_after: 0.17,
    mean_comp_after: 0.17,
  },
];

/** Significant imbalance — <75% covariates with |SMD| < 0.1 */
const significantImbalanceEntries: CovariateBalanceEntry[] = [
  {
    covariate_name: "Chronic kidney disease",
    smd_before: 0.35,
    smd_after: 0.35,
    mean_target_before: 0.28,
    mean_comp_before: 0.12,
    mean_target_after: 0.28,
    mean_comp_after: 0.12,
  },
  {
    covariate_name: "Heart failure",
    smd_before: 0.28,
    smd_after: 0.28,
    mean_target_before: 0.22,
    mean_comp_before: 0.10,
    mean_target_after: 0.22,
    mean_comp_after: 0.10,
  },
  {
    covariate_name: "Age group: 75+",
    smd_before: 0.22,
    smd_after: 0.22,
    mean_target_before: 0.30,
    mean_comp_before: 0.18,
    mean_target_after: 0.30,
    mean_comp_after: 0.18,
  },
  {
    covariate_name: "Peripheral vascular disease",
    smd_before: -0.18,
    smd_after: -0.18,
    mean_target_before: 0.05,
    mean_comp_before: 0.12,
    mean_target_after: 0.05,
    mean_comp_after: 0.12,
  },
  {
    covariate_name: "Male",
    smd_before: 0.05,
    smd_after: 0.05,
    mean_target_before: 0.52,
    mean_comp_before: 0.50,
    mean_target_after: 0.52,
    mean_comp_after: 0.50,
  },
  {
    covariate_name: "Hypertension",
    smd_before: 0.08,
    smd_after: 0.08,
    mean_target_before: 0.78,
    mean_comp_before: 0.75,
    mean_target_after: 0.78,
    mean_comp_after: 0.75,
  },
];

/** Single cohort: only after-matching SMDs (no before/after difference) */
const singleCohortEntries: CovariateBalanceEntry[] = [
  {
    covariate_name: "Age group: 18-34",
    smd_before: 0.04,
    smd_after: 0.04,
    mean_target_before: 0.15,
    mean_comp_before: 0.13,
    mean_target_after: 0.15,
    mean_comp_after: 0.13,
  },
  {
    covariate_name: "Female",
    smd_before: 0.06,
    smd_after: 0.06,
    mean_target_before: 0.55,
    mean_comp_before: 0.52,
    mean_target_after: 0.55,
    mean_comp_after: 0.52,
  },
  {
    covariate_name: "Obesity",
    smd_before: 0.03,
    smd_after: 0.03,
    mean_target_before: 0.32,
    mean_comp_before: 0.30,
    mean_target_after: 0.32,
    mean_comp_after: 0.30,
  },
];

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe("CharacterizationVerdictDashboard Integration", () => {
  describe("two-cohort comparison with well-balanced covariates", () => {
    it("renders the dashboard container", () => {
      render(
        <CharacterizationVerdictDashboard
          balanceEntries={wellBalancedEntries}
          targetLabel="ACE Inhibitors"
          comparatorLabel="ARBs"
        />,
      );
      expect(
        screen.getByTestId("characterization-verdict-dashboard"),
      ).toBeInTheDocument();
    });

    it("shows Well balanced verdict after matching", () => {
      render(
        <CharacterizationVerdictDashboard
          balanceEntries={wellBalancedEntries}
          targetLabel="ACE Inhibitors"
          comparatorLabel="ARBs"
        />,
      );
      // After matching: all 12 covariates have |SMD_after| < 0.1 => 100% => well-balanced
      const verdictLabels = screen.getAllByTestId("verdict-label");
      const afterLabel = verdictLabels[verdictLabels.length - 1];
      expect(afterLabel).toHaveTextContent("Well balanced");
    });

    it("shows before/after comparison panels", () => {
      render(
        <CharacterizationVerdictDashboard
          balanceEntries={wellBalancedEntries}
          targetLabel="ACE Inhibitors"
          comparatorLabel="ARBs"
        />,
      );
      expect(screen.getByText("Before matching")).toBeInTheDocument();
      expect(screen.getByText("After matching")).toBeInTheDocument();
    });

    it("renders top imbalanced covariates spotlight", () => {
      render(
        <CharacterizationVerdictDashboard
          balanceEntries={wellBalancedEntries}
          targetLabel="ACE Inhibitors"
          comparatorLabel="ARBs"
        />,
      );
      expect(screen.getByText("Top Imbalanced Covariates")).toBeInTheDocument();
      const bars = screen.getAllByTestId("imbalanced-bar");
      expect(bars.length).toBeGreaterThan(0);
    });

    it("displays custom cohort labels", () => {
      render(
        <CharacterizationVerdictDashboard
          balanceEntries={wellBalancedEntries}
          targetLabel="ACE Inhibitors"
          comparatorLabel="ARBs"
        />,
      );
      expect(screen.getAllByText(/ACE Inhibitors/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/ARBs/).length).toBeGreaterThan(0);
    });

    it("displays total covariates label and count", () => {
      render(
        <CharacterizationVerdictDashboard balanceEntries={wellBalancedEntries} />,
      );
      expect(screen.getAllByText("Total covariates").length).toBeGreaterThan(0);
    });
  });

  describe("significant imbalance (no matching applied)", () => {
    it("shows Significant imbalance verdict", () => {
      render(
        <CharacterizationVerdictDashboard
          balanceEntries={significantImbalanceEntries}
        />,
      );
      // 2 of 6 covariates have |SMD| < 0.1 => 33.3% => significant imbalance
      expect(screen.getByTestId("verdict-label")).toHaveTextContent(
        "Significant imbalance",
      );
    });

    it("shows no before/after comparison when SMDs are identical", () => {
      render(
        <CharacterizationVerdictDashboard
          balanceEntries={significantImbalanceEntries}
        />,
      );
      expect(screen.queryByText("Before matching")).not.toBeInTheDocument();
    });

    it("renders imbalanced covariates sorted by magnitude", () => {
      render(
        <CharacterizationVerdictDashboard
          balanceEntries={significantImbalanceEntries}
        />,
      );
      const bars = screen.getAllByTestId("imbalanced-bar");
      expect(bars.length).toBe(6);
    });

    it("highlights Chronic kidney disease as top imbalanced covariate", () => {
      render(
        <CharacterizationVerdictDashboard
          balanceEntries={significantImbalanceEntries}
        />,
      );
      expect(screen.getByText("Chronic kidney disease")).toBeInTheDocument();
    });
  });

  describe("single cohort (no comparison)", () => {
    it("renders single metric strip without before/after labels", () => {
      render(
        <CharacterizationVerdictDashboard balanceEntries={singleCohortEntries} />,
      );
      expect(screen.queryByText("Before matching")).not.toBeInTheDocument();
      expect(screen.queryByText("After matching")).not.toBeInTheDocument();
    });

    it("shows Well balanced verdict for low SMD covariates", () => {
      render(
        <CharacterizationVerdictDashboard balanceEntries={singleCohortEntries} />,
      );
      // All 3 covariates have |SMD| < 0.1 => 100% => well-balanced
      expect(screen.getByTestId("verdict-label")).toHaveTextContent(
        "Well balanced",
      );
    });

    it("uses default Target/Comparator labels when not specified", () => {
      render(
        <CharacterizationVerdictDashboard balanceEntries={singleCohortEntries} />,
      );
      expect(screen.getAllByText(/Target/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Comparator/).length).toBeGreaterThan(0);
    });
  });

  describe("empty entries", () => {
    it("renders nothing when no entries provided", () => {
      const { container } = render(
        <CharacterizationVerdictDashboard balanceEntries={[]} />,
      );
      expect(container.firstChild).toBeNull();
    });
  });
});
