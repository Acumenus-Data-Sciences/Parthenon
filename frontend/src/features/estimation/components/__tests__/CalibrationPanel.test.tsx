import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalibrationPanel } from "../CalibrationPanel";
import type { EstimationResult } from "../../types/estimation";

function baseResult(
  calibration: EstimationResult["calibration"],
): EstimationResult {
  return {
    summary: { target_count: 100, comparator_count: 100, outcome_counts: {} },
    estimates: [
      {
        outcome_id: 1,
        outcome_name: "MACE composite",
        hazard_ratio: 1.65,
        ci_95_lower: 1.3,
        ci_95_upper: 2.1,
        p_value: 0.0001,
        log_hr: 0.5,
        se_log_hr: 0.1,
        target_outcomes: 50,
        comparator_outcomes: 40,
      },
    ],
    calibration,
  };
}

describe("CalibrationPanel", () => {
  it("renders the systematic-error metrics and calibrated estimates when calibration completed", () => {
    const result = baseResult({
      status: "completed",
      min_negative_controls: 5,
      informative_negative_controls: 8,
      ease: 0.1426,
      systematic_error_model: { null_mean: 0.1132, null_sd: 0.1335 },
      calibrated_estimates: [
        {
          outcome_id: 1,
          outcome_name: "MACE composite",
          calibrated: true,
          calibrated_hr: 1.47,
          cal_ci_lower: 1.06,
          cal_ci_upper: 2.04,
          calibrated_p: 0.02,
        },
      ],
      calibration_plot: { negative_controls: [{ log_rr: 0.3, se_log_rr: 0.12 }] },
    });

    render(<CalibrationPanel result={result} />);

    expect(screen.getByTestId("calibration-panel")).toBeInTheDocument();
    expect(screen.getByText("Empirical Calibration")).toBeInTheDocument();
    expect(screen.getByText("EASE")).toBeInTheDocument();
    expect(screen.getByText("Systematic bias")).toBeInTheDocument();
    expect(screen.getByText("MACE composite")).toBeInTheDocument();
  });

  it("warns and hides the calibrated table when controls are insufficient", () => {
    const result = baseResult({
      status: "insufficient_controls",
      min_negative_controls: 5,
      informative_negative_controls: 2,
      message: "Only 2 informative negative control(s) (need at least 5).",
      calibrated_estimates: [],
    });

    render(<CalibrationPanel result={result} />);

    expect(
      screen.getByText(/Only 2 informative negative control/),
    ).toBeInTheDocument();
    expect(screen.queryByText("EASE")).not.toBeInTheDocument();
  });

  it("renders nothing when there is no calibration block", () => {
    const { container } = render(<CalibrationPanel result={baseResult(null)} />);
    expect(container).toBeEmptyDOMElement();
  });
});
