import { fmt } from "@/lib/formatters";
import { useTranslation } from "react-i18next";

interface NegativeControlOutcome {
  outcome_name: string;
  log_rr: number;
  se_log_rr: number;
  calibrated_log_rr?: number;
  calibrated_se_log_rr?: number;
  ci_95_lower: number;
  ci_95_upper: number;
}

interface SystematicErrorPlotProps {
  negativeControls: NegativeControlOutcome[];
  positiveControls?: NegativeControlOutcome[];
  showCalibration?: boolean;
}

export function SystematicErrorPlot({
  negativeControls,
  positiveControls,
  showCalibration = false,
}: SystematicErrorPlotProps) {
  const { t } = useTranslation("app");
  if (negativeControls.length === 0) return null;

  const width = 600;
  const height = 400;
  const padding = { top: 30, right: 30, bottom: 50, left: 55 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const NC_COLOR = "var(--success)";
  const NC_CALIBRATED_COLOR = "var(--success)";
  const PC_COLOR = "var(--accent)";
  const FUNNEL_COLOR = "var(--critical)";
  const ARROW_COLOR = "var(--text-muted)";

  // Determine if calibrated data is available
  const hasCalibrated =
    showCalibration &&
    negativeControls.some(
      (nc) =>
        nc.calibrated_log_rr !== undefined &&
        nc.calibrated_se_log_rr !== undefined,
    );

  const allPoints = [
    ...negativeControls,
    ...(positiveControls ?? []),
  ];

  // Include calibrated positions in scale computation
  const allLogRR = [
    ...allPoints.map((p) => p.log_rr),
    ...(hasCalibrated
      ? negativeControls
          .filter((nc) => nc.calibrated_log_rr !== undefined)
          .map((nc) => nc.calibrated_log_rr!)
      : []),
  ];
  const allSE = [
    ...allPoints.map((p) => p.se_log_rr),
    ...(hasCalibrated
      ? negativeControls
          .filter((nc) => nc.calibrated_se_log_rr !== undefined)
          .map((nc) => nc.calibrated_se_log_rr!)
      : []),
  ];

  const maxAbsLogRR = Math.max(...allLogRR.map(Math.abs), 0.5);
  const maxSE = Math.max(...allSE, 0.5);
  const xRange = Math.ceil(maxAbsLogRR * 10) / 10 + 0.2;
  const yMax = Math.ceil(maxSE * 10) / 10 + 0.1;

  const toX = (logRR: number) =>
    padding.left + ((logRR + xRange) / (2 * xRange)) * plotW;
  const toY = (se: number) => padding.top + (se / yMax) * plotH;

  // Funnel bounds
  const funnelPoints: string[] = [];
  const funnelSteps = 50;
  for (let i = 0; i <= funnelSteps; i++) {
    const se = (i / funnelSteps) * yMax;
    funnelPoints.push(`${toX(1.96 * se)},${toY(se)}`);
  }
  for (let i = funnelSteps; i >= 0; i--) {
    const se = (i / funnelSteps) * yMax;
    funnelPoints.push(`${toX(-1.96 * se)},${toY(se)}`);
  }

  const xTicks: number[] = [];
  for (let t = -Math.floor(xRange); t <= Math.floor(xRange); t += 0.5) {
    if (Math.abs(t) <= xRange) xTicks.push(t);
  }

  const yTicks: number[] = [];
  for (let t = 0; t <= yMax; t += 0.1) {
    yTicks.push(Math.round(t * 10) / 10);
  }

  // Legend height depends on controls + calibration
  const legendRows =
    1 +
    (positiveControls && positiveControls.length > 0 ? 1 : 0) +
    (hasCalibrated ? 2 : 0);
  const legendH = legendRows * 20 + 6;

  return (
    <div className="overflow-x-auto">
      <svg
        data-testid="systematic-error-plot"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-text-primary"
        role="img"
        aria-label={t(
          "analyses.auto.systematicErrorPlotShowingNegativeControlEffectEstimates_e6f013",
        )}
      >
        <rect width={width} height={height} fill="var(--surface-raised)" rx={8} />

        {/* Grid */}
        {xTicks.map((v) => (
          <g key={`x-${v}`}>
            <line
              x1={toX(v)}
              y1={padding.top}
              x2={toX(v)}
              y2={padding.top + plotH}
              stroke="var(--surface-elevated)"
              strokeWidth={0.5}
            />
            <text
              x={toX(v)}
              y={padding.top + plotH + 16}
              textAnchor="middle"
              fill="var(--text-ghost)"
              fontSize={10}
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}
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
              y={toY(v) + 4}
              textAnchor="end"
              fill="var(--text-ghost)"
              fontSize={10}
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Funnel region */}
        <polygon
          points={funnelPoints.join(" ")}
          fill={FUNNEL_COLOR}
          opacity={0.08}
          stroke={FUNNEL_COLOR}
          strokeWidth={1}
          strokeDasharray="4 4"
          strokeOpacity={0.3}
        />

        {/* Reference line at log(RR)=0 */}
        <line
          x1={toX(0)}
          y1={padding.top}
          x2={toX(0)}
          y2={padding.top + plotH}
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          opacity={0.6}
        />

        {/* Calibration arrows (from original to calibrated) */}
        {hasCalibrated &&
          negativeControls
            .filter(
              (nc) =>
                nc.calibrated_log_rr !== undefined &&
                nc.calibrated_se_log_rr !== undefined,
            )
            .map((nc, i) => {
              const x1 = toX(nc.log_rr);
              const y1 = toY(nc.se_log_rr);
              const x2 = toX(nc.calibrated_log_rr!);
              const y2 = toY(nc.calibrated_se_log_rr!);

              // Arrow head direction
              const dx = x2 - x1;
              const dy = y2 - y1;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len < 1) return null;

              const arrowLen = 5;
              const ux = dx / len;
              const uy = dy / len;
              const ax = x2 - arrowLen * ux;
              const ay = y2 - arrowLen * uy;
              const px = -uy * 3;
              const py = ux * 3;

              return (
                <g key={`arrow-${i}`} data-testid="calibration-arrow">
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={ARROW_COLOR}
                    strokeWidth={1}
                    opacity={0.5}
                  />
                  <polygon
                    points={`${x2},${y2} ${ax + px},${ay + py} ${ax - px},${ay - py}`}
                    fill={ARROW_COLOR}
                    opacity={0.5}
                  />
                </g>
              );
            })}

        {/* Negative control points — original (open circles when calibration shown) */}
        {negativeControls.map((nc, i) => (
          <circle
            key={`nc-${i}`}
            cx={toX(nc.log_rr)}
            cy={toY(nc.se_log_rr)}
            r={4}
            fill={hasCalibrated ? "none" : NC_COLOR}
            stroke={NC_COLOR}
            strokeWidth={hasCalibrated ? 1.5 : 0.5}
            opacity={0.7}
          >
            <title>
              {t("analyses.auto.outcomeLogRRSE_eb89e6", {
                outcomeName: nc.outcome_name,
                logRR: fmt(nc.log_rr),
                se: fmt(nc.se_log_rr),
              })}
            </title>
          </circle>
        ))}

        {/* Calibrated negative control points (filled circles) */}
        {hasCalibrated &&
          negativeControls
            .filter(
              (nc) =>
                nc.calibrated_log_rr !== undefined &&
                nc.calibrated_se_log_rr !== undefined,
            )
            .map((nc, i) => (
              <circle
                key={`cal-${i}`}
                data-testid="calibrated-point"
                cx={toX(nc.calibrated_log_rr!)}
                cy={toY(nc.calibrated_se_log_rr!)}
                r={4}
                fill={NC_CALIBRATED_COLOR}
                stroke="var(--surface-raised)"
                strokeWidth={0.5}
                opacity={0.9}
              >
                <title>
                  {t("analyses.auto.outcomeCalibratedLogRRSE_d0d075", {
                    outcomeName: nc.outcome_name,
                    logRR: fmt(nc.calibrated_log_rr),
                    se: fmt(nc.calibrated_se_log_rr),
                  })}
                </title>
              </circle>
            ))}

        {/* Positive control points */}
        {positiveControls?.map((pc, i) => (
          <circle
            key={`pc-${i}`}
            cx={toX(pc.log_rr)}
            cy={toY(pc.se_log_rr)}
            r={4}
            fill={PC_COLOR}
            opacity={0.7}
            stroke="var(--surface-raised)"
            strokeWidth={0.5}
          >
            <title>
              {t("analyses.auto.outcomeLogRRSE_eb89e6", {
                outcomeName: pc.outcome_name,
                logRR: fmt(pc.log_rr),
                se: fmt(pc.se_log_rr),
              })}
            </title>
          </circle>
        ))}

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
        <g
          transform={`translate(${padding.left + plotW - 210}, ${padding.top + 8})`}
        >
          <rect
            x={0}
            y={0}
            width={200}
            height={legendH}
            rx={4}
            fill="var(--surface-base)"
            stroke="var(--surface-elevated)"
            strokeWidth={1}
          />
          {hasCalibrated ? (
            <>
              <circle cx={14} cy={14} r={3} fill="none" stroke={NC_COLOR} strokeWidth={1.5} />
              <text x={24} y={18} fill="var(--text-secondary)" fontSize={10}>
                {t("analyses.auto.preCalibrationCount_3e53ff", {
                  count: negativeControls.length,
                })}
              </text>
              <circle cx={14} cy={34} r={3} fill={NC_CALIBRATED_COLOR} />
              <text x={24} y={38} fill="var(--text-secondary)" fontSize={10}>
                {t("analyses.auto.postCalibration_6f2c0d")}
              </text>
              <line x1={8} y1={50} x2={20} y2={50} stroke={ARROW_COLOR} strokeWidth={1} opacity={0.6} />
              <text x={24} y={54} fill="var(--text-secondary)" fontSize={10}>
                {t("analyses.auto.calibrationShift_a18e1d")}
              </text>
            </>
          ) : (
            <>
              <circle cx={14} cy={12} r={3} fill={NC_COLOR} />
              <text x={24} y={16} fill="var(--text-secondary)" fontSize={10}>
                {t("analyses.auto.negativeControlsCount_327a89", {
                  count: negativeControls.length,
                })}
              </text>
            </>
          )}
          {positiveControls && positiveControls.length > 0 && (
            <>
              <circle
                cx={14}
                cy={hasCalibrated ? legendH - 8 : 32}
                r={3}
                fill={PC_COLOR}
              />
              <text
                x={24}
                y={hasCalibrated ? legendH - 4 : 36}
                fill="var(--text-secondary)"
                fontSize={10}
              >
                {t("analyses.auto.positiveControlsCount_2c54de", {
                  count: positiveControls.length,
                })}
              </text>
            </>
          )}
        </g>

        {/* Axis labels */}
        <text
          x={padding.left + plotW / 2}
          y={height - 8}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={11}
          fontWeight={600}
        >
          {t("analyses.auto.logRelativeRisk_0ba5c9")}
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
          {t("analyses.auto.standardError_7b2c21")}
        </text>
      </svg>
    </div>
  );
}
