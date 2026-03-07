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
}

export function KaplanMeierPlot({
  targetCurve,
  comparatorCurve,
  targetLabel = "Target",
  comparatorLabel = "Comparator",
  logRankPValue,
  timeUnit = "days",
}: KaplanMeierPlotProps) {
  const width = 700;
  const riskTableHeight = 60;
  const chartHeight = 360;
  const height = chartHeight + riskTableHeight;
  const padding = { top: 30, right: 30, bottom: 20, left: 55 };
  const plotW = width - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;

  const TARGET_COLOR = "#2DD4BF";
  const COMPARATOR_COLOR = "#C9A227";

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
      // Horizontal step to next time point
      d += ` L ${toX(sorted[i].time)} ${toY(sorted[i - 1].surv)}`;
      // Vertical drop to new survival
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

    // Upper bound (step function, left-to-right)
    let upper = `M ${toX(withBands[0].time)} ${toY(withBands[0].survUpper!)}`;
    for (let i = 1; i < withBands.length; i++) {
      upper += ` L ${toX(withBands[i].time)} ${toY(withBands[i - 1].survUpper!)}`;
      upper += ` L ${toX(withBands[i].time)} ${toY(withBands[i].survUpper!)}`;
    }

    // Lower bound (step function, right-to-left)
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

  const targetPath = buildStepPath(targetCurve);
  const comparatorPath = buildStepPath(comparatorCurve);
  const targetBand = buildBandPath(targetCurve);
  const comparatorBand = buildBandPath(comparatorCurve);

  // Y-axis ticks
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  // X-axis ticks (5-7 ticks)
  const xTickCount = 6;
  const xTickStep = Math.ceil(maxTime / xTickCount);
  const xTicks: number[] = [];
  for (let t = 0; t <= maxTime; t += xTickStep) {
    xTicks.push(t);
  }
  if (xTicks[xTicks.length - 1] < maxTime) xTicks.push(maxTime);

  // Number-at-risk rows at each x tick
  function getNAtRisk(curve: KaplanMeierPoint[], time: number): number {
    const sorted = [...curve].sort((a, b) => a.time - b.time);
    let nAtRisk = 0;
    for (const pt of sorted) {
      if (pt.time <= time) nAtRisk = pt.nAtRisk;
      else break;
    }
    return nAtRisk;
  }

  // Censor marks — points where nCensored > 0
  function getCensorMarks(curve: KaplanMeierPoint[]) {
    return curve.filter((p) => p.nCensored > 0);
  }

  const targetCensors = getCensorMarks(targetCurve);
  const comparatorCensors = getCensorMarks(comparatorCurve);

  // Find survival at censor time for mark placement
  function getSurvAt(curve: KaplanMeierPoint[], time: number): number {
    const sorted = [...curve].sort((a, b) => a.time - b.time);
    let surv = 1;
    for (const pt of sorted) {
      if (pt.time <= time) surv = pt.surv;
      else break;
    }
    return surv;
  }

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-[#F0EDE8]"
        role="img"
        aria-label="Kaplan-Meier survival curves"
      >
        {/* Background */}
        <rect width={width} height={height} fill="#151518" rx={8} />

        {/* Grid */}
        {yTicks.map((v) => (
          <g key={`y-${v}`}>
            <line
              x1={padding.left}
              y1={toY(v)}
              x2={padding.left + plotW}
              y2={toY(v)}
              stroke="#232328"
              strokeWidth={0.5}
            />
            <text
              x={padding.left - 8}
              y={toY(v) + 3}
              textAnchor="end"
              fill="#5A5650"
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
              stroke="#232328"
              strokeWidth={0.5}
            />
            <text
              x={toX(t)}
              y={chartHeight - 4}
              textAnchor="middle"
              fill="#5A5650"
              fontSize={10}
            >
              {t}
            </text>
          </g>
        ))}

        {/* Confidence bands */}
        {targetBand && (
          <path d={targetBand} fill={TARGET_COLOR} opacity={0.08} />
        )}
        {comparatorBand && (
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

        {/* Censor marks (small vertical ticks) */}
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

        {/* Plot boundary */}
        <rect
          x={padding.left}
          y={padding.top}
          width={plotW}
          height={plotH}
          fill="none"
          stroke="#323238"
          strokeWidth={1}
        />

        {/* Legend */}
        <g transform={`translate(${padding.left + 12}, ${padding.top + 12})`}>
          <rect
            x={0}
            y={0}
            width={180}
            height={logRankPValue !== undefined ? 56 : 42}
            rx={4}
            fill="#0E0E11"
            stroke="#232328"
            strokeWidth={1}
          />
          <line x1={8} y1={14} x2={28} y2={14} stroke={TARGET_COLOR} strokeWidth={2.5} />
          <text x={34} y={18} fill="#C5C0B8" fontSize={11}>{targetLabel}</text>
          <line x1={8} y1={32} x2={28} y2={32} stroke={COMPARATOR_COLOR} strokeWidth={2.5} />
          <text x={34} y={36} fill="#C5C0B8" fontSize={11}>{comparatorLabel}</text>
          {logRankPValue !== undefined && (
            <text
              x={8}
              y={52}
              fill="#8A857D"
              fontSize={10}
              fontFamily="IBM Plex Mono, monospace"
            >
              Log-rank p={logRankPValue < 0.001 ? "<0.001" : logRankPValue.toFixed(3)}
            </text>
          )}
        </g>

        {/* Axis labels */}
        <text
          x={padding.left + plotW / 2}
          y={chartHeight + 16}
          textAnchor="middle"
          fill="#8A857D"
          fontSize={11}
          fontWeight={600}
        >
          Time ({timeUnit})
        </text>
        <text
          x={14}
          y={padding.top + plotH / 2}
          textAnchor="middle"
          fill="#8A857D"
          fontSize={11}
          fontWeight={600}
          transform={`rotate(-90 14 ${padding.top + plotH / 2})`}
        >
          Survival Probability
        </text>

        {/* Number at risk table */}
        <line
          x1={padding.left}
          y1={chartHeight + 24}
          x2={padding.left + plotW}
          y2={chartHeight + 24}
          stroke="#232328"
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
          At risk
        </text>
        <text
          x={padding.left - 8}
          y={chartHeight + 54}
          textAnchor="end"
          fill={COMPARATOR_COLOR}
          fontSize={9}
          fontWeight={600}
        >
          At risk
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
