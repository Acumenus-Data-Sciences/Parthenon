import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SiteHeterogeneityMap, type HeterogeneitySite } from "../SiteHeterogeneityMap";

const mockSites: HeterogeneitySite[] = [
  { site_name: "Site A", hr: 0.75, ci_lower: 0.55, ci_upper: 0.95, weight: 40 },
  { site_name: "Site B", hr: 1.20, ci_lower: 0.90, ci_upper: 1.60, weight: 30 },
  { site_name: "Site C", hr: 1.50, ci_lower: 1.10, ci_upper: 2.00, weight: 30 },
];

describe("SiteHeterogeneityMap", () => {
  it("renders heading", () => {
    render(<SiteHeterogeneityMap sites={mockSites} pooledHr={0.85} />);
    expect(screen.getByText("Site Heterogeneity Map")).toBeInTheDocument();
  });

  it("renders one bubble per site with aria-label", () => {
    render(<SiteHeterogeneityMap sites={mockSites} pooledHr={0.85} />);
    expect(screen.getByLabelText("Site A")).toBeInTheDocument();
    expect(screen.getByLabelText("Site B")).toBeInTheDocument();
    expect(screen.getByLabelText("Site C")).toBeInTheDocument();
  });

  it("renders nothing for empty sites array", () => {
    const { container } = render(<SiteHeterogeneityMap sites={[]} pooledHr={1.0} />);
    expect(container.innerHTML).toBe("");
  });

  it("applies teal color for protective (HR<1, CI excludes 1)", () => {
    render(<SiteHeterogeneityMap sites={mockSites} pooledHr={0.85} />);
    const siteA = screen.getByLabelText("Site A");
    expect(siteA).toHaveAttribute("fill", "#2DD4BF");
  });

  it("applies gray color when CI spans null", () => {
    render(<SiteHeterogeneityMap sites={mockSites} pooledHr={0.85} />);
    const siteB = screen.getByLabelText("Site B");
    expect(siteB).toHaveAttribute("fill", "#8A857D");
  });

  it("applies red color for harmful (HR>1, CI excludes 1)", () => {
    render(<SiteHeterogeneityMap sites={mockSites} pooledHr={0.85} />);
    const siteC = screen.getByLabelText("Site C");
    expect(siteC).toHaveAttribute("fill", "#E85A6B");
  });

  it("shows tooltip on hover", () => {
    render(<SiteHeterogeneityMap sites={mockSites} pooledHr={0.85} />);
    const siteA = screen.getByLabelText("Site A");
    fireEvent.mouseEnter(siteA);
    expect(screen.getByText("Site A")).toBeInTheDocument();
    // Tooltip should contain HR info
    expect(screen.getByText(/HR 0\.750/)).toBeInTheDocument();
  });

  it("renders axis label", () => {
    render(<SiteHeterogeneityMap sites={mockSites} pooledHr={0.85} />);
    expect(screen.getByText("Hazard Ratio (log scale)")).toBeInTheDocument();
  });
});
