import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SimilarityBar } from "../components/SimilarityBar";

describe("SimilarityBar", () => {
  it("renders the percentage to one decimal", () => {
    render(<SimilarityBar value={0.7345} />);
    expect(screen.getByText("73.5%")).toBeInTheDocument();
  });

  it("clamps values above 1 and below 0", () => {
    render(<SimilarityBar value={1.05} ariaLabel="Top match" />);
    const bar = screen.getByRole("progressbar", { name: "Top match" });
    expect(bar).toHaveAttribute("aria-valuenow", "1");
    expect(bar).toHaveAttribute("aria-valuemax", "1");
  });

  it("applies the teal class for high values >= 0.8", () => {
    const { container } = render(<SimilarityBar value={0.85} />);
    const fill = container.querySelector(".bg-\\[\\#2DD4BF\\]");
    expect(fill).not.toBeNull();
  });

  it("applies the gold class for borderline values [0.6, 0.8)", () => {
    const { container } = render(<SimilarityBar value={0.7} />);
    const fill = container.querySelector(".bg-\\[\\#C9A227\\]");
    expect(fill).not.toBeNull();
  });

  it("applies the crimson class for low-confidence values < 0.6", () => {
    const { container } = render(<SimilarityBar value={0.4} />);
    const fill = container.querySelector(".bg-\\[\\#9B1B30\\]");
    expect(fill).not.toBeNull();
  });
});
