import { useMemo, useState } from "react";
import { scaleSequential } from "d3-scale";
import { interpolateViridis } from "d3-scale-chromatic";
import { formatCompact, CHART } from "./chartUtils";

interface HeatmapDataPoint {
  row: string;
  col: string;
  value: number;
}

interface HeatmapChartProps {
  data: HeatmapDataPoint[];
  rowLabel?: string;
  colLabel?: string;
  rowColors?: Record<string, string>;
}

export function HeatmapChart({
  data,
  rowColors,
}: HeatmapChartProps) {
  const [hovered, setHovered] = useState<{ row: string; col: string } | null>(null);

  const { rows, cols, valueMap, maxVal } = useMemo(() => {
    const rowSet = new Set<string>();
    const colSet = new Set<string>();
    const map = new Map<string, number>();
    let max = 0;

    for (const d of data) {
      rowSet.add(d.row);
      colSet.add(d.col);
      const key = `${d.row}|${d.col}`;
      map.set(key, d.value);
      if (d.value > max) max = d.value;
    }

    return {
      rows: Array.from(rowSet).sort(),
      cols: Array.from(colSet).sort(),
      valueMap: map,
      maxVal: max,
    };
  }, [data]);

  const colorScale = useMemo(
    () => scaleSequential(interpolateViridis).domain([0, maxVal || 1]),
    [maxVal],
  );

  if (!rows.length || !cols.length) return null;

  const cellW = Math.max(28, Math.min(60, 700 / cols.length));
  const cellH = 32;
  const labelW = 100;
  const padTop = 40;
  const svgW = labelW + cols.length * cellW + 10;
  const svgH = padTop + rows.length * cellH + 10;

  const hoveredVal =
    hovered != null ? valueMap.get(`${hovered.row}|${hovered.col}`) ?? 0 : null;

  return (
    <div className="overflow-x-auto">
      <svg
        width={svgW}
        height={svgH}
        className="block"
        role="img"
        aria-label="Data density heatmap"
      >
        {/* Column headers */}
        {cols.map((col, ci) => (
          <text
            key={col}
            x={labelW + ci * cellW + cellW / 2}
            y={padTop - 8}
            textAnchor="middle"
            fill={CHART.textMuted}
            fontSize={10}
          >
            {col}
          </text>
        ))}

        {/* Row labels + cells */}
        {rows.map((row, ri) => (
          <g key={row}>
            {/* Row label */}
            <text
              x={labelW - 8}
              y={padTop + ri * cellH + cellH / 2}
              textAnchor="end"
              dominantBaseline="middle"
              fill={rowColors?.[row] ?? CHART.textSec}
              fontSize={11}
              fontWeight={500}
            >
              {row.charAt(0).toUpperCase() + row.slice(1)}
            </text>

            {/* Cells */}
            {cols.map((col, ci) => {
              const val = valueMap.get(`${row}|${col}`) ?? 0;
              const isHov = hovered?.row === row && hovered?.col === col;
              return (
                <rect
                  key={col}
                  x={labelW + ci * cellW + 1}
                  y={padTop + ri * cellH + 1}
                  width={cellW - 2}
                  height={cellH - 2}
                  rx={3}
                  fill={val > 0 ? colorScale(val) : CHART.bgDarker}
                  stroke={isHov ? CHART.text : "none"}
                  strokeWidth={isHov ? 1.5 : 0}
                  opacity={val > 0 ? 0.85 : 0.3}
                  onMouseEnter={() => setHovered({ row, col })}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "crosshair" }}
                />
              );
            })}
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {hovered && hoveredVal !== null && (
        <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[#323238] bg-[#1A1A1E] px-3 py-1.5">
          <span className="text-xs text-[#8A857D]">
            {hovered.row.charAt(0).toUpperCase() + hovered.row.slice(1)} &middot;{" "}
            {hovered.col}
          </span>
          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#F0EDE8]">
            {formatCompact(hoveredVal)} records
          </span>
        </div>
      )}

      {/* Color legend bar */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-[#5A5650]">0</span>
        <div
          className="h-3 flex-1 rounded"
          style={{
            background: `linear-gradient(to right, ${colorScale(0)}, ${colorScale(maxVal * 0.25)}, ${colorScale(maxVal * 0.5)}, ${colorScale(maxVal * 0.75)}, ${colorScale(maxVal)})`,
            maxWidth: 200,
          }}
        />
        <span className="text-xs text-[#5A5650]">{formatCompact(maxVal)}</span>
      </div>
    </div>
  );
}
