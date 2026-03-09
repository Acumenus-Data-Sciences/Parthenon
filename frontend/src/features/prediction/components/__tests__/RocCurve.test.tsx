import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RocCurve } from "../RocCurve";

const sampleData = [
  { fpr: 0, tpr: 0 },
  { fpr: 0.1, tpr: 0.5 },
  { fpr: 0.2, tpr: 0.7 },
  { fpr: 0.3, tpr: 0.8 },
  { fpr: 0.5, tpr: 0.9 },
  { fpr: 0.8, tpr: 0.95 },
  { fpr: 1, tpr: 1 },
];

describe("RocCurve", () => {
  it("renders the SVG", () => {
    render(<RocCurve data={sampleData} auc={0.85} />);
    expect(screen.getByTestId("roc-curve-svg")).toBeInTheDocument();
  });

  it("shows AUC value", () => {
    render(<RocCurve data={sampleData} auc={0.85} />);
    expect(screen.getByText(/AUC = 0\.850/)).toBeInTheDocument();
  });

  it("renders Youden J optimal point", () => {
    render(<RocCurve data={sampleData} auc={0.85} />);
    expect(screen.getByTestId("youden-j-point")).toBeInTheDocument();
    expect(screen.getByTestId("youden-j-label")).toBeInTheDocument();
  });

  it("computes correct Youden J point (max TPR-FPR)", () => {
    // For sample data, TPR-FPR values:
    // 0-0=0, 0.5-0.1=0.4, 0.7-0.2=0.5, 0.8-0.3=0.5, 0.9-0.5=0.4, 0.95-0.8=0.15, 1-1=0
    // Max is 0.5 at (0.2, 0.7) or (0.3, 0.8) — first match wins
    render(<RocCurve data={sampleData} auc={0.85} />);
    const label = screen.getByTestId("youden-j-label");
    expect(label.textContent).toContain("J=0.50");
  });

  it("renders validation overlay when validationData is provided", () => {
    const validationData = [
      { fpr: 0, tpr: 0 },
      { fpr: 0.15, tpr: 0.45 },
      { fpr: 0.3, tpr: 0.65 },
      { fpr: 1, tpr: 1 },
    ];
    render(<RocCurve data={sampleData} auc={0.85} validationData={validationData} />);
    expect(screen.getByTestId("roc-validation-curve")).toBeInTheDocument();
  });

  it("does not render validation overlay when not provided", () => {
    render(<RocCurve data={sampleData} auc={0.85} />);
    expect(screen.queryByTestId("roc-validation-curve")).not.toBeInTheDocument();
  });

  it("handles empty data gracefully", () => {
    render(<RocCurve data={[]} auc={0} />);
    expect(screen.getByTestId("roc-curve-svg")).toBeInTheDocument();
  });
});
