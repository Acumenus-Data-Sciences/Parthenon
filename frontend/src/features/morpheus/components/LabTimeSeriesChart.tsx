// frontend/src/features/morpheus/components/LabTimeSeriesChart.tsx
import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface DataPoint {
  date: string;
  value: number;
}

interface LabTimeSeriesChartProps {
  data: DataPoint[];
  rangeLow: number | null;
  rangeHigh: number | null;
  unit: string;
  color?: string;
  /** Optional second series for overlay */
  overlayData?: DataPoint[];
  overlayLabel?: string;
  overlayColor?: string;
}

export default function LabTimeSeriesChart({
  data, rangeLow, rangeHigh, unit, color = '#818CF8',
  overlayData, overlayLabel, overlayColor = '#2DD4BF',
}: LabTimeSeriesChartProps) {
  const { t } = useTranslation('app');
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const sorted = useMemo(() =>
    [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [data],
  );

  const height = 200;
  const padX = 50;
  const padY = 24;
  const chartW = (containerWidth - 2 * padX) * zoom;
  const chartH = height - 2 * padY;

  const allValues = sorted.map((d) => d.value).concat(overlayData?.map((d) => d.value) ?? []);
  const minVal = Math.min(...allValues, rangeLow ?? Infinity);
  const maxVal = Math.max(...allValues, rangeHigh ?? -Infinity);
  const valRange = maxVal - minVal || 1;

  const timeMin = sorted.length > 0 ? new Date(sorted[0].date).getTime() : 0;
  const timeMax = sorted.length > 0 ? new Date(sorted[sorted.length - 1].date).getTime() : 1;
  const timeRange = timeMax - timeMin || 1;

  const toX = (date: string) => padX + ((new Date(date).getTime() - timeMin) / timeRange) * chartW - panOffset;
  const toY = (val: number) => padY + (1 - (val - minVal) / valRange) * chartH;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setPanOffset((p) => Math.max(0, p - 40));
    if (e.key === 'ArrowRight') setPanOffset((p) => p + 40);
    if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(10, z * 1.2));
    if (e.key === '-') setZoom((z) => Math.max(0.5, z / 1.2));
  }, []);

  const primaryPoints = sorted.map((d) => `${toX(d.date)},${toY(d.value)}`).join(' ');

  return (
    <div ref={containerRef} className="w-full" tabIndex={0} onKeyDown={handleKeyDown}>
      <svg width={containerWidth} height={height} className="overflow-visible">
        {/* Reference range band */}
        {rangeLow != null && rangeHigh != null && (
          <rect
            x={padX}
            y={toY(rangeHigh)}
            width={chartW}
            height={Math.max(0, toY(rangeLow) - toY(rangeHigh))}
            fill="var(--success)"
            opacity={0.08}
          />
        )}

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line key={frac} x1={padX} x2={padX + chartW} y1={padY + frac * chartH} y2={padY + frac * chartH}
            stroke="var(--surface-highlight)" strokeWidth={0.5} />
        ))}

        {/* Primary series */}
        <polyline points={primaryPoints} fill="none" stroke={color} strokeWidth={2} />
        {sorted.map((d, i) => (
          <circle
            key={i}
            cx={toX(d.date)}
            cy={toY(d.value)}
            r={hoverIdx === i ? 5 : 3}
            fill={hoverIdx === i ? '#F0EDE8' : color}
            stroke={color}
            strokeWidth={1}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            className="cursor-pointer"
          />
        ))}

        {/* Overlay series */}
        {overlayData && overlayData.length > 1 && (
          <>
            <polyline
              points={[...overlayData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((d) => `${toX(d.date)},${toY(d.value)}`).join(' ')}
              fill="none"
              stroke={overlayColor}
              strokeWidth={1.5}
              strokeDasharray="4,4"
            />
          </>
        )}

        {/* Hover tooltip */}
        {hoverIdx != null && sorted[hoverIdx] && (
          <g>
            <rect x={toX(sorted[hoverIdx].date) - 40} y={toY(sorted[hoverIdx].value) - 32}
              width={80} height={24} rx={4} fill="var(--surface-overlay)" stroke="var(--surface-highlight)" />
            <text x={toX(sorted[hoverIdx].date)} y={toY(sorted[hoverIdx].value) - 16}
              textAnchor="middle" fill="var(--text-secondary)" fontSize={10}>
              {sorted[hoverIdx].value} {unit}
            </text>
          </g>
        )}

        {/* Y axis labels */}
        {[0, 0.5, 1].map((frac) => {
          const val = minVal + frac * valRange;
          return (
            <text key={frac} x={padX - 8} y={padY + (1 - frac) * chartH + 4}
              textAnchor="end" fill="var(--text-ghost)" fontSize={9}>
              {val.toFixed(1)}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      {overlayData && overlayLabel && (
        <div className="flex items-center gap-4 mt-1 text-[10px] text-text-muted">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: color }} /> {t('morpheus.common.values.primary')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block border-t border-dashed" style={{ borderColor: overlayColor }} /> {overlayLabel}
          </span>
        </div>
      )}
    </div>
  );
}
