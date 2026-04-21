import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useTranslation } from "react-i18next";

export interface QQPlotProps {
  observedP: number[];
  lambdaGC?: number;
  width?: number;
  height?: number;
}

const COLOR_POINT = "var(--success)";
const COLOR_REFERENCE = "var(--accent)";
const COLOR_TEXT = "var(--text-primary)";
const COLOR_AXIS = "var(--border-default)";
const COLOR_GRID = "var(--border-subtle)";
const COLOR_BAND = "var(--surface-highlight)";
const COLOR_BADGE = "var(--surface-overlay)";

const MARGIN = { top: 20, right: 20, bottom: 50, left: 55 };
const MAX_POINTS = 5000;

/**
 * Approximate inverse CDF of the beta distribution using a simple
 * Wilson-Hilferty normal approximation for the CI band.
 * We use ±1.96 * SE where SE = sqrt(e*(1-e)/n), all in probability space,
 * then convert to -log10 scale.
 */
function computeCIBand(
  expectedNegLog: number[],
  n: number,
): Array<{ e: number; lo: number; hi: number }> {
  return expectedNegLog.map((e) => {
    // Convert expected -log10 back to probability space
    const ep = Math.pow(10, -e);
    const se = Math.sqrt((ep * (1 - ep)) / n);
    const loP = Math.max(ep - 1.96 * se, 1e-300);
    const hiP = Math.min(ep + 1.96 * se, 1);
    return {
      e,
      lo: -Math.log10(hiP), // higher -log10 corresponds to smaller p
      hi: -Math.log10(loP),
    };
  });
}

/**
 * Approximate lambda GC:
 * Under null, median chi2(1) ≈ 0.4549 (qchisq(0.5, 1)).
 * Observed: chi2 = qchisq(1 - p, 1) ≈ computed from p-values.
 * We approximate qchisq(1-p, 1) via the normal approximation:
 *   z = Phi^{-1}(1 - p/2), chi2 = z^2
 */
function computeLambdaGC(sortedP: number[]): number {
  if (sortedP.length === 0) return 1;
  const mid = Math.floor(sortedP.length / 2);
  const medianP = sortedP[mid];
  // Use -log10 quantile approximation instead:
  // chi2 statistic = (-2 * ln(p)) for 1 df approximately
  // lambda = median(-2*ln(p)) / (-2*ln(0.5)) = median(-2*ln(p)) / 1.3862944
  const medianChi2 = -2 * Math.log(Math.max(medianP, 1e-300));
  const expectedMedianChi2 = 0.4549; // qchisq(0.5, 1) = (qnorm(0.75))^2
  return medianChi2 / expectedMedianChi2;
}

interface PlotPoint {
  expected: number;
  observed: number;
}

