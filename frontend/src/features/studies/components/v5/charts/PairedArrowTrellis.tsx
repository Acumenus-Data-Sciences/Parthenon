import type { TrellisRow } from "./chartAdapters";

const STOP_COLORS = ["#6B7280", "#C9A227", "#2DD4BF"];
const STOP_LABELS = ["t₁", "t₂", "t_dx"];

/**
 * Paired-arrow trellis: one track per group showing the mean value moving
 * across three timepoints (t₁ → t₂ → t_dx). Makes the direction and magnitude of
 * the within-group shift explicit. Self-contained SVG.
 */
export function PairedArrowTrellis({
  rows,
  xLabel = "mean SBP (mmHg)",
}: {
  rows: TrellisRow[];
  xLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-text-ghost italic">No trajectory data.</p>;
  }

  const values = rows.flatMap((r) => [r.t1, r.t2, r.t_dx]);
  const xMin = Math.min(...values) - 3;
  const xMax = Math.max(...values) + 3;

  const W = 720;
  const padL = 110;
  const padR = 24;
  const rowH = 34;
  const padT = 10;
  const padB = 26;
  const height = padT + rows.length * rowH + padB;
  const plotW = W - padL - padR;
  const sx = (x: number) => padL + ((x - xMin) / (xMax - xMin || 1)) * plotW;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label="Blood-pressure trajectory trellis">
        {[xMin, (xMin + xMax) / 2, xMax].map((tick) => (
          <g key={tick}>
            <line x1={sx(tick)} x2={sx(tick)} y1={padT} y2={height - padB} stroke="currentColor" className="text-border-default" strokeWidth={0.5} />
            <text x={sx(tick)} y={height - padB + 15} textAnchor="middle" className="fill-text-ghost text-[9px]">
              {Math.round(tick)}
            </text>
          </g>
        ))}
        <text x={padL + plotW / 2} y={height - 2} textAnchor="middle" className="fill-text-muted text-[10px]">
          {xLabel}
        </text>

        {rows.map((r, ri) => {
          const y = padT + ri * rowH + rowH / 2;
          const stops = [r.t1, r.t2, r.t_dx];
          return (
            <g key={r.group}>
              <text x={padL - 10} y={y + 3} textAnchor="end" className="fill-text-secondary text-[10px]">
                {r.group}
              </text>
              <line x1={sx(r.t1)} x2={sx(r.t_dx)} y1={y} y2={y} stroke="currentColor" className="text-border-muted" strokeWidth={1.5} />
              {stops.map((v, si) => (
                <g key={si}>
                  {si < stops.length - 1 && (
                    <line
                      x1={sx(stops[si])}
                      x2={sx(stops[si + 1])}
                      y1={y}
                      y2={y}
                      stroke={STOP_COLORS[si + 1]}
                      strokeWidth={2}
                    />
                  )}
                  <circle cx={sx(v)} cy={y} r={4} fill={STOP_COLORS[si]} />
                </g>
              ))}
            </g>
          );
        })}
      </svg>

      <div className="mt-1 flex flex-wrap items-center gap-3 pl-28 text-[10px] text-text-muted">
        {STOP_LABELS.map((label, i) => (
          <span key={label} className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: STOP_COLORS[i] }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
