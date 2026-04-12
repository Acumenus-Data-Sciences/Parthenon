import { useEffect, useRef } from "react";
import * as d3 from "d3";

// ── Dark theme constants ───────────────────────────────────────────────────────
const COLOR_TEXT = "#d4d4d8";    // zinc-300
const COLOR_AXIS = "#52525b";    // zinc-600
const COLOR_TARGET = "#2DD4BF";  // teal
const COLOR_COMPARATOR = "#9B1B30"; // crimson

const MARGIN = { top: 24, right: 24, bottom: 44, left: 48 };

// ── Types ──────────────────────────────────────────────────────────────────────

interface PSBin {
  bin: number;
  count: number;
}

interface PSDistributionChartProps {
  target: PSBin[];
  comparator: PSBin[];
  targetLabel?: string;
  comparatorLabel?: string;
  width?: number;
  height?: number;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PSDistributionChart({
  target,
  comparator,
  targetLabel = "Target",
  comparatorLabel = "Comparator",
  width = 600,
  height = 300,
}: PSDistributionChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const halfH = plotHeight / 2;

  useEffect(() => {
    if ((!target.length && !comparator.length) || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // X scale: propensity score 0-1
    const allBins = [
      ...target.map((d) => d.bin),
      ...comparator.map((d) => d.bin),
    ];
    const binMin = d3.min(allBins) ?? 0;
    const binMax = d3.max(allBins) ?? 1;

    // Infer bin width from sorted unique bin values
    const uniqueBins = [...new Set(allBins)].sort((a, b) => a - b);
    const binWidth =
      uniqueBins.length > 1
        ? (uniqueBins[1]! - uniqueBins[0]!)
        : 0.05;

    const xScale = d3
      .scaleLinear()
      .domain([Math.max(0, binMin - binWidth / 2), Math.min(1, binMax + binWidth / 2)])
      .range([0, plotWidth])
      .clamp(true);

    // Y scale: max count in either distribution, symmetric around center
    const maxCount =
      d3.max([
        ...target.map((d) => d.count),
        ...comparator.map((d) => d.count),
      ]) ?? 1;

    const yScale = d3.scaleLinear().domain([0, maxCount]).range([0, halfH]);

    // Center line (divider)
    g.append("line")
      .attr("x1", 0)
      .attr("x2", plotWidth)
      .attr("y1", halfH)
      .attr("y2", halfH)
      .attr("stroke", COLOR_AXIS)
      .attr("stroke-width", 1);

    // Compute bar pixel width from bin width
    const barPx = Math.max(1, xScale(binMin + binWidth) - xScale(binMin) - 1);

    // Target bars (top half: go UP from center)
    target.forEach((d) => {
      const barH = yScale(d.count);
      g.append("rect")
        .attr("x", xScale(d.bin - binWidth / 2))
        .attr("y", halfH - barH)
        .attr("width", barPx)
        .attr("height", barH)
        .attr("fill", COLOR_TARGET)
        .attr("fill-opacity", 0.75);
    });

    // Comparator bars (bottom half: go DOWN from center)
    comparator.forEach((d) => {
      const barH = yScale(d.count);
      g.append("rect")
        .attr("x", xScale(d.bin - binWidth / 2))
        .attr("y", halfH)
        .attr("width", barPx)
        .attr("height", barH)
        .attr("fill", COLOR_COMPARATOR)
        .attr("fill-opacity", 0.75);
    });

    // X axis (at bottom of chart)
    const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat(d3.format(".2f"));
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

    // X axis label
    g.append("text")
      .attr("x", plotWidth / 2)
      .attr("y", plotHeight + 36)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", COLOR_TEXT)
      .attr("font-family", "sans-serif")
      .text("Propensity Score");

    // Legend (top-right)
    const legendG = g
      .append("g")
      .attr("transform", `translate(${plotWidth - 160}, 4)`);

    // Target entry
    legendG
      .append("rect")
      .attr("x", 0)
      .attr("y", -8)
      .attr("width", 12)
      .attr("height", 8)
      .attr("fill", COLOR_TARGET)
      .attr("fill-opacity", 0.75);

    legendG
      .append("text")
      .attr("x", 16)
      .attr("y", 0)
      .attr("dominant-baseline", "auto")
      .attr("font-size", "10px")
      .attr("fill", COLOR_TEXT)
      .attr("font-family", "sans-serif")
      .text(targetLabel.length > 16 ? targetLabel.slice(0, 15) + "\u2026" : targetLabel);

    // Comparator entry
    legendG
      .append("rect")
      .attr("x", 0)
      .attr("y", 8)
      .attr("width", 12)
      .attr("height", 8)
      .attr("fill", COLOR_COMPARATOR)
      .attr("fill-opacity", 0.75);

    legendG
      .append("text")
      .attr("x", 16)
      .attr("y", 16)
      .attr("dominant-baseline", "auto")
      .attr("font-size", "10px")
      .attr("fill", COLOR_TEXT)
      .attr("font-family", "sans-serif")
      .text(
        comparatorLabel.length > 16
          ? comparatorLabel.slice(0, 15) + "\u2026"
          : comparatorLabel,
      );

    // Optional: subtle "top" and "bottom" half labels
    g.append("text")
      .attr("x", 4)
      .attr("y", halfH - 4)
      .attr("font-size", "9px")
      .attr("fill", COLOR_TARGET)
      .attr("font-family", "sans-serif")
      .text(targetLabel);

    g.append("text")
      .attr("x", 4)
      .attr("y", halfH + 11)
      .attr("font-size", "9px")
      .attr("fill", COLOR_COMPARATOR)
      .attr("font-family", "sans-serif")
      .text(comparatorLabel);
  }, [
    target,
    comparator,
    targetLabel,
    comparatorLabel,
    width,
    height,
    plotWidth,
    plotHeight,
    halfH,
  ]);

  if (!target.length && !comparator.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Propensity Score Distribution
      </p>
      <div className="overflow-x-auto">
        <svg ref={svgRef} />
      </div>
    </div>
  );
}
