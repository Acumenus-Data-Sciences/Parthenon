import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CIBar } from "../CIBar";

describe("CIBar", () => {
  it("renders an SVG element", () => {
    render(<CIBar estimate={0.8} ciLower={0.6} ciUpper={0.95} />);
    const svg = screen.getByTestId("ci-bar");
    expect(svg.tagName).toBe("svg");
  });

  it("uses gray color when CI spans null", () => {
    render(<CIBar estimate={0.9} ciLower={0.7} ciUpper={1.3} />);
    const svg = screen.getByTestId("ci-bar");
    // The CI line should be gray (#8A857D)
    const lines = svg.querySelectorAll("line");
    // CI horizontal line is the second line (first is the null reference)
    const ciLine = lines[1];
    expect(ciLine.getAttribute("stroke")).toBe("#8A857D");
  });

  it("uses teal when estimate < null and CI does not span null", () => {
    render(<CIBar estimate={0.7} ciLower={0.5} ciUpper={0.9} />);
    const svg = screen.getByTestId("ci-bar");
    const circle = svg.querySelector("circle");
    expect(circle?.getAttribute("fill")).toBe("#2DD4BF");
  });

  it("uses red when estimate > null and CI does not span null", () => {
    render(<CIBar estimate={1.5} ciLower={1.1} ciUpper={2.0} />);
    const svg = screen.getByTestId("ci-bar");
    const circle = svg.querySelector("circle");
    expect(circle?.getAttribute("fill")).toBe("#E85A6B");
  });

  it("includes aria-label with CI range and estimate", () => {
    render(<CIBar estimate={0.80} ciLower={0.60} ciUpper={0.95} />);
    const svg = screen.getByTestId("ci-bar");
    expect(svg.getAttribute("aria-label")).toBe("CI: 0.60\u20130.95, estimate: 0.80");
  });

  it("accepts custom width and height", () => {
    render(<CIBar estimate={1.0} ciLower={0.8} ciUpper={1.2} width={300} height={40} />);
    const svg = screen.getByTestId("ci-bar");
    expect(svg.getAttribute("width")).toBe("300");
    expect(svg.getAttribute("height")).toBe("40");
  });

  it("renders null reference line in gold", () => {
    render(<CIBar estimate={0.8} ciLower={0.6} ciUpper={0.95} />);
    const svg = screen.getByTestId("ci-bar");
    const lines = svg.querySelectorAll("line");
    const nullLine = lines[0];
    expect(nullLine.getAttribute("stroke")).toBe("#C9A227");
    expect(nullLine.getAttribute("stroke-dasharray")).toBe("3,3");
  });
});
