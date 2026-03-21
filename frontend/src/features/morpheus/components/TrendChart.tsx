import HoverCard from './HoverCard';

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
  height?: number;
}

export default function TrendChart({
  data, barColor = '#2DD4BF', lineColor = '#E85A6B',
  title, barLabel, lineLabel, height = 180,
}: TrendChartProps) {
  if (!data.length) return <div className="text-zinc-500 text-sm p-5">No data</div>;

  const maxBar = Math.max(...data.map(d => d.barValue), 1);
  const hasLine = data.some(d => d.lineValue !== undefined);
  const maxLine = hasLine ? Math.max(...data.map(d => d.lineValue ?? 0), 1) : 0;

  const barWidth = Math.min(30, Math.floor(400 / data.length));
  const gap = 6;
  const marginLeft = 30;
  const marginRight = hasLine ? 30 : 10;
  const svgWidth = data.length * (barWidth + gap) + marginLeft + marginRight;
  const chartHeight = height - 40;

  const linePath = hasLine ? data.map((d, i) => {
    const x = marginLeft + i * (barWidth + gap) + barWidth / 2;
    const y = chartHeight - ((d.lineValue ?? 0) / maxLine) * chartHeight;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ') : '';

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#151518] p-5">
      {title && <h3 className="text-sm font-semibold text-zinc-300 mb-4">{title}</h3>}
      <svg width="100%" viewBox={`0 0 ${svgWidth} ${height}`} className="overflow-visible">
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <line key={pct} x1={marginLeft - 4} y1={chartHeight - chartHeight * pct}
                x2={svgWidth - marginRight} y2={chartHeight - chartHeight * pct}
                stroke="#2A2A30" strokeWidth={0.5} />
        ))}

        {data.map((d, i) => {
          const barH = (d.barValue / maxBar) * chartHeight;
          const x = marginLeft + i * (barWidth + gap);
          const y = chartHeight - barH;
          return (
            <g key={i}>
              <HoverCard content={
                <div>
                  <div className="font-medium text-[#F0EDE8]">{d.label}</div>
                  <div>{barLabel ?? 'Value'}: {d.barValue.toLocaleString()}</div>
                  {d.lineValue !== undefined && <div>{lineLabel ?? 'Rate'}: {d.lineValue.toFixed(1)}%</div>}
                </div>
              }>
                <rect x={x} y={y} width={barWidth} height={barH} rx={2} fill={barColor} className="transition-opacity opacity-70 hover:opacity-100" />
              </HoverCard>
              {(i % Math.max(1, Math.floor(data.length / 8)) === 0) && (
                <text x={x + barWidth / 2} y={chartHeight + 14} textAnchor="middle" className="text-[8px]" fill="#8A857D">
                  {d.label.slice(2)}
                </text>
              )}
            </g>
          );
        })}

        {hasLine && linePath && (
          <>
            <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" />
            {data.map((d, i) => {
              if (d.lineValue === undefined) return null;
              const x = marginLeft + i * (barWidth + gap) + barWidth / 2;
              const y = chartHeight - (d.lineValue / maxLine) * chartHeight;
              return <circle key={i} cx={x} cy={y} r={2.5} fill={lineColor} />;
            })}
          </>
        )}

        <line x1={marginLeft - 4} y1={chartHeight} x2={svgWidth - marginRight} y2={chartHeight} stroke="#2A2A30" strokeWidth={1} />

        {barLabel && (
          <text x={4} y={chartHeight / 2} textAnchor="middle" transform={`rotate(-90, 8, ${chartHeight / 2})`}
                className="text-[8px]" fill="#8A857D">{barLabel}</text>
        )}
      </svg>

      <div className="flex items-center gap-4 mt-2 text-[10px] text-zinc-500">
        {barLabel && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: barColor }} /> {barLabel}</span>}
        {lineLabel && hasLine && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: lineColor }} /> {lineLabel}</span>}
      </div>
    </div>
  );
}
