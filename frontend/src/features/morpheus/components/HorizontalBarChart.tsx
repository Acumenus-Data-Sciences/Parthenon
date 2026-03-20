interface BarItem {
  label: string;
  value: number;
  sublabel?: string;
}

interface HorizontalBarChartProps {
  data: BarItem[];
  maxItems?: number;
  barColor?: string;
  title?: string;
}

export default function HorizontalBarChart({ data, maxItems = 10, barColor = '#2DD4BF', title }: HorizontalBarChartProps) {
  const items = data.slice(0, maxItems);
  const maxVal = Math.max(...items.map(d => d.value), 1);

  if (!items.length) return <div className="text-gray-500 text-sm p-4">No data</div>;

  return (
    <div className="rounded-lg border border-gray-800 bg-[#1A1A2E] p-4">
      {title && <h3 className="text-sm font-medium text-gray-300 mb-3">{title}</h3>}
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 h-6">
            <div className="w-36 truncate text-[11px] text-gray-400 text-right shrink-0" title={item.label}>
              {item.sublabel ? (
                <><span className="font-mono text-[#C9A227]">{item.sublabel}</span>{' '}<span>{item.label}</span></>
              ) : item.label}
            </div>
            <div className="flex-1 h-4 bg-[#0E0E11] rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all duration-300"
                style={{ width: `${(item.value / maxVal) * 100}%`, backgroundColor: barColor }}
              />
            </div>
            <span className="text-[11px] text-gray-300 w-10 text-right shrink-0 font-medium">
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
