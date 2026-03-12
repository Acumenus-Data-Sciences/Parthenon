import { useState, useCallback, useRef } from "react";
import type { CovariateBalanceEntry } from "../types/estimation";
import { fmt } from "@/lib/formatters";

interface LovePlotProps {
  data: CovariateBalanceEntry[];
  maxDisplay?: number;
  enableBrush?: boolean;
  onBrushSelect?: (covariates: CovariateBalanceEntry[]) => void;
}

// ---------------------------------------------------------------------------
// Density histogram helper
// ---------------------------------------------------------------------------

function computeHistogramBins(
  values: number[],
  binCount: number,
  min: number,
  max: number,
): number[] {
  const bins = new Array<number>(binCount).fill(0);
  const range = max - min;
  if (range === 0 || values.length === 0) return bins;

  for (const v of values) {
    const idx = Math.min(
      Math.floor(((v - min) / range) * binCount),
      binCount - 1,
    );
    bins[idx]++;
  }
  return bins;
}

export function LovePlot({
  data,
  maxDisplay = 200,
  enableBrush = false,
  onBrushSelect,
}: LovePlotProps) {
  const [brushStart, setBrushStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [brushEnd, setBrushEnd] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isBrushing, setIsBrushing] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Brush helpers — hooks must be called before any early return
  const getSvgPoint = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!enableBrush) return;
      const pt = getSvgPoint(e);
      setBrushStart(pt);
      setBrushEnd(pt);
      setIsBrushing(true);
    },
    [enableBrush, getSvgPoint],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isBrushing) return;
      setBrushEnd(getSvgPoint(e));
    },
    [isBrushing, getSvgPoint],
  );

  const handleMouseUp = useCallback(() => {
    if (!isBrushing || !brushStart || !brushEnd || !onBrushSelect) {
      setIsBrushing(false);
      setBrushStart(null);
      setBrushEnd(null);
      return;
    }

    // Recompute layout values inline so the hook doesn't depend on post-return variables
    const dd = data.slice(0, maxDisplay);
    const allSmds = dd.flatMap((d) => [Math.abs(d.smd_before), Math.abs(d.smd_after)]);
    const sMax = Math.ceil(Math.max(...allSmds, 0.15) * 10) / 10;
    const pLeft = 55;
    const pTop = 30;
    const pW = 600 - pLeft - 30;
    const pH = 400 + 30 - pTop - (50 + 30);
    const localToX = (smd: number) => pLeft + (Math.abs(smd) / sMax) * pW;
    const localToY = (index: number) => pTop + ((index + 0.5) / dd.length) * pH;

    const minX = Math.min(brushStart.x, brushEnd.x);
    const maxX = Math.max(brushStart.x, brushEnd.x);
    const minY = Math.min(brushStart.y, brushEnd.y);
    const maxY = Math.max(brushStart.y, brushEnd.y);

    // Filter points within brush rectangle
    const selected = dd.filter((_, i) => {
      const cx = localToX(dd[i].smd_after);
      const cy = localToY(i);
      return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
    });

    if (selected.length > 0) {
      onBrushSelect(selected);
    }

    setIsBrushing(false);
    setBrushStart(null);
    setBrushEnd(null);
  }, [isBrushing, brushStart, brushEnd, data, maxDisplay, onBrushSelect]);

  if (data.length === 0) return null;

  const DENSITY_HEIGHT = 30;
  const width = 600;
  const height = 400 + DENSITY_HEIGHT;
  const padding = { top: 30, right: 30, bottom: 50 + DENSITY_HEIGHT, left: 55 };
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

  const toX = (smd: number) =>
    padding.left + (Math.abs(smd) / scaleMax) * plotW;
  const toY = (index: number) =>
    padding.top + ((index + 0.5) / displayData.length) * plotH;

  const xTicks: number[] = [];
  for (let t = 0; t <= scaleMax; t += 0.1) {
    xTicks.push(Math.round(t * 10) / 10);
  }

  // Density marginal bins
  const BIN_COUNT = 20;
  const afterAbsSmds = displayData.map((d) => Math.abs(d.smd_after));
  const densityBins = computeHistogramBins(afterAbsSmds, BIN_COUNT, 0, scaleMax);
  const maxBinCount = Math.max(...densityBins, 1);
  const densityTop = padding.top + plotH + 20;
  const binWidth = plotW / BIN_COUNT;

  // Quadrant shading boundaries
  const x01 = toX(0.1);
  const x02 = toX(0.2);
  const plotLeft = padding.left;
  const plotRight = padding.left + plotW;
  const plotTop = padding.top;

  // Brush rectangle
  const brushRect =
    isBrushing && brushStart && brushEnd
      ? {
          x: Math.min(brushStart.x, brushEnd.x),
          y: Math.min(brushStart.y, brushEnd.y),
          width: Math.abs(brushEnd.x - brushStart.x),
          height: Math.abs(brushEnd.y - brushStart.y),
        }
      : null;

  return (
    <div className="overflow-x-auto">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-[#F0EDE8]"
        role="img"
        aria-label="Love plot showing covariate balance before and after matching"
        style={enableBrush ? { cursor: "crosshair" } : undefined}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <rect width={width} height={height} fill="#151518" rx={8} />

        {/* Quadrant shading */}
        {/* Green zone: |SMD| < 0.1 */}
        <rect
          x={plotLeft}
          y={plotTop}
          width={Math.min(x01, plotRight) - plotLeft}
          height={plotH}
          fill="rgba(45,212,191,0.04)"
        />
        {/* Amber zone: 0.1 <= |SMD| < 0.2 */}
        {x01 < plotRight && (
          <rect
            x={x01}
            y={plotTop}
            width={Math.min(x02, plotRight) - x01}
            height={plotH}
            fill="rgba(201,162,39,0.04)"
          />
        )}
        {/* Red zone: |SMD| >= 0.2 */}
        {x02 < plotRight && (
          <rect
            x={x02}
            y={plotTop}
            width={plotRight - x02}
            height={plotH}
            fill="rgba(232,90,107,0.04)"
          />
        )}

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

        {/* Density marginal histogram along x-axis */}
        <g data-testid="density-marginal">
          {densityBins.map((count, i) => {
            const barH = (count / maxBinCount) * DENSITY_HEIGHT;
            const barX = padding.left + i * binWidth;
            return (
              <rect
                key={i}
                x={barX}
                y={densityTop + DENSITY_HEIGHT - barH}
                width={binWidth - 1}
                height={barH}
                fill={AFTER_COLOR}
                opacity={0.35}
                rx={1}
              />
            );
          })}
        </g>

        {/* Brush selection rectangle */}
        {brushRect && (
          <rect
            x={brushRect.x}
            y={brushRect.y}
            width={brushRect.width}
            height={brushRect.height}
            fill="rgba(201,162,39,0.15)"
            stroke="#C9A227"
            strokeWidth={1}
            strokeDasharray="4 2"
            data-testid="brush-rect"
          />
        )}

        {/* Legend */}
        <g
          transform={`translate(${padding.left + plotW - 180}, ${padding.top + 8})`}
        >
          <rect
            x={0}
            y={0}
            width={170}
            height={42}
            rx={4}
            fill="#0E0E11"
            stroke="#232328"
            strokeWidth={1}
          />
          <circle
            cx={14}
            cy={14}
            r={3}
            fill="none"
            stroke={BEFORE_COLOR}
            strokeWidth={1.5}
          />
          <text x={24} y={18} fill="#C5C0B8" fontSize={10}>
            Before Matching
          </text>
          <circle cx={14} cy={32} r={3} fill={AFTER_COLOR} />
          <text x={24} y={36} fill="#C5C0B8" fontSize={10}>
            After Matching
          </text>
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
