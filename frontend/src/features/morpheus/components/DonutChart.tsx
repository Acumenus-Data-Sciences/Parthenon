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

export default function DonutChart({ data, title, size = 120 }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (!total) return <div className="text-zinc-500 text-sm p-5">No data</div>;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 8;
  const innerRadius = radius * 0.6;

  let startAngle = -Math.PI / 2;
  const arcs = data.map((d) => {
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
    return { ...d, path };
  });

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#151518] p-5">
      {title && <h3 className="text-sm font-semibold text-zinc-300 mb-4">{title}</h3>}
      <div className="flex items-center gap-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {arcs.map((arc, i) => (
            <path key={i} d={arc.path} fill={arc.color} stroke="#151518" strokeWidth={1.5} />
          ))}
          <text x={cx} y={cy - 4} textAnchor="middle" className="text-lg font-bold" fill="#F0EDE8">{total}</text>
          <text x={cx} y={cy + 10} textAnchor="middle" className="text-[9px]" fill="#8A857D">total</text>
        </svg>
        <div className="flex flex-col gap-1.5">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-xs text-zinc-300">{d.label}</span>
              <span className="text-xs text-zinc-500">{d.value} ({Math.round(d.value / total * 100)}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
