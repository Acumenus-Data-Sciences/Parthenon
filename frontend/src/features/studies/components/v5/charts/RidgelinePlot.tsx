import type { RidgeSeries } from "./chartAdapters";

// Two-timepoint palette (Acumenus): baseline muted → diagnosis teal.
const TIMEPOINT_COLORS: Record<string, string> = {
  t1: "#6B7280",
  t2: "#C9A227",
  t_dx: "#2DD4BF",
};

/**
 * Stacked kernel-density ridgeline. Each group gets a band; within it every
 * timepoint's KDE is drawn as a filled area on a shared x-scale, so the leftward
 * shift of blood pressure from baseline (t1) to diagnosis (t_dx) reads at a
 * glance. Self-contained SVG — no chart dependency.
 */
export function RidgelinePlot({
  series,
  xLabel = "mmHg",
  height = 260,
}: {
  series: RidgeSeries[];
  xLabel?: string;
  height?: number;
}) {
  const clean = series.filter((s) => s.points.length > 0);
  if (clean.length === 0) {
    return <p className="text-xs text-text-ghost italic">No distribution data.</p>;
  }

  const groups = Array.from(new Set(clean.map((s) => s.group)));
  const allX = clean.flatMap((s) => s.points.map((p) => p[0]));
  const xMin = Math.min(...allX);
  const xMax = Math.max(...allX);
  const maxDensity = Math.max(...clean.flatMap((s) => s.points.map((p) => p[1])), 1e-9);

  const W = 720;
  const padL = 96;
  const padR = 16;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const bandH = (height - padT - padB) / groups.length;
  const ridgeH = bandH * 1.5; // overlap for the classic ridgeline look

  const sx = (x: number) => padL + ((x - xMin) / (xMax - xMin || 1)) * plotW;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label="Blood-pressure distribution ridgeline">
        {/* x grid + ticks */}
        {[xMin, (xMin + xMax) / 2, xMax].map((tick) => (
          <g key={tick}>
            <line x1={sx(tick)} x2={sx(tick)} y1={padT} y2={height - padB} stroke="currentColor" className="text-border-default" strokeWidth={0.5} />
            <text x={sx(tick)} y={height - padB + 16} textAnchor="middle" className="fill-text-ghost text-[9px]">
              {Math.round(tick)}
            </text>
          </g>
        ))}
        <text x={padL + plotW / 2} y={height - 2} textAnchor="middle" className="fill-text-muted text-[10px]">
          {xLabel}
        </text>

        {groups.map((group, gi) => {
          const baseY = padT + gi * bandH + bandH;
          const groupSeries = clean.filter((s) => s.group === group);
          return (
            <g key={group}>
              <text x={padL - 8} y={baseY - 4} textAnchor="end" className="fill-text-secondary text-[10px]">
                {group}
              </text>
              {groupSeries.map((s) => {
                const color = TIMEPOINT_COLORS[s.timepoint] ?? "#9B1B30";
                const path = s.points
                  .map((p, i) => {
                    const px = sx(p[0]);
                    const py = baseY - (p[1] / maxDensity) * ridgeH;
                    return `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
                  })
                  .join(" ");
                const area = `${path} L${sx(s.points[s.points.length - 1][0]).toFixed(1)},${baseY} L${sx(s.points[0][0]).toFixed(1)},${baseY} Z`;
                return (
                  <g key={`${s.group}-${s.timepoint}`}>
                    <path d={area} fill={color} fillOpacity={0.18} />
                    <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* legend */}
      <div className="mt-1 flex flex-wrap items-center gap-3 pl-24 text-[10px] text-text-muted">
        {Array.from(new Set(clean.map((s) => s.timepoint))).map((tp) => (
          <span key={tp} className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: TIMEPOINT_COLORS[tp] ?? "#9B1B30" }} />
            {tp}
          </span>
        ))}
      </div>
    </div>
  );
}
