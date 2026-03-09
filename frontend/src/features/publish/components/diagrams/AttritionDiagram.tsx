import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface AttritionStep {
  label: string;
  count: number;
  excluded?: number;
}

interface AttritionDiagramProps {
  steps: AttritionStep[];
  width?: number;
  height?: number;
}

const MARGIN = { top: 20, right: 30, bottom: 20, left: 30 };
const BAR_HEIGHT = 36;
const GAP = 48; // vertical gap between bars (space for exclusion annotation)

export default function AttritionDiagram({
  steps,
  width = 500,
  height: heightProp,
}: AttritionDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const computedHeight = heightProp ?? MARGIN.top + steps.length * (BAR_HEIGHT + GAP) - GAP + MARGIN.bottom;
  const plotWidth = width - MARGIN.left - MARGIN.right;

  useEffect(() => {
    if (steps.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg
      .attr("viewBox", `0 0 ${width} ${computedHeight}`)
      .attr("width", width)
      .attr("height", computedHeight);

    // White background
    svg.append("rect")
      .attr("width", width)
      .attr("height", computedHeight)
      .attr("fill", "#ffffff");

    const g = svg.append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const maxCount = steps[0].count;

    const xScale = d3.scaleLinear()
      .domain([0, maxCount])
      .range([0, plotWidth]);

    // Color scale: blue gradient getting lighter
    const colorScale = d3.scaleLinear<string>()
      .domain([0, steps.length - 1])
      .range(["#1e40af", "#93c5fd"])
      .interpolate(d3.interpolateRgb);

    steps.forEach((step, i) => {
      const yOffset = i * (BAR_HEIGHT + GAP);
      const barWidth = xScale(step.count);
      const barX = (plotWidth - barWidth) / 2; // center the bar

      // Bar
      g.append("rect")
        .attr("x", barX)
        .attr("y", yOffset)
        .attr("width", barWidth)
        .attr("height", BAR_HEIGHT)
        .attr("rx", 4)
        .attr("fill", colorScale(i))
        .attr("stroke", d3.color(colorScale(i))?.darker(0.3)?.toString() ?? "#1e3a8a")
        .attr("stroke-width", 1);

      // Label (left of bar or inside if wide enough)
      g.append("text")
        .attr("x", barX - 6)
        .attr("y", yOffset + BAR_HEIGHT / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "central")
        .attr("font-size", "11px")
        .attr("fill", "#333")
        .attr("font-family", "sans-serif")
        .text(step.label);

      // Count (right of bar)
      g.append("text")
        .attr("x", barX + barWidth + 6)
        .attr("y", yOffset + BAR_HEIGHT / 2)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "central")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "#333")
        .attr("font-family", "sans-serif")
        .text(`n = ${step.count.toLocaleString()}`);

      // Count inside bar (white text, only if bar is wide enough)
      if (barWidth > 80) {
        g.append("text")
          .attr("x", barX + barWidth / 2)
          .attr("y", yOffset + BAR_HEIGHT / 2)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("font-size", "11px")
          .attr("font-weight", "bold")
          .attr("fill", "#ffffff")
          .attr("font-family", "sans-serif")
          .text(step.count.toLocaleString());
      }

      // Exclusion annotation between bars
      if (i < steps.length - 1 && step.excluded != null && step.excluded > 0) {
        const arrowY1 = yOffset + BAR_HEIGHT + 4;
        const arrowY2 = yOffset + BAR_HEIGHT + GAP - 4;
        const arrowX = barX + barWidth + 40;

        // Vertical arrow line
        g.append("line")
          .attr("x1", plotWidth / 2)
          .attr("x2", plotWidth / 2)
          .attr("y1", arrowY1)
          .attr("y2", arrowY2)
          .attr("stroke", "#999")
          .attr("stroke-width", 1);

        // Arrow pointing right to exclusion text
        g.append("line")
          .attr("x1", plotWidth / 2)
          .attr("x2", arrowX - 4)
          .attr("y1", (arrowY1 + arrowY2) / 2)
          .attr("y2", (arrowY1 + arrowY2) / 2)
          .attr("stroke", "#d32f2f")
          .attr("stroke-width", 1)
          .attr("marker-end", "url(#arrowhead-red)");

        // Exclusion text
        g.append("text")
          .attr("x", arrowX)
          .attr("y", (arrowY1 + arrowY2) / 2)
          .attr("text-anchor", "start")
          .attr("dominant-baseline", "central")
          .attr("font-size", "10px")
          .attr("fill", "#d32f2f")
          .attr("font-family", "sans-serif")
          .text(`Excluded: ${step.excluded.toLocaleString()}`);
      } else if (i < steps.length - 1) {
        // Just a connecting line
        const arrowY1 = yOffset + BAR_HEIGHT;
        const arrowY2 = yOffset + BAR_HEIGHT + GAP;

        g.append("line")
          .attr("x1", plotWidth / 2)
          .attr("x2", plotWidth / 2)
          .attr("y1", arrowY1 + 2)
          .attr("y2", arrowY2 - 2)
          .attr("stroke", "#999")
          .attr("stroke-width", 1)
          .attr("marker-end", "url(#arrowhead-gray)");
      }
    });

    // Arrowhead markers
    const defs = svg.append("defs");

    const addMarker = (id: string, color: string) => {
      defs.append("marker")
        .attr("id", id)
        .attr("viewBox", "0 0 10 7")
        .attr("refX", 10)
        .attr("refY", 3.5)
        .attr("markerWidth", 8)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("polygon")
        .attr("points", "0 0, 10 3.5, 0 7")
        .attr("fill", color);
    };

    addMarker("arrowhead-red", "#d32f2f");
    addMarker("arrowhead-gray", "#999");
  }, [steps, width, computedHeight, plotWidth]);

  return <svg ref={svgRef} />;
}
