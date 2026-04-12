import { useEffect, useRef } from "react";
import * as d3 from "d3";

// ── Dark theme constants ───────────────────────────────────────────────────────
const COLOR_TEXT = "#d4d4d8";   // zinc-300
const COLOR_AXIS = "#52525b";   // zinc-600
const COLOR_GRID = "#52525b";   // zinc-600

const DEFAULT_COLORS = ["var(--success)", "var(--primary)", "var(--accent)", "#818cf8", "#fb923c"];

const MARGIN = { top: 24, right: 24, bottom: 52, left: 60 };

// ── Types ──────────────────────────────────────────────────────────────────────

interface KMPoint {
  time: number;
  survival: number;
  censored?: boolean;
}

interface KMCurve {
  label: string;
  color: string;
  points: KMPoint[];
}

interface KaplanMeierChartProps {
  curves: KMCurve[];
  xLabel?: string;
  yLabel?: string;
  width?: number;
  height?: number;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function KaplanMeierChart({
  curves,
  xLabel = "Time (days)",
  yLabel = "Survival Probability",
  width = 600,
  height = 400,
}: KaplanMeierChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;

  useEffect(() => {
    if (!curves.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height)
      .attr("preserveAspectRatio", "xMidYMid meet");

    // Transparent background (inherits dark container)

    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Compute x domain
    const allTimes = curves.flatMap((c) => c.points.map((p) => p.time));
    const xMax = d3.max(allTimes) ?? 100;

    const xScale = d3.scaleLinear().domain([0, xMax]).range([0, plotWidth]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([plotHeight, 0]);

    // Grid lines (y)
    const yTicks = yScale.ticks(5);
    yTicks.forEach((tick) => {
      g.append("line")
        .attr("x1", 0)
        .attr("x2", plotWidth)
        .attr("y1", yScale(tick))
        .attr("y2", yScale(tick))
        .attr("stroke", COLOR_GRID)
        .attr("stroke-dasharray", "3,3")
        .attr("stroke-width", 0.5);
    });

    // Grid lines (x)
    const xTicks = xScale.ticks(6);
    xTicks.forEach((tick) => {
      g.append("line")
        .attr("x1", xScale(tick))
        .attr("x2", xScale(tick))
        .attr("y1", 0)
        .attr("y2", plotHeight)
        .attr("stroke", COLOR_GRID)
        .attr("stroke-dasharray", "3,3")
        .attr("stroke-width", 0.5);
    });

    // Step-after line generator
    const lineGen = d3
      .line<KMPoint>()
      .x((d) => xScale(d.time))
      .y((d) => yScale(d.survival))
      .curve(d3.curveStepAfter);

    // Draw each curve
    curves.forEach((curve, i) => {
      const color = curve.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];

      // Survival step line
      g.append("path")
        .datum(curve.points)
        .attr("d", lineGen)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 2);

      // Censoring tick marks (vertical lines at censored points)
      const censoredPoints = curve.points.filter((p) => p.censored === true);
      censoredPoints.forEach((pt) => {
        g.append("line")
          .attr("x1", xScale(pt.time))
          .attr("x2", xScale(pt.time))
          .attr("y1", yScale(pt.survival) - 5)
          .attr("y2", yScale(pt.survival) + 5)
          .attr("stroke", color)
          .attr("stroke-width", 1.5);
      });
    });

    // X axis
    const xAxis = d3.axisBottom(xScale).ticks(6);
    const xAxisG = g
      .append("g")
      .attr("transform", `translate(0,${plotHeight})`)
      .call(xAxis);

    xAxisG.select(".domain").attr("stroke", COLOR_AXIS);
    xAxisG.selectAll(".tick line").attr("stroke", COLOR_AXIS);
    xAxisG
      .selectAll(".tick text")
      .attr("font-size", "10px")
      .attr("fill", COLOR_TEXT);

    // Y axis
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".1f"));
    const yAxisG = g.append("g").call(yAxis);

    yAxisG.select(".domain").attr("stroke", COLOR_AXIS);
    yAxisG.selectAll(".tick line").attr("stroke", COLOR_AXIS);
    yAxisG
      .selectAll(".tick text")
      .attr("font-size", "10px")
      .attr("fill", COLOR_TEXT);

    // X axis label
    g.append("text")
      .attr("x", plotWidth / 2)
      .attr("y", plotHeight + 44)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", COLOR_TEXT)
      .attr("font-family", "sans-serif")
      .text(xLabel);

