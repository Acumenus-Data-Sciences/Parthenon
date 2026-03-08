import { fmt } from "@/lib/formatters";

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
}

export function SystematicErrorPlot({
  negativeControls,
  positiveControls,
}: SystematicErrorPlotProps) {
  if (negativeControls.length === 0) return null;

  const width = 600;
  const height = 400;
  const padding = { top: 30, right: 30, bottom: 50, left: 55 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const NC_COLOR = "#2DD4BF";
  const PC_COLOR = "#C9A227";
  const FUNNEL_COLOR = "#E85A6B";

  const allPoints = [
    ...negativeControls,
    ...(positiveControls ?? []),
  ];
  const allLogRR = allPoints.map((p) => p.log_rr);
  const allSE = allPoints.map((p) => p.se_log_rr);

  const maxAbsLogRR = Math.max(...allLogRR.map(Math.abs), 0.5);
  const maxSE = Math.max(...allSE, 0.5);
  const xRange = Math.ceil(maxAbsLogRR * 10) / 10 + 0.2;
  const yMax = Math.ceil(maxSE * 10) / 10 + 0.1;

  const toX = (logRR: number) =>
    padding.left + ((logRR + xRange) / (2 * xRange)) * plotW;
  const toY = (se: number) =>
    padding.top + (se / yMax) * plotH;

  // Funnel bounds: at each SE level, 95% CI is ±1.96*SE
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

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-[#F0EDE8]"
        role="img"
        aria-label="Systematic error plot showing negative control effect estimates"
      >
        <rect width={width} height={height} fill="#151518" rx={8} />

        {/* Grid */}
        {xTicks.map((v) => (
          <g key={`x-${v}`}>
            <line
              x1={toX(v)}
              y1={padding.top}
              x2={toX(v)}
              y2={padding.top + plotH}
              stroke="#232328"
              strokeWidth={0.5}
            />
            <text
              x={toX(v)}
              y={padding.top + plotH + 16}
              textAnchor="middle"
              fill="#5A5650"
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
              stroke="#232328"
              strokeWidth={0.5}
            />
            <text
              x={padding.left - 8}
              y={toY(v) + 4}
              textAnchor="end"
              fill="#5A5650"
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
          stroke="#C9A227"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          opacity={0.6}
        />

        {/* Negative control points */}
        {negativeControls.map((nc, i) => (
          <circle
            key={`nc-${i}`}
            cx={toX(nc.log_rr)}
            cy={toY(nc.se_log_rr)}
            r={4}
            fill={NC_COLOR}
            opacity={0.7}
            stroke="#151518"
            strokeWidth={0.5}
          >
            <title>
              {nc.outcome_name}: log(RR)={fmt(nc.log_rr)}, SE=
              {fmt(nc.se_log_rr)}
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
            stroke="#151518"
            strokeWidth={0.5}
          >
            <title>
              {pc.outcome_name}: log(RR)={fmt(pc.log_rr)}, SE=
              {fmt(pc.se_log_rr)}
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
          stroke="#323238"
          strokeWidth={1}
        />

        {/* Legend */}
        <g transform={`translate(${padding.left + plotW - 200}, ${padding.top + 8})`}>
          <rect x={0} y={0} width={190} height={positiveControls ? 42 : 22} rx={4} fill="#0E0E11" stroke="#232328" strokeWidth={1} />
          <circle cx={14} cy={12} r={3} fill={NC_COLOR} />
          <text x={24} y={16} fill="#C5C0B8" fontSize={10}>
            Negative Controls ({negativeControls.length})
          </text>
          {positiveControls && positiveControls.length > 0 && (
            <>
              <circle cx={14} cy={32} r={3} fill={PC_COLOR} />
              <text x={24} y={36} fill="#C5C0B8" fontSize={10}>
                Positive Controls ({positiveControls.length})
              </text>
            </>
          )}
        </g>

        {/* Axis labels */}
        <text
          x={padding.left + plotW / 2}
          y={height - 8}
          textAnchor="middle"
          fill="#8A857D"
          fontSize={11}
          fontWeight={600}
        >
          Log Relative Risk
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
          Standard Error
        </text>
      </svg>
    </div>
  );
}
