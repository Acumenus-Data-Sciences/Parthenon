import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SignificanceVerdictBadge, getVerdict } from "../SignificanceVerdictBadge";

describe("getVerdict", () => {
  it("returns protective when HR < 1, p < 0.05, and CI does not span 1", () => {
    expect(getVerdict(0.7, 0.01, 0.5, 0.9)).toBe("protective");
  });

  it("returns harmful when HR > 1, p < 0.05, and CI does not span 1", () => {
    expect(getVerdict(1.5, 0.01, 1.1, 2.0)).toBe("harmful");
  });

  it("returns not_significant when p >= 0.05", () => {
    expect(getVerdict(0.7, 0.06)).toBe("not_significant");
  });

  it("returns not_significant when CI spans null", () => {
    expect(getVerdict(0.7, 0.01, 0.8, 1.2)).toBe("not_significant");
  });

  it("returns protective when HR < 1, p < 0.05, and no CI provided", () => {
    expect(getVerdict(0.7, 0.01)).toBe("protective");
  });

  it("returns harmful when HR > 1, p < 0.05, and no CI provided", () => {
    expect(getVerdict(1.5, 0.01)).toBe("harmful");
  });
});

describe("SignificanceVerdictBadge", () => {
  it("renders protective badge", () => {
    render(<SignificanceVerdictBadge hr={0.6} pValue={0.001} ciLower={0.4} ciUpper={0.8} />);
    expect(screen.getByText("Significant protective effect")).toBeInTheDocument();
  });

  it("renders harmful badge", () => {
    render(<SignificanceVerdictBadge hr={1.8} pValue={0.002} ciLower={1.2} ciUpper={2.5} />);
    expect(screen.getByText("Significant harmful effect")).toBeInTheDocument();
  });

  it("renders not significant badge when p is high", () => {
    render(<SignificanceVerdictBadge hr={0.9} pValue={0.3} />);
    expect(screen.getByText("Not statistically significant")).toBeInTheDocument();
  });

  it("renders not significant badge when CI spans null", () => {
    render(<SignificanceVerdictBadge hr={0.9} pValue={0.04} ciLower={0.7} ciUpper={1.1} />);
    expect(screen.getByText("Not statistically significant")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<SignificanceVerdictBadge hr={0.6} pValue={0.001} className="my-class" />);
    const badge = screen.getByTestId("significance-verdict-badge");
    expect(badge.className).toContain("my-class");
  });
});
