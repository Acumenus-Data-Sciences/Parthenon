import { cn } from "@/lib/utils";
import { fmt } from "@/lib/formatters";
import type { PerSiteResult, PooledEstimate } from "../types/evidenceSynthesis";

interface ForestPlotProps {
  perSite: PerSiteResult[];
  pooled: PooledEstimate;
  className?: string;
}

export function ForestPlot({ perSite, pooled, className }: ForestPlotProps) {
  // Determine axis range
  const allValues = [
    ...perSite.flatMap((s) => [s.ci_lower, s.ci_upper]),
    pooled.ci_lower,
    pooled.ci_upper,
  ];
  const min = Math.min(...allValues, 0.1);
  const max = Math.max(...allValues, 3);
  const logMin = Math.log(Math.max(min * 0.8, 0.01));
  const logMax = Math.log(max * 1.2);
  const logRange = logMax - logMin;

  const toX = (hr: number) => {
    const logHr = Math.log(Math.max(hr, 0.01));
    return ((logHr - logMin) / logRange) * 100;
  };

  const nullLineX = toX(1);
  const rowHeight = 32;
  const svgHeight = (perSite.length + 2) * rowHeight + 40;

  return (
    <div className={cn("rounded-lg border border-[#232328] bg-[#151518] p-4", className)}>
      <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">Forest Plot</h3>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 600 ${svgHeight}`}
          className="w-full min-w-[500px]"
          style={{ maxHeight: svgHeight }}
        >
          {/* Null effect line at HR=1 */}
          <line
            x1={120 + nullLineX * 4.2}
            y1={10}
            x2={120 + nullLineX * 4.2}
            y2={svgHeight - 30}
            stroke="#5A5650"
            strokeWidth={1}
            strokeDasharray="4,4"
          />

          {/* Per-site rows */}
          {perSite.map((site, idx) => {
            const y = 24 + idx * rowHeight;
            const xHr = 120 + toX(site.hr) * 4.2;
            const xLo = 120 + toX(site.ci_lower) * 4.2;
            const xHi = 120 + toX(site.ci_upper) * 4.2;

            return (
              <g key={idx}>
                {/* Label */}
                <text x={8} y={y + 4} fill="#C5C0B8" fontSize={11} fontFamily="monospace">
                  {site.site_name}
                </text>
                {/* CI line */}
                <line x1={xLo} y1={y} x2={xHi} y2={y} stroke="#8A857D" strokeWidth={1.5} />
                {/* Point estimate */}
                <rect
                  x={xHr - 4}
                  y={y - 4}
                  width={8}
                  height={8}
                  fill="#2DD4BF"
                  rx={1}
                />
                {/* HR label */}
                <text x={550} y={y + 4} fill="#8A857D" fontSize={10} fontFamily="monospace" textAnchor="end">
                  {fmt(site.hr, 2)} [{fmt(site.ci_lower, 2)}, {fmt(site.ci_upper, 2)}]
                </text>
              </g>
            );
          })}

          {/* Pooled estimate (diamond) */}
          {(() => {
            const y = 24 + perSite.length * rowHeight + 12;
            const xHr = 120 + toX(pooled.hr) * 4.2;
            const xLo = 120 + toX(pooled.ci_lower) * 4.2;
            const xHi = 120 + toX(pooled.ci_upper) * 4.2;

            return (
              <g>
                <line x1={0} y1={y - 14} x2={600} y2={y - 14} stroke="#232328" strokeWidth={1} />
                <text x={8} y={y + 4} fill="#F0EDE8" fontSize={11} fontWeight="bold" fontFamily="monospace">
                  Pooled
                </text>
                {/* Diamond */}
                <polygon
                  points={`${xLo},${y} ${xHr},${y - 6} ${xHi},${y} ${xHr},${y + 6}`}
                  fill="#C9A227"
                  opacity={0.8}
                />
                <text x={550} y={y + 4} fill="#C9A227" fontSize={10} fontFamily="monospace" fontWeight="bold" textAnchor="end">
                  {fmt(pooled.hr, 2)} [{fmt(pooled.ci_lower, 2)}, {fmt(pooled.ci_upper, 2)}]
                </text>
              </g>
            );
          })()}

          {/* X-axis */}
          {[0.25, 0.5, 1, 2, 4].filter((v) => v >= min * 0.9 && v <= max * 1.1).map((tick) => {
            const x = 120 + toX(tick) * 4.2;
            return (
              <g key={tick}>
                <line x1={x} y1={svgHeight - 30} x2={x} y2={svgHeight - 25} stroke="#5A5650" strokeWidth={1} />
                <text x={x} y={svgHeight - 12} fill="#5A5650" fontSize={9} textAnchor="middle" fontFamily="monospace">
                  {tick}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
