import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface ForestPlotDatum {
  label: string;
  estimate: number;
  ci_lower: number;
  ci_upper: number;
  weight?: number;
}

interface ForestPlotProps {
  data: ForestPlotDatum[];
  pooled?: { estimate: number; ci_lower: number; ci_upper: number };
  nullValue?: number;
  xLabel?: string;
  width?: number;
  height?: number;
}

const MARGIN = { top: 20, right: 180, bottom: 50, left: 160 };
const ROW_HEIGHT = 28;

function formatEstimate(est: number, lower: number, upper: number): string {
  return `${est.toFixed(2)} [${lower.toFixed(2)}, ${upper.toFixed(2)}]`;
}

export default function ForestPlot({
  data,
  pooled,
  nullValue = 1.0,
  xLabel = "Hazard Ratio",
  width = 600,
  height: heightProp,
}: ForestPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const totalRows = data.length + (pooled ? 1 : 0);
  const computedHeight = heightProp ?? MARGIN.top + totalRows * ROW_HEIGHT + MARGIN.bottom + 20;
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = computedHeight - MARGIN.top - MARGIN.bottom;

  useEffect(() => {
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

    // Determine x-scale domain
    const allValues = data.flatMap((d) => [d.ci_lower, d.ci_upper]);
    if (pooled) {
      allValues.push(pooled.ci_lower, pooled.ci_upper);
    }
    allValues.push(nullValue);

    const xMin = d3.min(allValues) ?? 0;
    const xMax = d3.max(allValues) ?? 2;
    const xPadding = (xMax - xMin) * 0.15;

    const xScale = d3.scaleLog()
      .domain([Math.max(0.01, xMin - xPadding), xMax + xPadding])
      .range([0, plotWidth])
      .clamp(true);

    const yScale = d3.scaleBand<number>()
      .domain(d3.range(totalRows))
      .range([0, plotHeight])
      .padding(0.3);

    // Null line (dashed vertical)
    g.append("line")
      .attr("x1", xScale(nullValue))
      .attr("x2", xScale(nullValue))
      .attr("y1", 0)
      .attr("y2", plotHeight)
      .attr("stroke", "var(--text-muted)")
      .attr("stroke-dasharray", "4,3")
      .attr("stroke-width", 1);

    // Max weight for sizing squares
    const maxWeight = d3.max(data, (d) => d.weight ?? 1) ?? 1;

    // Study rows
    data.forEach((d, i) => {
      const yCenter = (yScale(i) ?? 0) + (yScale.bandwidth() / 2);

      // CI whisker
      g.append("line")
        .attr("x1", xScale(d.ci_lower))
        .attr("x2", xScale(d.ci_upper))
        .attr("y1", yCenter)
        .attr("y2", yCenter)
        .attr("stroke", "var(--surface-highlight)")
        .attr("stroke-width", 1.5);

      // Whisker caps
      [d.ci_lower, d.ci_upper].forEach((val) => {
        g.append("line")
          .attr("x1", xScale(val))
          .attr("x2", xScale(val))
          .attr("y1", yCenter - 4)
          .attr("y2", yCenter + 4)
          .attr("stroke", "var(--surface-highlight)")
          .attr("stroke-width", 1.5);
      });

      // Point estimate (square sized by weight)
      const w = d.weight ?? 1;
      const sqSize = 4 + (w / maxWeight) * 8;
      g.append("rect")
        .attr("x", xScale(d.estimate) - sqSize / 2)
        .attr("y", yCenter - sqSize / 2)
        .attr("width", sqSize)
        .attr("height", sqSize)
        .attr("fill", "#1a56db");

      // Study label (left)
      g.append("text")
        .attr("x", -8)
        .attr("y", yCenter)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "central")
        .attr("font-size", "11px")
        .attr("fill", "var(--surface-highlight)")
        .attr("font-family", "sans-serif")
        .text(d.label);

      // HR text (right)
      g.append("text")
        .attr("x", plotWidth + 8)
        .attr("y", yCenter)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "central")
        .attr("font-size", "10px")
        .attr("fill", "var(--text-ghost)")
        .attr("font-family", "monospace")
        .text(formatEstimate(d.estimate, d.ci_lower, d.ci_upper));
    });

    // Pooled estimate (diamond)
    if (pooled) {
      const pooledIdx = data.length;
      const yCenter = (yScale(pooledIdx) ?? 0) + (yScale.bandwidth() / 2);
      const diamondHalfW = 6;

      // Separator line above pooled
      const separatorY = (yScale(pooledIdx) ?? 0) - 4;
      g.append("line")
        .attr("x1", -MARGIN.left + 10)
        .attr("x2", plotWidth + MARGIN.right - 10)
        .attr("y1", separatorY)
        .attr("y2", separatorY)
        .attr("stroke", "var(--text-secondary)")
        .attr("stroke-width", 0.5);

      // CI whisker for pooled
      g.append("line")
        .attr("x1", xScale(pooled.ci_lower))
        .attr("x2", xScale(pooled.ci_upper))
        .attr("y1", yCenter)
        .attr("y2", yCenter)
        .attr("stroke", "var(--surface-highlight)")
        .attr("stroke-width", 1.5);

      // Diamond
      const cx = xScale(pooled.estimate);
      g.append("polygon")
        .attr("points", [
          `${cx},${yCenter - diamondHalfW}`,
          `${cx + diamondHalfW},${yCenter}`,
          `${cx},${yCenter + diamondHalfW}`,
          `${cx - diamondHalfW},${yCenter}`,
        ].join(" "))
        .attr("fill", "#d32f2f")
        .attr("stroke", "#b71c1c")
        .attr("stroke-width", 1);

      // Pooled label
      g.append("text")
        .attr("x", -8)
        .attr("y", yCenter)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "central")
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .attr("fill", "var(--surface-highlight)")
        .attr("font-family", "sans-serif")
        .text("Pooled");

      // Pooled HR text
      g.append("text")
        .attr("x", plotWidth + 8)
        .attr("y", yCenter)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "central")
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("fill", "var(--text-ghost)")
        .attr("font-family", "monospace")
        .text(formatEstimate(pooled.estimate, pooled.ci_lower, pooled.ci_upper));
    }

    // Column header for HR values
    g.append("text")
      .attr("x", plotWidth + 8)
      .attr("y", -8)
      .attr("text-anchor", "start")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", "var(--surface-highlight)")
      .attr("font-family", "sans-serif")
      .text("HR (95% CI)");

    // X-axis
    const xAxis = d3.axisBottom(xScale)
      .ticks(6)
      .tickFormat((d) => d3.format(".2f")(d as number));

    g.append("g")
      .attr("transform", `translate(0,${plotHeight})`)
      .call(xAxis)
      .selectAll("text")
      .attr("font-size", "10px")
      .attr("fill", "var(--text-ghost)");

    // X-axis label
    g.append("text")
      .attr("x", plotWidth / 2)
      .attr("y", plotHeight + 38)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "var(--surface-highlight)")
      .attr("font-family", "sans-serif")
      .text(xLabel);

    // Favors labels
    g.append("text")
      .attr("x", xScale(nullValue) - 10)
      .attr("y", plotHeight + 24)
      .attr("text-anchor", "end")
      .attr("font-size", "9px")
      .attr("fill", "var(--text-muted)")
      .attr("font-family", "sans-serif")
      .text("\u2190 Favors treatment");

    g.append("text")
      .attr("x", xScale(nullValue) + 10)
      .attr("y", plotHeight + 24)
      .attr("text-anchor", "start")
      .attr("font-size", "9px")
      .attr("fill", "var(--text-muted)")
      .attr("font-family", "sans-serif")
      .text("Favors control \u2192");
  }, [data, pooled, nullValue, xLabel, width, computedHeight, plotWidth, plotHeight, totalRows]);

  return <svg ref={svgRef} />;
}
