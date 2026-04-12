import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface ForestPlotWrapperProps {
  data: Array<{ label: string; hr: number; lower: number; upper: number }>;
  title?: string;
  width?: number;
  height?: number;
}

const MARGIN = { top: 24, right: 200, bottom: 44, left: 170 };
const ROW_HEIGHT = 28;

// Dark theme colors
const COLOR_TEXT = "#d4d4d8";        // zinc-300
const COLOR_AXIS = "#52525b";        // zinc-600
const COLOR_CI = "var(--primary)";          // crimson
const COLOR_POINT = "var(--success)";       // teal
const COLOR_NULL = "var(--accent)";        // gold

function formatHR(hr: number, lower: number, upper: number): string {
  return `${hr.toFixed(2)} [${lower.toFixed(2)}, ${upper.toFixed(2)}]`;
}

export function ForestPlotWrapper({
  data,
  title,
  width = 640,
  height: heightProp,
}: ForestPlotWrapperProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const computedHeight =
    heightProp ?? MARGIN.top + data.length * ROW_HEIGHT + MARGIN.bottom + 16;
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = computedHeight - MARGIN.top - MARGIN.bottom;

  useEffect(() => {
    if (!data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg
      .attr("viewBox", `0 0 ${width} ${computedHeight}`)
      .attr("width", "100%")
      .attr("height", computedHeight)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Build x domain from all CI values + null line
    const allValues = data.flatMap((d) => [d.lower, d.upper, 1.0]);
    const xMin = Math.max(0.01, (d3.min(allValues) ?? 0.1) * 0.85);
    const xMax = (d3.max(allValues) ?? 2) * 1.15;

    const xScale = d3
      .scaleLog()
      .domain([xMin, xMax])
      .range([0, plotWidth])
      .clamp(true);

    const yScale = d3
      .scaleBand<number>()
      .domain(d3.range(data.length))
      .range([0, plotHeight])
      .padding(0.3);

    // Gridlines
    const xTicks = xScale.ticks(5);
    xTicks.forEach((tick) => {
      g.append("line")
        .attr("x1", xScale(tick))
        .attr("x2", xScale(tick))
        .attr("y1", 0)
        .attr("y2", plotHeight)
        .attr("stroke", COLOR_AXIS)
        .attr("stroke-width", 0.5)
        .attr("stroke-dasharray", "2,3");
    });

    // Null line at HR=1.0 (gold, dashed)
    const nullX = xScale(1.0);
    g.append("line")
      .attr("x1", nullX)
      .attr("x2", nullX)
      .attr("y1", 0)
      .attr("y2", plotHeight)
      .attr("stroke", COLOR_NULL)
      .attr("stroke-dasharray", "5,3")
      .attr("stroke-width", 1.5);

    // Column header
    g.append("text")
      .attr("x", plotWidth + 8)
      .attr("y", -10)
      .attr("text-anchor", "start")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", COLOR_TEXT)
      .attr("font-family", "monospace")
      .text("HR (95% CI)");

    // Study rows
    data.forEach((d, i) => {
      const yCenter = (yScale(i) ?? 0) + yScale.bandwidth() / 2;

      // CI horizontal bar (crimson)
      g.append("line")
        .attr("x1", xScale(d.lower))
        .attr("x2", xScale(d.upper))
        .attr("y1", yCenter)
        .attr("y2", yCenter)
        .attr("stroke", COLOR_CI)
        .attr("stroke-width", 2);

      // CI whisker caps
      [d.lower, d.upper].forEach((val) => {
        g.append("line")
          .attr("x1", xScale(val))
          .attr("x2", xScale(val))
          .attr("y1", yCenter - 4)
          .attr("y2", yCenter + 4)
          .attr("stroke", COLOR_CI)
          .attr("stroke-width", 2);
      });

      // Point estimate circle (teal)
      g.append("circle")
        .attr("cx", xScale(d.hr))
        .attr("cy", yCenter)
        .attr("r", 5)
        .attr("fill", COLOR_POINT)
        .attr("stroke", "var(--surface-base)")
        .attr("stroke-width", 1);

      // Label text (left)
      g.append("text")
        .attr("x", -8)
        .attr("y", yCenter)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "central")
        .attr("font-size", "11px")
        .attr("fill", COLOR_TEXT)
        .attr("font-family", "sans-serif")
        .text(
          d.label.length > 22 ? d.label.slice(0, 21) + "\u2026" : d.label,
        );

      // HR text (right)
      g.append("text")
        .attr("x", plotWidth + 8)
        .attr("y", yCenter)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "central")
        .attr("font-size", "10px")
        .attr("fill", COLOR_TEXT)
        .attr("font-family", "monospace")
        .text(formatHR(d.hr, d.lower, d.upper));
    });

    // X-axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(5)
      .tickFormat((v) => d3.format(".2f")(v as number));

    const axisG = g
      .append("g")
      .attr("transform", `translate(0,${plotHeight})`)
      .call(xAxis);

    axisG.select(".domain").attr("stroke", COLOR_AXIS);
    axisG.selectAll(".tick line").attr("stroke", COLOR_AXIS);
    axisG
      .selectAll(".tick text")
      .attr("font-size", "10px")
      .attr("fill", COLOR_TEXT);

    // X-axis label
    g.append("text")
      .attr("x", plotWidth / 2)
      .attr("y", plotHeight + 36)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", COLOR_TEXT)
      .attr("font-family", "sans-serif")
      .text("Hazard Ratio (log scale)");

    // Favors labels flanking null line
    g.append("text")
      .attr("x", nullX - 8)
      .attr("y", plotHeight + 22)
      .attr("text-anchor", "end")
      .attr("font-size", "9px")
      .attr("fill", COLOR_NULL)
      .attr("font-family", "sans-serif")
      .text("\u2190 Favors treatment");

    g.append("text")
      .attr("x", nullX + 8)
      .attr("y", plotHeight + 22)
      .attr("text-anchor", "start")
      .attr("font-size", "9px")
      .attr("fill", COLOR_NULL)
      .attr("font-family", "sans-serif")
      .text("Favors control \u2192");
  }, [data, width, computedHeight, plotWidth, plotHeight]);

  if (!data.length) return null;

  return (
    <div className="flex flex-col gap-2">
      {title && (
        <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
          {title}
        </p>
      )}
      <div className="overflow-x-auto">
        <svg ref={svgRef} />
      </div>
    </div>
  );
}