    // Y axis label
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -plotHeight / 2)
      .attr("y", -48)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", COLOR_TEXT)
      .attr("font-family", "sans-serif")
      .text(yLabel);

    // Legend (top-right)
    const legendG = g
      .append("g")
      .attr("transform", `translate(${plotWidth - 150}, 4)`);

    curves.forEach((curve, i) => {
      const color = curve.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const ly = i * 18;

      legendG
        .append("line")
        .attr("x1", 0)
        .attr("x2", 20)
        .attr("y1", ly)
        .attr("y2", ly)
        .attr("stroke", color)
        .attr("stroke-width", 2);

      legendG
        .append("text")
        .attr("x", 26)
        .attr("y", ly)
        .attr("dominant-baseline", "central")
        .attr("font-size", "10px")
        .attr("fill", COLOR_TEXT)
        .attr("font-family", "sans-serif")
        .text(curve.label.length > 18 ? curve.label.slice(0, 17) + "\u2026" : curve.label);
    });

    // Tooltip overlay (transparent rect captures mouse events)
    const bisectTime = d3.bisector<KMPoint, number>((d) => d.time).left;

    const tooltipG = g.append("g").attr("display", "none");

    // Vertical crosshair line
    const crosshair = tooltipG
      .append("line")
      .attr("y1", 0)
      .attr("y2", plotHeight)
      .attr("stroke", COLOR_AXIS)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,2");

    // Tooltip background + text
    const tooltipBg = tooltipG
      .append("rect")
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("fill", "var(--surface-raised)")
      .attr("stroke", COLOR_AXIS)
      .attr("stroke-width", 0.5);

    const tooltipLines: d3.Selection<SVGTextElement, unknown, null, undefined>[] = [];
    curves.forEach((_, i) => {
      tooltipLines.push(
        tooltipG
          .append("text")
          .attr("font-size", "10px")
          .attr("font-family", "monospace")
          .attr("fill", (curves[i]?.color) ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]),
      );
    });

    const overlay = g
      .append("rect")
      .attr("width", plotWidth)
      .attr("height", plotHeight)
      .attr("fill", "transparent")
      .style("cursor", "crosshair");

    overlay.on("mousemove", function (event: MouseEvent) {
      const [mx] = d3.pointer(event, this);
      const time = xScale.invert(mx);

      tooltipG.attr("display", null);
      crosshair.attr("x1", mx).attr("x2", mx);

      const lineTexts: string[] = [];
      curves.forEach((curve, i) => {
        const idx = bisectTime(curve.points, time, 1);
        const pt =
          curve.points[Math.max(0, idx - 1)] ?? curve.points[0];
        if (pt) {
          const pct = (pt.survival * 100).toFixed(1);
          lineTexts.push(`${curve.label}: ${pct}%`);
          tooltipLines[i]?.text(`${curve.label}: ${pct}%`);
        }
      });

      // Position tooltip to the right or left of cursor
      const tipX = mx + 8;
      const tipY = 8;
      const lineH = 14;
      const tipW = Math.max(...lineTexts.map((t) => t.length)) * 6.5 + 16;
      const tipH = lineTexts.length * lineH + 8;

      // Header: time label
      const timeLabel = `t = ${Math.round(time)}`;
      tooltipLines.forEach((line, i) => {
        line
          .attr("x", tipX + 8)
          .attr("y", tipY + 14 + i * lineH);
      });

      tooltipBg
        .attr("x", tipX)
        .attr("y", tipY)
        .attr("width", Math.max(tipW, timeLabel.length * 6.5 + 16))
        .attr("height", tipH + lineH);

      // Insert time line at top dynamically via first tooltipLine offset
      // Use a separate static text element for time header
      tooltipG.selectAll(".tip-time").remove();
      tooltipG
        .append("text")
        .attr("class", "tip-time")
        .attr("x", tipX + 8)
        .attr("y", tipY + 12)
        .attr("font-size", "10px")
        .attr("font-family", "monospace")
        .attr("fill", COLOR_TEXT)
        .text(timeLabel);

      tooltipLines.forEach((line, i) => {
        line.attr("y", tipY + 14 + (i + 1) * lineH);
      });

      tooltipBg.attr("height", tipH + lineH + 4);
    });

    overlay.on("mouseleave", () => {
      tooltipG.attr("display", "none");
    });
  }, [curves, xLabel, yLabel, width, height, plotWidth, plotHeight]);

  if (!curves.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-text-ghost">
        Kaplan-Meier Survival Curve
      </p>
      <div className="overflow-x-auto">
        <svg ref={svgRef} />
      </div>
    </div>
  );
}
