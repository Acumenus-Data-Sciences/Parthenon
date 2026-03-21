import { useState } from 'react';

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSegment[];
  title?: string;
  size?: number;
}

export default function DonutChart({ data, title, size = 140 }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!total) return <div className="text-[#5A5650] text-sm py-8 text-center">No data</div>;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 4;
  const innerRadius = radius * 0.6;

  let startAngle = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const ix1 = cx + innerRadius * Math.cos(endAngle);
    const iy1 = cy + innerRadius * Math.sin(endAngle);
    const ix2 = cx + innerRadius * Math.cos(startAngle);
    const iy2 = cy + innerRadius * Math.sin(startAngle);

    const path = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ');

    startAngle = endAngle;
    return { ...d, path, index: i };
  });

  return (
    <div>
      {title && <h3 className="text-xs font-semibold text-[#C5C0B8] mb-3">{title}</h3>}
      <div className="flex items-center gap-5">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {arcs.map((arc) => (
            <path
              key={arc.index}
              d={arc.path}
              fill={arc.color}
              stroke="#0E0E11"
              strokeWidth={2}
              opacity={hoverIdx === null || hoverIdx === arc.index ? 1 : 0.4}
              onMouseEnter={() => setHoverIdx(arc.index)}
              onMouseLeave={() => setHoverIdx(null)}
              className="transition-opacity duration-150 cursor-pointer"
            />
          ))}
          <text x={cx} y={cy - 2} textAnchor="middle" fill="#F0EDE8" fontSize={20} fontWeight="bold">
            {total.toLocaleString()}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="#5A5650" fontSize={9}>
            patients
          </text>
        </svg>
        <div className="flex flex-col gap-2">
          {data.map((d, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 transition-opacity ${hoverIdx !== null && hoverIdx !== i ? 'opacity-40' : ''}`}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-xs text-[#C5C0B8] font-medium">{d.label}</span>
              <span className="text-xs text-[#5A5650] tabular-nums">{d.value.toLocaleString()} ({Math.round(d.value / total * 100)}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
