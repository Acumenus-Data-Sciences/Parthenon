import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface KaplanMeierDataPoint {
  time: number;
  survival: number;
  ci_lower?: number;
  ci_upper?: number;
}

interface KaplanMeierCurveData {
  label: string;
  color?: string;
  data: KaplanMeierDataPoint[];
}

interface KaplanMeierCurveProps {
  curves: KaplanMeierCurveData[];
  xLabel?: string;
  yLabel?: string;
  width?: number;
  height?: number;
  showRiskTable?: boolean;
}

const DEFAULT_COLORS = ["#1a56db", "#d32f2f", "#2e7d32", "#f57c00", "#7b1fa2", "#00838f"];
const MARGIN = { top: 20, right: 20, bottom: 40, left: 55 };
const RISK_TABLE_ROW_H = 18;

export default function KaplanMeierCurve({
  curves,
  xLabel = "Time (days)",
  yLabel = "Survival Probability",
  width = 600,
  height = 400,
  showRiskTable = true,
}: KaplanMeierCurveProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const riskTableHeight = showRiskTable ? (curves.length * RISK_TABLE_ROW_H + 30) : 0;
  const totalHeight = height + riskTableHeight;

  useEffect(() => {
    if (curves.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg
      .attr("viewBox", `0 0 ${width} ${totalHeight}`)
      .attr("width", width)
      .attr("height", totalHeight);

    // White background
    svg.append("rect")
      .attr("width", width)
      .attr("height", totalHeight)
      .attr("fill", "#ffffff");

    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = height - MARGIN.top - MARGIN.bottom;

    const g = svg.append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Compute domains
    const allTimes = curves.flatMap((c) => c.data.map((d) => d.time));
    const xMax = d3.max(allTimes) ?? 100;

    const xScale = d3.scaleLinear()
      .domain([0, xMax])
      .range([0, plotWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, 1])
      .range([plotHeight, 0]);

    // Grid lines
    const yTicks = yScale.ticks(5);
    yTicks.forEach((tick) => {
      g.append("line")
        .attr("x1", 0)
        .attr("x2", plotWidth)
        .attr("y1", yScale(tick))
        .attr("y2", yScale(tick))
        .attr("stroke", "#e5e7eb")
        .attr("stroke-dasharray", "3,3")
        .attr("stroke-width", 0.5);
    });

    const xTicks = xScale.ticks(6);
    xTicks.forEach((tick) => {
      g.append("line")
        .attr("x1", xScale(tick))
        .attr("x2", xScale(tick))
        .attr("y1", 0)
        .attr("y2", plotHeight)
        .attr("stroke", "#e5e7eb")
        .attr("stroke-dasharray", "3,3")
        .attr("stroke-width", 0.5);
    });

    // Step-after line generator
    const lineGen = d3.line<KaplanMeierDataPoint>()
      .x((d) => xScale(d.time))
      .y((d) => yScale(d.survival))
      .curve(d3.curveStepAfter);

    // Area generator for CI bands
    const areaGen = d3.area<KaplanMeierDataPoint>()
      .x((d) => xScale(d.time))
      .y0((d) => yScale(d.ci_lower ?? d.survival))
      .y1((d) => yScale(d.ci_upper ?? d.survival))
      .curve(d3.curveStepAfter);

    // Draw curves
    curves.forEach((curve, i) => {
      const color = curve.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];

      // CI band
      const hasCi = curve.data.some((d) => d.ci_lower != null && d.ci_upper != null);
      if (hasCi) {
        g.append("path")
          .datum(curve.data)
          .attr("d", areaGen)
          .attr("fill", color)
          .attr("fill-opacity", 0.1)
          .attr("stroke", "none");
      }

      // Survival line
      g.append("path")
        .datum(curve.data)
        .attr("d", lineGen)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 2);
    });

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(6);
    g.append("g")
      .attr("transform", `translate(0,${plotHeight})`)
      .call(xAxis)
      .selectAll("text")
      .attr("font-size", "10px")
      .attr("fill", "#555");

    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".1f"));
    g.append("g")
      .call(yAxis)
      .selectAll("text")
      .attr("font-size", "10px")
      .attr("fill", "#555");

    // Axis labels
    g.append("text")
      .attr("x", plotWidth / 2)
      .attr("y", plotHeight + 35)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "#333")
      .attr("font-family", "sans-serif")
      .text(xLabel);

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -plotHeight / 2)
      .attr("y", -42)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "#333")
      .attr("font-family", "sans-serif")
      .text(yLabel);

    // Legend (top-right)
    const legendG = g.append("g")
      .attr("transform", `translate(${plotWidth - 130}, 5)`);

    curves.forEach((curve, i) => {
      const color = curve.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const ly = i * 18;

      legendG.append("line")
        .attr("x1", 0)
        .attr("x2", 20)
        .attr("y1", ly)
        .attr("y2", ly)
        .attr("stroke", color)
        .attr("stroke-width", 2);

      legendG.append("text")
        .attr("x", 26)
        .attr("y", ly)
        .attr("dominant-baseline", "central")
        .attr("font-size", "10px")
        .attr("fill", "#333")
        .attr("font-family", "sans-serif")
        .text(curve.label);
    });

    // Risk table
    if (showRiskTable) {
      const riskG = svg.append("g")
        .attr("transform", `translate(${MARGIN.left},${height})`);

      // Header
      riskG.append("text")
        .attr("x", -MARGIN.left + 4)
        .attr("y", 12)
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("fill", "#333")
        .attr("font-family", "sans-serif")
        .text("No. at risk");

      // Compute risk table time points
      const riskTimes = xScale.ticks(6);

      curves.forEach((curve, ci) => {
        const color = curve.color ?? DEFAULT_COLORS[ci % DEFAULT_COLORS.length];
        const rowY = 28 + ci * RISK_TABLE_ROW_H;

        // Curve label
        riskG.append("text")
          .attr("x", -4)
          .attr("y", rowY)
          .attr("text-anchor", "end")
          .attr("font-size", "9px")
          .attr("fill", color)
          .attr("font-family", "sans-serif")
          .text(curve.label);

        // At each time point, find the closest data point
        riskTimes.forEach((t) => {
          // Find last data point <= t
          const pts = curve.data.filter((d) => d.time <= t);
          const closest = pts.length > 0 ? pts[pts.length - 1] : curve.data[0];
          const survPct = closest ? `${(closest.survival * 100).toFixed(0)}%` : "--";

          riskG.append("text")
            .attr("x", xScale(t))
            .attr("y", rowY)
            .attr("text-anchor", "middle")
            .attr("font-size", "9px")
            .attr("fill", "#555")
            .attr("font-family", "monospace")
            .text(survPct);
        });
      });

      // Time labels
      riskTimes.forEach((t) => {
        riskG.append("text")
          .attr("x", xScale(t))
          .attr("y", 12)
          .attr("text-anchor", "middle")
          .attr("font-size", "9px")
          .attr("fill", "#777")
          .attr("font-family", "sans-serif")
          .text(t.toString());
      });
    }
  }, [curves, xLabel, yLabel, width, height, totalHeight, showRiskTable]);

  return <svg ref={svgRef} />;
}
