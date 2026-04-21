import { useState, useCallback, useRef } from "react";
import { fmt } from "@/lib/formatters";
import { useTranslation } from "react-i18next";

interface KaplanMeierPoint {
  time: number;
  surv: number;
  survLower?: number;
  survUpper?: number;
  nAtRisk: number;
  nEvents: number;
  nCensored: number;
}

interface KaplanMeierPlotProps {
  targetCurve: KaplanMeierPoint[];
  comparatorCurve: KaplanMeierPoint[];
  targetLabel?: string;
  comparatorLabel?: string;
  logRankPValue?: number;
  timeUnit?: "days" | "months" | "years";
  showRiskDifference?: boolean;
  showRMST?: boolean;
  interactive?: boolean;
  showCI?: boolean;
}

export function KaplanMeierPlot({
  targetCurve,
  comparatorCurve,
  targetLabel,
  comparatorLabel,
  logRankPValue,
  timeUnit = "days",
  showRiskDifference = false,
  showRMST = false,
  interactive = false,
  showCI = true,
}: KaplanMeierPlotProps) {
  const { t } = useTranslation("app");
  const width = 700;
  const riskTableHeight = 60;
  const chartHeight = 360;
  const height = chartHeight + riskTableHeight;
  const padding = { top: 30, right: 30, bottom: 20, left: 55 };
  const plotW = width - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;

  const TARGET_COLOR = "var(--success)";
  const COMPARATOR_COLOR = "var(--accent)";
  const RISK_DIFF_COLOR = "var(--critical)";
  const resolvedTargetLabel =
    targetLabel ?? t("analyses.auto.target_5121f4");
  const resolvedComparatorLabel =
    comparatorLabel ?? t("analyses.auto.comparator_0f95d3");
  const resolvedTimeUnit =
    timeUnit === "months"
      ? t("analyses.auto.months_5f9c1b")
      : timeUnit === "years"
        ? t("analyses.auto.years_9ad4c6")
        : t("analyses.auto.days_15d10b");

  // Interactive hover state
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Determine time scale
  const allTimes = [...targetCurve, ...comparatorCurve].map((p) => p.time);
  const maxTime = Math.max(...allTimes, 1);

  const toX = (time: number) => padding.left + (time / maxTime) * plotW;
  const toY = (surv: number) => padding.top + (1 - surv) * plotH;

  // Build step-function path (KM curves are step functions, not smooth)
  function buildStepPath(curve: KaplanMeierPoint[]): string {
    if (curve.length === 0) return "";
    const sorted = [...curve].sort((a, b) => a.time - b.time);
    let d = `M ${toX(sorted[0].time)} ${toY(sorted[0].surv)}`;
    for (let i = 1; i < sorted.length; i++) {
      d += ` L ${toX(sorted[i].time)} ${toY(sorted[i - 1].surv)}`;
      d += ` L ${toX(sorted[i].time)} ${toY(sorted[i].surv)}`;
    }
    return d;
  }

  // Build confidence band path
  function buildBandPath(curve: KaplanMeierPoint[]): string {
    if (curve.length === 0) return "";
    const sorted = [...curve].sort((a, b) => a.time - b.time);
    const withBands = sorted.filter(
      (p) => p.survUpper !== undefined && p.survLower !== undefined,
    );
    if (withBands.length === 0) return "";

    let upper = `M ${toX(withBands[0].time)} ${toY(withBands[0].survUpper!)}`;
    for (let i = 1; i < withBands.length; i++) {
      upper += ` L ${toX(withBands[i].time)} ${toY(withBands[i - 1].survUpper!)}`;
      upper += ` L ${toX(withBands[i].time)} ${toY(withBands[i].survUpper!)}`;
    }

    let lower = "";
    for (let i = withBands.length - 1; i >= 0; i--) {
      if (i === withBands.length - 1) {
        lower += ` L ${toX(withBands[i].time)} ${toY(withBands[i].survLower!)}`;
      } else {
        lower += ` L ${toX(withBands[i + 1].time)} ${toY(withBands[i].survLower!)}`;
        lower += ` L ${toX(withBands[i].time)} ${toY(withBands[i].survLower!)}`;
      }
    }

    return upper + lower + " Z";
  }

  // Build risk difference polygon (area between target and comparator curves)
  function buildRiskDiffPath(): string {
    if (targetCurve.length === 0 || comparatorCurve.length === 0) return "";

    const targetSorted = [...targetCurve].sort((a, b) => a.time - b.time);
    const compSorted = [...comparatorCurve].sort((a, b) => a.time - b.time);

    // Merge time points from both curves
    const allTimePoints = [
      ...new Set([
        ...targetSorted.map((p) => p.time),
        ...compSorted.map((p) => p.time),
      ]),
    ].sort((a, b) => a - b);

    if (allTimePoints.length === 0) return "";

    // Get survival at each time for both curves (step function interpolation)
    const targetPoints = allTimePoints.map((t) => ({
      time: t,
      surv: getSurvAtTime(targetSorted, t),
    }));
    const compPoints = allTimePoints.map((t) => ({
      time: t,
      surv: getSurvAtTime(compSorted, t),
    }));

    // Build polygon: target forward, comparator backward
    let d = `M ${toX(targetPoints[0].time)} ${toY(targetPoints[0].surv)}`;
    for (let i = 1; i < targetPoints.length; i++) {
      d += ` L ${toX(targetPoints[i].time)} ${toY(targetPoints[i - 1].surv)}`;
      d += ` L ${toX(targetPoints[i].time)} ${toY(targetPoints[i].surv)}`;
    }
    // Now go back along comparator
    for (let i = compPoints.length - 1; i >= 0; i--) {
      if (i === compPoints.length - 1) {
        d += ` L ${toX(compPoints[i].time)} ${toY(compPoints[i].surv)}`;
      } else {
        d += ` L ${toX(compPoints[i + 1].time)} ${toY(compPoints[i].surv)}`;
        d += ` L ${toX(compPoints[i].time)} ${toY(compPoints[i].surv)}`;
      }
    }
    d += " Z";
    return d;
  }

  // Compute RMST via trapezoidal integration
  function computeRMST(curve: KaplanMeierPoint[]): number {
    if (curve.length === 0) return 0;
    const sorted = [...curve].sort((a, b) => a.time - b.time);
    let area = 0;
    for (let i = 1; i < sorted.length; i++) {
      const dt = sorted[i].time - sorted[i - 1].time;
      // Step function: survival is sorted[i-1].surv until sorted[i].time
      area += sorted[i - 1].surv * dt;
    }
    return area;
  }

  const targetPath = buildStepPath(targetCurve);
  const comparatorPath = buildStepPath(comparatorCurve);
  const targetBand = showCI ? buildBandPath(targetCurve) : "";
  const comparatorBand = showCI ? buildBandPath(comparatorCurve) : "";
  const riskDiffPath = showRiskDifference ? buildRiskDiffPath() : "";

  const targetRMST = showRMST ? computeRMST(targetCurve) : 0;
  const compRMST = showRMST ? computeRMST(comparatorCurve) : 0;

  // Y-axis ticks
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  // X-axis ticks
  const xTickCount = 6;
  const xTickStep = Math.ceil(maxTime / xTickCount);
  const xTicks: number[] = [];
  for (let t = 0; t <= maxTime; t += xTickStep) {
    xTicks.push(t);
  }
  if (xTicks[xTicks.length - 1] < maxTime) xTicks.push(maxTime);

  function getNAtRisk(curve: KaplanMeierPoint[], time: number): number {
    const sorted = [...curve].sort((a, b) => a.time - b.time);
    let nAtRisk = 0;
    for (const pt of sorted) {
      if (pt.time <= time) nAtRisk = pt.nAtRisk;
      else break;
    }
    return nAtRisk;
  }

  function getCensorMarks(curve: KaplanMeierPoint[]) {
    return curve.filter((p) => p.nCensored > 0);
  }

  function getSurvAt(curve: KaplanMeierPoint[], time: number): number {
    const sorted = [...curve].sort((a, b) => a.time - b.time);
    let surv = 1;
    for (const pt of sorted) {
      if (pt.time <= time) surv = pt.surv;
      else break;
    }
    return surv;
  }

  const targetCensors = getCensorMarks(targetCurve);
  const comparatorCensors = getCensorMarks(comparatorCurve);

  // Mouse tracking handler
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!interactive || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      // Convert pixel X to time
      const time = ((mouseX - padding.left) / plotW) * maxTime;
      if (time >= 0 && time <= maxTime) {
        setHoverTime(time);
      } else {
        setHoverTime(null);
      }
    },
    [interactive, maxTime, padding.left, plotW],
  );

  const handleMouseLeave = useCallback(() => {
    if (interactive) setHoverTime(null);
  }, [interactive]);

  // Hover info
  const hoverTargetSurv =
    hoverTime !== null ? getSurvAt(targetCurve, hoverTime) : null;
  const hoverCompSurv =
    hoverTime !== null ? getSurvAt(comparatorCurve, hoverTime) : null;
  const hoverRiskDiff =
    hoverTargetSurv !== null && hoverCompSurv !== null
      ? hoverTargetSurv - hoverCompSurv
      : null;

  // Legend height calculation
  const legendExtraLines =
    (logRankPValue !== undefined ? 1 : 0) +
    (showRiskDifference ? 1 : 0) +
    (showRMST ? 1 : 0);
  const legendHeight = 42 + legendExtraLines * 16;

  return (
    <div className="overflow-x-auto">
      <svg
        ref={svgRef}
        data-testid="kaplan-meier-plot"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-text-primary"
        role="img"
        aria-label={t("analyses.auto.kaplanMeierSurvivalCurves_67f4a1")}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Background */}
        <rect width={width} height={height} fill="var(--surface-raised)" rx={8} />

        {/* Grid */}
        {yTicks.map((v) => (
          <g key={`y-${v}`}>
            <line
              x1={padding.left}
              y1={toY(v)}
              x2={padding.left + plotW}
              y2={toY(v)}
              stroke="var(--surface-elevated)"
              strokeWidth={0.5}
            />
            <text
              x={padding.left - 8}
              y={toY(v) + 3}
              textAnchor="end"
              fill="var(--text-ghost)"
              fontSize={10}
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={`x-${t}`}>
            <line
              x1={toX(t)}
              y1={padding.top}
              x2={toX(t)}
              y2={padding.top + plotH}
              stroke="var(--surface-elevated)"
              strokeWidth={0.5}
            />
            <text
              x={toX(t)}
              y={chartHeight - 4}
              textAnchor="middle"
              fill="var(--text-ghost)"
              fontSize={10}
            >
              {t}
            </text>
          </g>
        ))}

        {/* Risk difference polygon */}
        {showRiskDifference && riskDiffPath && (
          <path
            data-testid="risk-difference-area"
            d={riskDiffPath}
            fill={RISK_DIFF_COLOR}
            opacity={0.12}
          />
        )}

        {/* Confidence bands */}
        {showCI && targetBand && (
          <path d={targetBand} fill={TARGET_COLOR} opacity={0.08} />
        )}
        {showCI && comparatorBand && (
          <path d={comparatorBand} fill={COMPARATOR_COLOR} opacity={0.08} />
        )}

        {/* Target curve */}
        {targetPath && (
          <path
            d={targetPath}
            fill="none"
            stroke={TARGET_COLOR}
            strokeWidth={2.5}
          />
        )}

        {/* Comparator curve */}
        {comparatorPath && (
          <path
            d={comparatorPath}
            fill="none"
            stroke={COMPARATOR_COLOR}
            strokeWidth={2.5}
          />
        )}

        {/* Censor marks */}
        {targetCensors.map((pt, i) => {
          const surv = getSurvAt(targetCurve, pt.time);
          return (
            <line
              key={`tc-${i}`}
              x1={toX(pt.time)}
              y1={toY(surv) - 4}
              x2={toX(pt.time)}
              y2={toY(surv) + 4}
              stroke={TARGET_COLOR}
              strokeWidth={1.5}
            />
          );
        })}
        {comparatorCensors.map((pt, i) => {
          const surv = getSurvAt(comparatorCurve, pt.time);
          return (
            <line
              key={`cc-${i}`}
              x1={toX(pt.time)}
              y1={toY(surv) - 4}
              x2={toX(pt.time)}
              y2={toY(surv) + 4}
              stroke={COMPARATOR_COLOR}
              strokeWidth={1.5}
            />
          );
        })}

        {/* Interactive hover cursor */}
        {interactive && hoverTime !== null && (
          <g data-testid="km-hover-cursor">
            <line
              x1={toX(hoverTime)}
              y1={padding.top}
              x2={toX(hoverTime)}
              y2={padding.top + plotH}
              stroke="var(--text-primary)"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.5}
            />
            {/* Hover info box */}
            <rect
              x={Math.min(toX(hoverTime) + 8, width - 160)}
              y={padding.top + 4}
              width={148}
              height={52}
              rx={4}
              fill="var(--surface-base)"
              stroke="var(--surface-highlight)"
              strokeWidth={1}
              opacity={0.95}
            />
            <text
              x={Math.min(toX(hoverTime) + 16, width - 152)}
              y={padding.top + 20}
            fill="var(--text-muted)"
            fontSize={9}
            fontFamily="IBM Plex Mono, monospace"
          >
              {t("analyses.auto.timeValueUnit_8d5c54", {
                time: Math.round(hoverTime),
                unit: resolvedTimeUnit,
              })}
            </text>
            <text
              x={Math.min(toX(hoverTime) + 16, width - 152)}
              y={padding.top + 34}
              fill={TARGET_COLOR}
              fontSize={9}
              fontFamily="IBM Plex Mono, monospace"
            >
              {t("analyses.auto.targetValue_11afac", {
                value: hoverTargetSurv !== null ? fmt(hoverTargetSurv, 3) : "-",
              })}
            </text>
            <text
              x={Math.min(toX(hoverTime) + 16, width - 152)}
              y={padding.top + 48}
              fill={COMPARATOR_COLOR}
              fontSize={9}
              fontFamily="IBM Plex Mono, monospace"
            >
              {t("analyses.auto.compValue_f64342", {
                value: hoverCompSurv !== null ? fmt(hoverCompSurv, 3) : "-",
                delta:
                  hoverRiskDiff !== null ? ` (\u0394${fmt(hoverRiskDiff, 3)})` : "",
              })}
            </text>
          </g>
        )}

        {/* Plot boundary */}
        <rect
          x={padding.left}
          y={padding.top}
          width={plotW}
          height={plotH}
          fill="none"
          stroke="var(--surface-highlight)"
          strokeWidth={1}
        />

        {/* Legend */}
        <g transform={`translate(${padding.left + 12}, ${padding.top + 12})`}>
          <rect
            x={0}
            y={0}
            width={200}
            height={legendHeight}
            rx={4}
            fill="var(--surface-base)"
            stroke="var(--surface-elevated)"
            strokeWidth={1}
          />
          <line
            x1={8}
            y1={14}
            x2={28}
            y2={14}
            stroke={TARGET_COLOR}
            strokeWidth={2.5}
          />
          <text x={34} y={18} fill="var(--text-secondary)" fontSize={11}>
            {resolvedTargetLabel}
          </text>
          <line
            x1={8}
            y1={32}
            x2={28}
            y2={32}
            stroke={COMPARATOR_COLOR}
            strokeWidth={2.5}
          />
          <text x={34} y={36} fill="var(--text-secondary)" fontSize={11}>
            {resolvedComparatorLabel}
          </text>
          {(() => {
            let yOffset = 42;
            const extras: React.ReactNode[] = [];

            if (logRankPValue !== undefined) {
              extras.push(
                <text
                  key="logrank"
                  x={8}
                  y={yOffset + 10}
                  fill="var(--text-muted)"
                  fontSize={10}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {t("analyses.auto.logRankP_383e66", {
                    value: logRankPValue < 0.001 ? "<0.001" : fmt(logRankPValue),
                  })}
                </text>,
              );
              yOffset += 16;
            }

            if (showRiskDifference) {
              extras.push(
                <g key="riskdiff">
                  <rect
                    x={8}
                    y={yOffset + 2}
                    width={16}
                    height={8}
                    fill={RISK_DIFF_COLOR}
                    opacity={0.3}
                    rx={2}
                  />
                  <text
                    x={30}
                    y={yOffset + 10}
                    fill="var(--text-secondary)"
                    fontSize={10}
                  >
                    {t("analyses.auto.riskDifference_b95db4")}
                  </text>
                </g>,
              );
              yOffset += 16;
            }

            if (showRMST) {
              extras.push(
                <text
                  key="rmst"
                  x={8}
                  y={yOffset + 10}
                  fill="var(--text-muted)"
                  fontSize={9}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {t("analyses.auto.rmstLegend_8e56b2", {
                    target: fmt(targetRMST, 1),
                    comparator: fmt(compRMST, 1),
                    difference: fmt(targetRMST - compRMST, 1),
                  })}
                </text>,
              );
            }

            return extras;
          })()}
        </g>

        {/* RMST annotation */}
        {showRMST && (
          <g data-testid="rmst-annotation">
            <text
              x={padding.left + plotW - 8}
              y={padding.top + plotH - 8}
              textAnchor="end"
              fill="var(--text-muted)"
              fontSize={10}
              fontFamily="IBM Plex Mono, monospace"
            >
              {t("analyses.auto.rmstDiffUnit_15c2e7", {
                difference: fmt(targetRMST - compRMST, 1),
                unit: resolvedTimeUnit,
              })}
            </text>
          </g>
        )}

        {/* Axis labels */}
        <text
          x={padding.left + plotW / 2}
          y={chartHeight + 16}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={11}
          fontWeight={600}
        >
          {t("analyses.auto.timeUnitAxis_32813a", {
            unit: resolvedTimeUnit,
          })}
        </text>
        <text
          x={14}
          y={padding.top + plotH / 2}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={11}
          fontWeight={600}
          transform={`rotate(-90 14 ${padding.top + plotH / 2})`}
        >
          {t("analyses.auto.survivalProbability_cf59fc")}
        </text>

        {/* Number at risk table */}
        <line
          x1={padding.left}
          y1={chartHeight + 24}
          x2={padding.left + plotW}
          y2={chartHeight + 24}
          stroke="var(--surface-elevated)"
          strokeWidth={0.5}
        />
        <text
          x={padding.left - 8}
          y={chartHeight + 40}
          textAnchor="end"
          fill={TARGET_COLOR}
          fontSize={9}
          fontWeight={600}
        >
          {t("analyses.auto.atRisk_d772a4")}
        </text>
        <text
          x={padding.left - 8}
          y={chartHeight + 54}
          textAnchor="end"
          fill={COMPARATOR_COLOR}
          fontSize={9}
          fontWeight={600}
        >
          {t("analyses.auto.atRisk_d772a4")}
        </text>
        {xTicks.map((t) => (
          <g key={`nar-${t}`}>
            <text
              x={toX(t)}
              y={chartHeight + 40}
              textAnchor="middle"
              fill={TARGET_COLOR}
              fontSize={9}
              fontFamily="IBM Plex Mono, monospace"
            >
              {getNAtRisk(targetCurve, t)}
            </text>
            <text
              x={toX(t)}
              y={chartHeight + 54}
              textAnchor="middle"
              fill={COMPARATOR_COLOR}
              fontSize={9}
              fontFamily="IBM Plex Mono, monospace"
            >
              {getNAtRisk(comparatorCurve, t)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Helper ──────────────────────────────────────────────────────────────────

/** Get survival at a given time via step-function interpolation */
function getSurvAtTime(
  sortedCurve: KaplanMeierPoint[],
  time: number,
): number {
  let surv = 1;
  for (const pt of sortedCurve) {
    if (pt.time <= time) surv = pt.surv;
    else break;
  }
  return surv;
}
