import { useMemo } from "react";
import { ChartCard, CHART, formatCompact } from "@/features/data-explorer/components/charts/chartUtils";
import type { HeorResult } from "../types";

interface Props {
  results: HeorResult[];
  wtp?: number;
}

/** Quadrant labels for the CE plane */
const QUADRANTS = {
  ne: { label: "More Costly, More Effective", sub: "Trade-off (ICER decides)" },
  nw: { label: "More Costly, Less Effective", sub: "Dominated" },
  se: { label: "Less Costly, More Effective", sub: "Dominant" },
  sw: { label: "Less Costly, Less Effective", sub: "Trade-off" },
} as const;

const POINT_COLORS = [CHART.accent, CHART.gold, CHART.crimson, CHART.blue, "#A855F7", "#34D399"];

export default function CostEffectivenessPlane({ results, wtp = 50000 }: Props) {
  // Filter to only incremental results (non-base-case scenarios)
  const points = useMemo(
    () =>
      results
        .filter((r) => r.incremental_qalys !== null && r.incremental_cost !== null)
        .map((r, i) => ({
          x: r.incremental_qalys!,
          y: r.incremental_cost!,
          label: r.scenario?.name ?? `Scenario ${r.scenario_id}`,
          icer: r.icer,
          nmb: r.net_monetary_benefit,
          color: POINT_COLORS[i % POINT_COLORS.length],
        })),
    [results],
  );

  if (points.length === 0) {
    return (
      <ChartCard title="Cost-Effectiveness Plane" subtitle="No incremental results available">
        <div className="h-64 flex items-center justify-center text-sm text-[#5A5650]">
          Run the analysis with intervention scenarios to see the CE plane.
        </div>
      </ChartCard>
    );
  }

  // Compute axis bounds with padding
  const allX = points.map((p) => p.x);
  const allY = points.map((p) => p.y);
  const maxAbsX = Math.max(Math.abs(Math.min(...allX)), Math.abs(Math.max(...allX)), 0.1);
  const maxAbsY = Math.max(Math.abs(Math.min(...allY)), Math.abs(Math.max(...allY)), 100);
  const padX = maxAbsX * 1.4;
  const padY = maxAbsY * 1.4;

  // SVG dimensions
  const W = 560;
  const H = 400;
  const margin = { top: 24, right: 24, bottom: 44, left: 64 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;

  const scaleX = (v: number) => margin.left + ((v + padX) / (2 * padX)) * plotW;
  const scaleY = (v: number) => margin.top + ((padY - v) / (2 * padY)) * plotH;

  // WTP line: y = wtp * x (from bottom-left to top-right of visible area)
  const wtpX1 = -padX;
  const wtpX2 = padX;

  // Clip WTP line to visible area
  const clipWtpY = (x: number) => Math.max(-padY, Math.min(padY, wtp * x));

  // Axis tick generation
  const makeAxisTicks = (maxAbs: number, count: number) => {
    const step = maxAbs / (count / 2);
    const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
    const normalized = step / magnitude;
    const niceStep =
      normalized <= 1 ? magnitude : normalized <= 2 ? 2 * magnitude : normalized <= 5 ? 5 * magnitude : 10 * magnitude;
    const ticks: number[] = [];
    for (let v = -Math.ceil(maxAbs / niceStep) * niceStep; v <= maxAbs * 1.1; v += niceStep) {
      if (Math.abs(v) < niceStep * 0.01) {
        ticks.push(0);
      } else {
        ticks.push(v);
      }
    }
    return [...new Set(ticks)].filter((v) => v >= -maxAbs * 1.3 && v <= maxAbs * 1.3);
  };

  const xTicks = makeAxisTicks(padX, 6);
  const yTicks = makeAxisTicks(padY, 6);

  return (
    <ChartCard
      title="Cost-Effectiveness Plane"
      subtitle={`WTP threshold: $${wtp.toLocaleString()}/QALY`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Cost-effectiveness plane scatter plot">
        {/* Quadrant fills */}
        <rect x={scaleX(0)} y={margin.top} width={scaleX(padX) - scaleX(0)} height={scaleY(0) - margin.top} fill="#2DD4BF" opacity={0.03} />
        <rect x={margin.left} y={margin.top} width={scaleX(0) - margin.left} height={scaleY(0) - margin.top} fill="#E85A6B" opacity={0.04} />
        <rect x={scaleX(0)} y={scaleY(0)} width={scaleX(padX) - scaleX(0)} height={margin.top + plotH - scaleY(0)} fill="#2DD4BF" opacity={0.06} />
        <rect x={margin.left} y={scaleY(0)} width={scaleX(0) - margin.left} height={margin.top + plotH - scaleY(0)} fill="#C9A227" opacity={0.03} />

        {/* Grid lines */}
        {xTicks.map((v) => (
          <line
            key={`gx-${v}`}
            x1={scaleX(v)}
            y1={margin.top}
            x2={scaleX(v)}
            y2={margin.top + plotH}
            stroke={CHART.grid}
            strokeWidth={v === 0 ? 1.5 : 0.5}
            strokeDasharray={v === 0 ? undefined : "3,3"}
          />
        ))}
        {yTicks.map((v) => (
          <line
            key={`gy-${v}`}
            x1={margin.left}
            y1={scaleY(v)}
            x2={margin.left + plotW}
            y2={scaleY(v)}
            stroke={CHART.grid}
            strokeWidth={v === 0 ? 1.5 : 0.5}
            strokeDasharray={v === 0 ? undefined : "3,3"}
          />
        ))}

        {/* WTP threshold line */}
        <line
          x1={scaleX(wtpX1)}
          y1={scaleY(clipWtpY(wtpX1))}
          x2={scaleX(wtpX2)}
          y2={scaleY(clipWtpY(wtpX2))}
          stroke={CHART.gold}
          strokeWidth={1.5}
          strokeDasharray="6,4"
          opacity={0.7}
        />
        <text
          x={scaleX(padX * 0.6)}
          y={scaleY(clipWtpY(padX * 0.6)) - 8}
          fill={CHART.gold}
          fontSize={10}
          fontWeight={500}
          opacity={0.8}
        >
          WTP = ${formatCompact(wtp)}/QALY
        </text>

        {/* Quadrant labels */}
        <text x={scaleX(padX * 0.5)} y={scaleY(padY * 0.85)} fill={CHART.textDim} fontSize={9} textAnchor="middle">
          {QUADRANTS.ne.sub}
        </text>
        <text x={scaleX(-padX * 0.5)} y={scaleY(padY * 0.85)} fill={CHART.textDim} fontSize={9} textAnchor="middle">
          {QUADRANTS.nw.sub}
        </text>
        <text x={scaleX(padX * 0.5)} y={scaleY(-padY * 0.85)} fill={CHART.textDim} fontSize={9} textAnchor="middle">
          {QUADRANTS.se.sub}
        </text>
        <text x={scaleX(-padX * 0.5)} y={scaleY(-padY * 0.85)} fill={CHART.textDim} fontSize={9} textAnchor="middle">
          {QUADRANTS.sw.sub}
        </text>

        {/* Axis labels */}
        <text x={margin.left + plotW / 2} y={H - 4} fill={CHART.textSec} fontSize={11} textAnchor="middle" fontWeight={500}>
          Incremental QALYs (ΔE)
        </text>
        <text
          x={14}
          y={margin.top + plotH / 2}
          fill={CHART.textSec}
          fontSize={11}
          textAnchor="middle"
          fontWeight={500}
          transform={`rotate(-90, 14, ${margin.top + plotH / 2})`}
        >
          Incremental Cost (ΔC)
        </text>

        {/* Axis tick labels */}
        {xTicks.filter((v) => v !== 0).map((v) => (
          <text key={`xl-${v}`} x={scaleX(v)} y={margin.top + plotH + 16} fill={CHART.textDim} fontSize={9} textAnchor="middle">
            {formatCompact(v)}
          </text>
        ))}
        {yTicks.filter((v) => v !== 0).map((v) => (
          <text key={`yl-${v}`} x={margin.left - 8} y={scaleY(v) + 3} fill={CHART.textDim} fontSize={9} textAnchor="end">
            ${formatCompact(v)}
          </text>
        ))}

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Glow */}
            <circle cx={scaleX(p.x)} cy={scaleY(p.y)} r={10} fill={p.color} opacity={0.15} />
            {/* Point */}
            <circle cx={scaleX(p.x)} cy={scaleY(p.y)} r={6} fill={p.color} stroke={CHART.bg} strokeWidth={2} />
            {/* Label */}
            <text
              x={scaleX(p.x) + 10}
              y={scaleY(p.y) - 10}
              fill={CHART.text}
              fontSize={10}
              fontWeight={500}
            >
              {p.label}
            </text>
            {p.icer !== null && (
              <text
                x={scaleX(p.x) + 10}
                y={scaleY(p.y) + 2}
                fill={CHART.textMuted}
                fontSize={9}
              >
                ICER: ${formatCompact(p.icer)}/QALY
              </text>
            )}
          </g>
        ))}

        {/* Origin label */}
        <text x={scaleX(0) + 4} y={scaleY(0) - 4} fill={CHART.textDim} fontSize={9}>
          Origin
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 px-1">
        {points.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-[#C5C0B8]">{p.label}</span>
            {p.nmb !== null && (
              <span className={`font-mono text-[10px] ${p.nmb >= 0 ? "text-[#2DD4BF]" : "text-[#E85A6B]"}`}>
                NMB: ${formatCompact(p.nmb)}
              </span>
            )}
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
