import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BoxPlotChart } from "@/features/data-explorer/components/charts/BoxPlotChart";
import type { BoxPlotData } from "@/features/data-explorer/types/dataExplorer";

const sampleData: BoxPlotData = {
  min: 100,
  p10: 200,
  p25: 400,
  median: 600,
  p75: 800,
  p90: 900,
  max: 1000,
};

describe("BoxPlotChart", () => {
  it("renders without crashing with null data", () => {
    render(<BoxPlotChart data={null} />);
    expect(screen.getByText("No distribution data")).toBeInTheDocument();
  });

  it("renders SVG elements with valid data", () => {
    const { container } = render(
      <BoxPlotChart data={sampleData} label="Duration Distribution" />,
    );
    // The component renders a single SVG with role="img"
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).not.toBeNull();
    // Should contain lines (whiskers, median, caps, ticks) and a rect (IQR box)
    const lines = svg!.querySelectorAll("line");
    expect(lines.length).toBeGreaterThanOrEqual(5); // min-max, min cap, max cap, p10 tick, p90 tick, median
    const rects = svg!.querySelectorAll("rect");
    expect(rects.length).toBeGreaterThanOrEqual(1); // IQR box
  });

  it("displays median value", () => {
    const { container } = render(<BoxPlotChart data={sampleData} />);
    // The SVG text element shows "Median: 600"
    const svgTexts = container.querySelectorAll("text");
    const medianText = Array.from(svgTexts).find((el) =>
      el.textContent?.includes("Median:"),
    );
    expect(medianText).toBeDefined();
    expect(medianText!.textContent).toContain("600");
  });

  it("shows all statistical labels", () => {
    const { container } = render(<BoxPlotChart data={sampleData} />);
    const svgTexts = container.querySelectorAll("text");
    const allText = Array.from(svgTexts)
      .map((el) => el.textContent)
      .join(" ");

    // The component renders labels: min value, P25: value, Median: value, P75: value, max value
    expect(allText).toContain("100");    // min
    expect(allText).toContain("P25:");   // p25 label
    expect(allText).toContain("400");    // p25 value
    expect(allText).toContain("Median:");// median label
    expect(allText).toContain("600");    // median value
    expect(allText).toContain("P75:");   // p75 label
    expect(allText).toContain("800");    // p75 value
    expect(allText).toContain("1.0K");   // max value (1000 formatted as 1.0K)
  });
});