function prepareQQData(
  rawP: number[],
): { plotPoints: PlotPoint[]; n: number; expectedFull: number[] } {
  const n = rawP.length;
  if (n === 0) return { plotPoints: [], n: 0, expectedFull: [] };

  // Sort ascending
  const sorted = [...rawP].sort((a, b) => a - b);

  // Expected uniform quantiles
  const expected = sorted.map((_, i) => (i + 0.5) / n);
  const expectedNegLog = expected.map((e) => -Math.log10(e));
  const observedNegLog = sorted.map((p) => -Math.log10(Math.max(p, 1e-300)));

  // Thin: keep all points with observed -log10(p) > 2, randomly sample the rest
  const highSig: PlotPoint[] = [];
  const lowSig: PlotPoint[] = [];

  for (let i = 0; i < n; i++) {
    const pt = { expected: expectedNegLog[i], observed: observedNegLog[i] };
    if (observedNegLog[i] > 2) {
      highSig.push(pt);
    } else {
      lowSig.push(pt);
    }
  }

  // Random sample low-significance points to cap at MAX_POINTS total
  const remaining = MAX_POINTS - highSig.length;
  let sampledLow: PlotPoint[];
  if (remaining <= 0 || lowSig.length === 0) {
    sampledLow = [];
  } else if (lowSig.length <= remaining) {
    sampledLow = lowSig;
  } else {
    // Fisher-Yates partial shuffle to get `remaining` samples
    const arr = [...lowSig];
    for (let i = 0; i < remaining; i++) {
      const j = i + Math.floor(Math.random() * (arr.length - i));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    sampledLow = arr.slice(0, remaining);
  }

  const plotPoints = [...highSig, ...sampledLow].sort(
    (a, b) => a.expected - b.expected,
  );

  return { plotPoints, n, expectedFull: expectedNegLog };
}

export default function QQPlot({
  observedP,
  lambdaGC: lambdaGCProp,
  width = 400,
  height = 400,
}: QQPlotProps) {
  const { t } = useTranslation("app");
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || observedP.length === 0) return;

    const { plotPoints, n, expectedFull } = prepareQQData(observedP);
    if (plotPoints.length === 0) return;

    const sortedP = [...observedP].sort((a, b) => a - b);
    const lambda =
      lambdaGCProp !== undefined
        ? lambdaGCProp
        : computeLambdaGC(sortedP);

    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = height - MARGIN.top - MARGIN.bottom;

    const maxExpected = d3.max(plotPoints, (d) => d.expected) ?? 8;
    const maxObserved = d3.max(plotPoints, (d) => d.observed) ?? 8;
    const axisMax = Math.max(maxExpected, maxObserved) * 1.05;

    const xScale = d3.scaleLinear().domain([0, axisMax]).range([0, plotWidth]).nice();
    const yScale = d3.scaleLinear().domain([0, axisMax]).range([plotHeight, 0]).nice();

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // --- 95% CI band ---
    const ciBand = computeCIBand(expectedFull, n);
    // Only use points within axis range for drawing
    const bandData = ciBand.filter((d) => d.e <= axisMax);

    if (bandData.length > 1) {
      const areaPath = d3
        .area<{ e: number; lo: number; hi: number }>()
        .x((d) => xScale(d.e))
        .y0((d) => yScale(Math.min(d.lo, axisMax)))
        .y1((d) => yScale(Math.min(d.hi, axisMax)))
        .curve(d3.curveLinear);

      g.append("path")
        .datum(bandData)
        .attr("d", areaPath)
        .attr("fill", COLOR_BAND)
        .attr("fill-opacity", 0.5)
        .attr("stroke", "none");
    }

    // --- Diagonal y=x reference line (gold, dashed) ---
    const diagMax = xScale.domain()[1];
    g.append("line")
      .attr("x1", xScale(0))
      .attr("y1", yScale(0))
      .attr("x2", xScale(diagMax))
      .attr("y2", yScale(diagMax))
      .attr("stroke", COLOR_REFERENCE)
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "5,4");

    // --- Grid lines ---
    const xTicks = xScale.ticks(5);
    const yTicks = yScale.ticks(5);

    g.selectAll(".x-grid")
      .data(xTicks)
      .enter()
      .append("line")
      .attr("class", "x-grid")
      .attr("x1", (d) => xScale(d))
      .attr("x2", (d) => xScale(d))
      .attr("y1", 0)
      .attr("y2", plotHeight)
      .attr("stroke", COLOR_GRID)
      .attr("stroke-width", 0.5);

    g.selectAll(".y-grid")
      .data(yTicks)
      .enter()
      .append("line")
      .attr("class", "y-grid")
      .attr("x1", 0)
      .attr("x2", plotWidth)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d))
      .attr("stroke", COLOR_GRID)
      .attr("stroke-width", 0.5);

    // --- Data points ---
    g.selectAll("circle")
      .data(plotPoints)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d.expected))
      .attr("cy", (d) => yScale(d.observed))
      .attr("r", 3)
      .attr("fill", COLOR_POINT)
      .attr("fill-opacity", 0.7)
      .attr("stroke", "none");

    // --- X axis ---
    const xAxis = d3.axisBottom(xScale).ticks(5);
    const xAxisG = g
      .append("g")
      .attr("transform", `translate(0,${plotHeight})`)
      .call(xAxis);
    xAxisG.select(".domain").attr("stroke", COLOR_AXIS);
    xAxisG.selectAll(".tick line").attr("stroke", COLOR_AXIS);
    xAxisG
      .selectAll(".tick text")
      .attr("fill", COLOR_TEXT)
      .attr("font-size", "10px");

    // --- Y axis ---
    const yAxis = d3.axisLeft(yScale).ticks(5);
    const yAxisG = g.append("g").call(yAxis);
    yAxisG.select(".domain").attr("stroke", COLOR_AXIS);
    yAxisG.selectAll(".tick line").attr("stroke", COLOR_AXIS);
    yAxisG
      .selectAll(".tick text")
      .attr("fill", COLOR_TEXT)
      .attr("font-size", "10px");

    // --- Axis labels ---
    g.append("text")
      .attr("x", plotWidth / 2)
      .attr("y", plotHeight + 38)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-family", "sans-serif")
      .attr("fill", COLOR_TEXT)
      .text(t("investigation.genomic.qqPlotExpectedNegLogP"));

    g.append("text")
      .attr("transform", `rotate(-90)`)
      .attr("x", -plotHeight / 2)
      .attr("y", -42)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-family", "sans-serif")
      .attr("fill", COLOR_TEXT)
      .text(t("investigation.genomic.qqPlotObservedNegLogP"));

    // --- Lambda GC badge ---
    const badgeW = 72;
    const badgeH = 22;
    const badgeX = 6;
    const badgeY = 4;

    g.append("rect")
      .attr("x", badgeX)
      .attr("y", badgeY)
      .attr("width", badgeW)
      .attr("height", badgeH)
      .attr("rx", 4)
      .attr("fill", COLOR_BADGE)
      .attr("fill-opacity", 0.9);

    g.append("text")
      .attr("x", badgeX + badgeW / 2)
      .attr("y", badgeY + badgeH / 2 + 1)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", "11px")
      .attr("font-family", "sans-serif")
      .attr("fill", COLOR_TEXT)
      .text(
        t("investigation.genomic.lambdaLabel", {
          value: lambda.toFixed(3),
        }),
      );
  }, [observedP, lambdaGCProp, width, height, t]);

  if (observedP.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-ghost text-sm rounded border border-border-default"
        style={{ width, height }}
      >
        {t("investigation.genomic.qqPlotNoData")}
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      className="overflow-visible"
      style={{ background: "transparent" }}
    />
  );
}
