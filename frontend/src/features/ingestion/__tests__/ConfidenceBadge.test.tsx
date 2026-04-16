import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ConfidenceBadge } from "@/features/ingestion/components/ConfidenceBadge";

describe("ConfidenceBadge", () => {
  it("renders score with correct formatting (2 decimal places)", () => {
    render(<ConfidenceBadge score={0.987} />);
    expect(screen.getByText("0.99")).toBeInTheDocument();
  });

  it('shows "High" label for score >= 0.95', () => {
    render(<ConfidenceBadge score={0.95} />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it('shows "High" label for score of 1.0', () => {
    render(<ConfidenceBadge score={1.0} />);
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("1.00")).toBeInTheDocument();
  });

  it('shows "Medium" label for score in 0.70-0.95 range', () => {
    render(<ConfidenceBadge score={0.82} />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("0.82")).toBeInTheDocument();
  });

  it('shows "Medium" label for score at lower boundary of 0.70', () => {
    render(<ConfidenceBadge score={0.7} />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it('shows "Low" label for score < 0.70', () => {
    render(<ConfidenceBadge score={0.45} />);
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText("0.45")).toBeInTheDocument();
  });

  it('shows "--" for score of 0', () => {
    render(<ConfidenceBadge score={0} />);
    expect(screen.getByText("--")).toBeInTheDocument();
  });

  it('shows "None" label for score of 0', () => {
    render(<ConfidenceBadge score={0} />);
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("applies success color class for high confidence", () => {
    const { container } = render(<ConfidenceBadge score={0.98} />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain("text-success");
    expect(badge.className).toContain("bg-success/20");
  });

  it("applies warning color class for medium confidence", () => {
    const { container } = render(<ConfidenceBadge score={0.85} />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain("text-warning");
    expect(badge.className).toContain("bg-warning/20");
  });

  it("applies critical color class for low confidence", () => {
    const { container } = render(<ConfidenceBadge score={0.3} />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain("text-critical");
    expect(badge.className).toContain("bg-critical/20");
  });
});
