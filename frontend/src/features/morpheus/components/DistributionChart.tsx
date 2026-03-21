import { useRef, useState, useEffect } from 'react';

interface DistItem {
  label: string;
  value: number;
}

interface DistributionChartProps {
  data: DistItem[];
  barColor?: string;
  title?: string;
}

export default function DistributionChart({ data, barColor = '#2DD4BF', title }: DistributionChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; item: DistItem } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (!data.length) return <div className="text-[#5A5650] text-sm py-8 text-center">No data</div>;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const padL = 8;
  const padR = 8;
  const padT = 8;
  const padB = 28;
  const chartH = 140;
  const svgH = chartH + padT + padB;
  const chartW = width - padL - padR;
  const barW = Math.max(8, Math.min(36, (chartW / data.length) - 4));
  const totalBarSpace = barW * data.length;
  const gap = data.length > 1 ? (chartW - totalBarSpace) / (data.length - 1) : 0;

  return (
    <div ref={containerRef} className="relative">
      {title && <h3 className="text-xs font-semibold text-[#C5C0B8] mb-3">{title}</h3>}
      <svg width={width} height={svgH}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <line key={pct} x1={padL} y1={padT + chartH * (1 - pct)} x2={width - padR} y2={padT + chartH * (1 - pct)}
            stroke="#1F1F24" strokeWidth={1} />
        ))}

        {data.map((d, i) => {
          const barH = Math.max(2, (d.value / maxVal) * chartH);
          const x = padL + i * (barW + gap);
          const y = padT + chartH - barH;
          return (
            <g key={i}
              onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, item: d })}
              onMouseLeave={() => setTooltip(null)}
              className="cursor-pointer"
            >
              <rect x={x} y={y} width={barW} height={barH} rx={2} fill={barColor}
                opacity={0.8} className="transition-opacity hover:opacity-100" />
              {/* Value above bar */}
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill="#8A857D" fontSize={9} fontWeight={500}>
                {d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : d.value}
              </text>
              {/* X label */}
              <text x={x + barW / 2} y={padT + chartH + 14} textAnchor="middle" fill="#5A5650" fontSize={8}>
                {d.label}
              </text>
            </g>
          );
        })}

        <line x1={padL} y1={padT + chartH} x2={width - padR} y2={padT + chartH} stroke="#323238" strokeWidth={1} />
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 rounded-lg border border-[#323238] bg-[#1A1A1E] px-3 py-2 text-xs text-[#C5C0B8] shadow-xl pointer-events-none"
          style={{ top: tooltip.y - 50, left: tooltip.x + 12 }}
        >
          <div className="font-medium text-[#F0EDE8]">{tooltip.item.label}</div>
          <div>Count: {tooltip.item.value.toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}
