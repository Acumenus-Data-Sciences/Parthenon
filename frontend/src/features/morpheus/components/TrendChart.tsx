import { useMemo, useRef, useState, useEffect } from 'react';

interface TrendItem {
  label: string;
  barValue: number;
  lineValue?: number;
}

interface TrendChartProps {
  data: TrendItem[];
  barColor?: string;
  lineColor?: string;
  title?: string;
  barLabel?: string;
  lineLabel?: string;
}

export default function TrendChart({
  data, barColor = '#2DD4BF', lineColor = '#E85A6B',
  title, barLabel, lineLabel,
}: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; item: TrendItem } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (!data.length) return <div className="text-[#5A5650] text-sm py-8 text-center">No trend data</div>;

  const hasLine = data.some(d => d.lineValue !== undefined);
  const maxBar = Math.max(...data.map(d => d.barValue), 1);
  const maxLine = hasLine ? Math.max(...data.map(d => d.lineValue ?? 0), 1) : 0;

  const padL = 40;
  const padR = hasLine ? 40 : 16;
  const padT = 8;
  const padB = 28;
  const chartH = 160;
  const svgH = chartH + padT + padB;
  const chartW = width - padL - padR;
  const barW = Math.max(4, Math.min(24, chartW / data.length - 3));
  const gap = (chartW - barW * data.length) / Math.max(1, data.length - 1);

  const yTicks = useMemo(() => {
    const step = Math.ceil(maxBar / 4);
    return [0, step, step * 2, step * 3, step * 4].filter(v => v <= maxBar * 1.1);
  }, [maxBar]);

  const linePath = hasLine ? data.map((d, i) => {
    const x = padL + i * (barW + gap) + barW / 2;
    const y = padT + chartH - ((d.lineValue ?? 0) / maxLine) * chartH;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ') : '';

  return (
    <div ref={containerRef} className="relative">
      {title && <h3 className="text-xs font-semibold text-[#C5C0B8] mb-3">{title}</h3>}
      <svg width={width} height={svgH}>
        {/* Y grid lines + labels */}
        {yTicks.map((v) => {
          const y = padT + chartH - (v / maxBar) * chartH;
          return (
            <g key={v}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#1F1F24" strokeWidth={1} />
              <text x={padL - 6} y={y + 3} textAnchor="end" fill="#5A5650" fontSize={9}>{v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}</text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const barH = Math.max(1, (d.barValue / maxBar) * chartH);
          const x = padL + i * (barW + gap);
          const y = padT + chartH - barH;
          return (
            <g key={i}
              onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, item: d })}
              onMouseLeave={() => setTooltip(null)}
              className="cursor-pointer"
            >
              <rect x={x} y={y} width={barW} height={barH} rx={2} fill={barColor}
                opacity={0.85} className="transition-opacity hover:opacity-100" />
              {/* X label — show every Nth */}
              {(data.length <= 12 || i % Math.ceil(data.length / 8) === 0) && (
                <text x={x + barW / 2} y={padT + chartH + 14} textAnchor="middle" fill="#5A5650" fontSize={8}>
                  {data.length <= 12 ? d.label.slice(2) : d.label.slice(5)}
                </text>
              )}
            </g>
          );
        })}

        {/* Line overlay */}
        {hasLine && linePath && (
          <>
            <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" />
            {data.map((d, i) => {
              if (d.lineValue === undefined) return null;
              const x = padL + i * (barW + gap) + barW / 2;
              const y = padT + chartH - (d.lineValue / maxLine) * chartH;
              return <circle key={i} cx={x} cy={y} r={3} fill={lineColor} stroke="#0E0E11" strokeWidth={1.5} />;
            })}
            {/* Right Y axis for line */}
            {[0, 0.5, 1].map((pct) => {
              const v = maxLine * pct;
              const y = padT + chartH - pct * chartH;
              return <text key={pct} x={width - padR + 6} y={y + 3} textAnchor="start" fill={lineColor} fontSize={9}>{v.toFixed(0)}%</text>;
            })}
          </>
        )}

        {/* Baseline */}
        <line x1={padL} y1={padT + chartH} x2={width - padR} y2={padT + chartH} stroke="#323238" strokeWidth={1} />
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1 text-[10px] text-[#8A857D]">
        {barLabel && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: barColor }} /> {barLabel}</span>}
        {lineLabel && hasLine && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: lineColor }} /> {lineLabel}</span>}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 rounded-lg border border-[#323238] bg-[#1A1A1E] px-3 py-2 text-xs text-[#C5C0B8] shadow-xl pointer-events-none"
          style={{ top: tooltip.y - 60, left: tooltip.x + 12 }}
        >
          <div className="font-medium text-[#F0EDE8]">{tooltip.item.label}</div>
          <div>{barLabel ?? 'Value'}: {tooltip.item.barValue.toLocaleString()}</div>
          {tooltip.item.lineValue !== undefined && <div>{lineLabel ?? 'Rate'}: {tooltip.item.lineValue.toFixed(1)}%</div>}
        </div>
      )}
    </div>
  );
}
