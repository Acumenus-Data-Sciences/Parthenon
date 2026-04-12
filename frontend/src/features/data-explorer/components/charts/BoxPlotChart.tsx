import type { BoxPlotData } from "../../types/dataExplorer";

interface BoxPlotChartProps {
  data: BoxPlotData | null;
  label?: string;
}

/** Format large numbers compactly */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function BoxPlotChart({ data, label }: BoxPlotChartProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border-default bg-surface-raised py-16">
        <p className="text-sm text-text-muted">No distribution data</p>
      </div>
    );
  }

  const { min, p10, p25, median, p75, p90, max } = data;
  const range = max - min || 1;

  // Scale helpers: map a value to percentage position within the SVG plot area
  const toX = (v: number) => ((v - min) / range) * 100;

  const plotW = 500;
  const plotH = 80;
  const padL = 20;
  const padR = 20;
  const innerW = plotW - padL - padR;

  const sx = (v: number) => padL + (toX(v) / 100) * innerW;
  const cy = plotH / 2;
  const boxH = 28;

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-6">
      {label && (
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </h3>
      )}
      <svg
        viewBox={`0 0 ${plotW} ${plotH + 40}`}
        className="w-full"
        role="img"
        aria-label={label ?? "Box plot"}
      >
        {/* Whisker line: min to max */}
        <line
          x1={sx(min)}
          x2={sx(max)}
          y1={cy}
          y2={cy}
          stroke="var(--text-muted)"
          strokeWidth={1}
        />

        {/* Min whisker cap */}
        <line
          x1={sx(min)}
          x2={sx(min)}
          y1={cy - 8}
          y2={cy + 8}
          stroke="var(--text-muted)"
          strokeWidth={1.5}
        />

        {/* Max whisker cap */}
        <line
          x1={sx(max)}
          x2={sx(max)}
          y1={cy - 8}
          y2={cy + 8}
          stroke="var(--text-muted)"
          strokeWidth={1.5}
        />

        {/* P10 tick */}
        <line
          x1={sx(p10)}
          x2={sx(p10)}
          y1={cy - 6}
          y2={cy + 6}
          stroke="var(--text-ghost)"
          strokeWidth={1}
          strokeDasharray="2 2"
        />

        {/* P90 tick */}
        <line
          x1={sx(p90)}
          x2={sx(p90)}
          y1={cy - 6}
          y2={cy + 6}
          stroke="var(--text-ghost)"
          strokeWidth={1}
          strokeDasharray="2 2"
        />

        {/* IQR box: p25 to p75 */}
        <rect
          x={sx(p25)}
          y={cy - boxH / 2}
          width={sx(p75) - sx(p25)}
          height={boxH}
          fill="var(--success)"
          fillOpacity={0.2}
          stroke="var(--success)"
          strokeWidth={1.5}
          rx={3}
        />

        {/* Median line */}
        <line
          x1={sx(median)}
          x2={sx(median)}
          y1={cy - boxH / 2}
          y2={cy + boxH / 2}
          stroke="var(--accent)"
          strokeWidth={2.5}
        />

        {/* Labels */}
        <text x={sx(min)} y={plotH + 12} textAnchor="middle" className="fill-[#8A857D]" fontSize={9}>
          {formatCompact(min)}
        </text>
        <text x={sx(p25)} y={plotH + 12} textAnchor="middle" className="fill-[#C5C0B8]" fontSize={9}>
          P25: {formatCompact(p25)}
        </text>
        <text x={sx(median)} y={plotH + 24} textAnchor="middle" className="fill-[#C9A227]" fontSize={9} fontWeight={600}>
          Median: {formatCompact(median)}
        </text>
        <text x={sx(p75)} y={plotH + 12} textAnchor="middle" className="fill-[#C5C0B8]" fontSize={9}>
          P75: {formatCompact(p75)}
        </text>
        <text x={sx(max)} y={plotH + 12} textAnchor="middle" className="fill-[#8A857D]" fontSize={9}>
          {formatCompact(max)}
        </text>
      </svg>
    </div>
  );
}
