import { fmt } from "@/lib/formatters";

interface PrecisionRecallCurveProps {
  data: { recall: number; precision: number }[];
  auprc: number;
}

export function PrecisionRecallCurve({ data, auprc }: PrecisionRecallCurveProps) {
  if (data.length === 0) return null;

  const size = 400;
  const padding = { top: 30, right: 30, bottom: 50, left: 55 };
  const plotW = size - padding.left - padding.right;
  const plotH = size - padding.top - padding.bottom;

  const toX = (v: number) => padding.left + v * plotW;
  const toY = (v: number) => padding.top + (1 - v) * plotH;

  // Build area path
  const areaPath = [
    `M ${toX(data[0].recall)} ${toY(0)}`,
    `L ${toX(data[0].recall)} ${toY(data[0].precision)}`,
    ...data.slice(1).map((p) => `L ${toX(p.recall)} ${toY(p.precision)}`),
    `L ${toX(data[data.length - 1].recall)} ${toY(0)}`,
    "Z",
  ].join(" ");

  const linePath = data
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.recall)} ${toY(p.precision)}`)
    .join(" ");

  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="text-text-primary"
      role="img"
      aria-label={`Precision-Recall curve, AUPRC = ${fmt(auprc)}`}
    >
      <rect width={size} height={size} fill="var(--surface-raised)" rx={8} />

      {/* Grid */}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={toX(v)} y1={padding.top} x2={toX(v)} y2={padding.top + plotH} stroke="var(--surface-elevated)" strokeWidth={0.5} />
          <line x1={padding.left} y1={toY(v)} x2={padding.left + plotW} y2={toY(v)} stroke="var(--surface-elevated)" strokeWidth={0.5} />
          <text x={toX(v)} y={padding.top + plotH + 16} textAnchor="middle" fill="var(--text-ghost)" fontSize={10}>
            {v.toFixed(1)}
          </text>
          <text x={padding.left - 8} y={toY(v) + 4} textAnchor="end" fill="var(--text-ghost)" fontSize={10}>
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* Area */}
      <path d={areaPath} fill="var(--success)" opacity={0.15} />

      {/* Curve */}
      <path d={linePath} fill="none" stroke="var(--success)" strokeWidth={2} />

      {/* Plot boundary */}
      <rect x={padding.left} y={padding.top} width={plotW} height={plotH} fill="none" stroke="var(--surface-highlight)" strokeWidth={1} />

      {/* Legend */}
      <g transform={`translate(${padding.left + plotW - 130}, ${padding.top + 8})`}>
        <rect x={0} y={0} width={120} height={24} rx={4} fill="var(--surface-base)" stroke="var(--surface-elevated)" strokeWidth={1} />
        <text x={10} y={16} fill="var(--success)" fontSize={10} fontFamily="IBM Plex Mono, monospace" fontWeight={600}>
          AUPRC = {fmt(auprc)}
        </text>
      </g>

      {/* Axis labels */}
      <text x={padding.left + plotW / 2} y={size - 8} textAnchor="middle" fill="var(--text-muted)" fontSize={11} fontWeight={600}>
        Recall
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
        Precision
      </text>
    </svg>
  );
}
