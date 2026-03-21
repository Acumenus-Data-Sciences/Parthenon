interface DistItem {
  label: string;
  value: number;
}

interface DistributionChartProps {
  data: DistItem[];
  barColor?: string;
  title?: string;
  height?: number;
}

export default function DistributionChart({ data, barColor = '#2DD4BF', title, height = 160 }: DistributionChartProps) {
  if (!data.length) return <div className="text-zinc-500 text-sm p-5">No data</div>;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.min(40, Math.floor(280 / data.length));
  const gap = 4;
  const svgWidth = data.length * (barWidth + gap) + 40;
  const chartHeight = height - 30;

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#151518] p-5">
      {title && <h3 className="text-sm font-semibold text-zinc-300 mb-4">{title}</h3>}
      <svg width="100%" viewBox={`0 0 ${svgWidth} ${height}`} className="overflow-visible">
        {data.map((d, i) => {
          const barH = (d.value / maxVal) * chartHeight;
          const x = i * (barWidth + gap) + 20;
          const y = chartHeight - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={barH} rx={2} fill={barColor} opacity={0.85} />
              <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" className="text-[9px]" fill="#8A857D">
                {d.value}
              </text>
              <text x={x + barWidth / 2} y={chartHeight + 14} textAnchor="middle" className="text-[9px]" fill="#8A857D">
                {d.label}
              </text>
            </g>
          );
        })}
        <line x1={16} y1={chartHeight} x2={svgWidth - 4} y2={chartHeight} stroke="#2A2A30" strokeWidth={1} />
      </svg>
    </div>
  );
}
