import type { CovariateBalanceEntry } from "../types/estimation";
import { fmt, num } from "@/lib/formatters";

interface LovePlotProps {
  data: CovariateBalanceEntry[];
  maxDisplay?: number;
}

export function LovePlot({ data, maxDisplay = 200 }: LovePlotProps) {
  if (data.length === 0) return null;

  const width = 600;
  const height = 400;
  const padding = { top: 30, right: 30, bottom: 50, left: 55 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const BEFORE_COLOR = "#E85A6B";
  const AFTER_COLOR = "#2DD4BF";
  const THRESHOLD_COLOR = "#C9A227";

  // Limit display and compute bounds
  const displayData = data.slice(0, maxDisplay);
  const allSmds = displayData.flatMap((d) => [
    Math.abs(d.smd_before),
    Math.abs(d.smd_after),
  ]);
  const maxSmd = Math.max(...allSmds, 0.15);
  const scaleMax = Math.ceil(maxSmd * 10) / 10;

  // Y-axis: index (each covariate gets a y position)
  const toX = (smd: number) =>
    padding.left + ((Math.abs(smd) / scaleMax) * plotW);
  const toY = (index: number) =>
    padding.top + ((index + 0.5) / displayData.length) * plotH;

  const xTicks: number[] = [];
  for (let t = 0; t <= scaleMax; t += 0.1) {
    xTicks.push(Math.round(t * 10) / 10);
  }

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-[#F0EDE8]"
        role="img"
        aria-label="Love plot showing covariate balance before and after matching"
      >
        <rect width={width} height={height} fill="#151518" rx={8} />

        {/* Grid */}
        {xTicks.map((v) => (
          <g key={v}>
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

        {/* Threshold line at |SMD| = 0.1 */}
        <line
          x1={toX(0.1)}
          y1={padding.top}
          x2={toX(0.1)}
          y2={padding.top + plotH}
          stroke={THRESHOLD_COLOR}
          strokeWidth={1.5}
          strokeDasharray="6 4"
          opacity={0.7}
        />
        <text
          x={toX(0.1) + 4}
          y={padding.top + 14}
          fill={THRESHOLD_COLOR}
          fontSize={9}
          opacity={0.8}
        >
          0.1
        </text>

        {/* Data points */}
        {displayData.map((entry, i) => {
          const yPos = toY(i);
          const beforeX = toX(entry.smd_before);
          const afterX = toX(entry.smd_after);

          return (
            <g key={i}>
              {/* Connecting line */}
              <line
                x1={beforeX}
                y1={yPos}
                x2={afterX}
                y2={yPos}
                stroke="#323238"
                strokeWidth={0.5}
              />
              {/* Before matching (open circle) */}
              <circle
                cx={beforeX}
                cy={yPos}
                r={3}
                fill="none"
                stroke={BEFORE_COLOR}
                strokeWidth={1.5}
                opacity={0.7}
              >
                <title>
                  {entry.covariate_name}: Before SMD = {fmt(entry.smd_before)}
                </title>
              </circle>
              {/* After matching (filled circle) */}
              <circle
                cx={afterX}
                cy={yPos}
                r={3}
                fill={AFTER_COLOR}
                stroke="none"
                opacity={0.8}
              >
                <title>
                  {entry.covariate_name}: After SMD = {fmt(entry.smd_after)}
                </title>
              </circle>
            </g>
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
        <g transform={`translate(${padding.left + plotW - 180}, ${padding.top + 8})`}>
          <rect x={0} y={0} width={170} height={42} rx={4} fill="#0E0E11" stroke="#232328" strokeWidth={1} />
          <circle cx={14} cy={14} r={3} fill="none" stroke={BEFORE_COLOR} strokeWidth={1.5} />
          <text x={24} y={18} fill="#C5C0B8" fontSize={10}>Before Matching</text>
          <circle cx={14} cy={32} r={3} fill={AFTER_COLOR} />
          <text x={24} y={36} fill="#C5C0B8" fontSize={10}>After Matching</text>
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
          Absolute Standardized Mean Difference
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
          Covariates
        </text>
      </svg>
    </div>
  );
}
