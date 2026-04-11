import { useState } from 'react';

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

export default function HorizontalBarChart({ data, maxItems = 10, barColor = 'var(--success)', title }: HorizontalBarChartProps) {
  const items = data.slice(0, maxItems);
  const maxVal = Math.max(...items.map(d => d.value), 1);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!items.length) return <div className="text-text-ghost text-sm py-8 text-center">No data</div>;

  return (
    <div>
      {title && <h3 className="text-xs font-semibold text-text-secondary mb-3">{title}</h3>}
      <div className="space-y-1">
        {items.map((item, i) => {
          const pct = (item.value / maxVal) * 100;
          const isHovered = hoverIdx === i;
          return (
            <div
              key={i}
              className="flex items-center gap-2 group py-0.5"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <div className="w-[200px] shrink-0 text-right pr-2 leading-tight">
                <span className="text-[11px] text-text-secondary block truncate" title={item.label}>
                  {item.label}
                </span>
                {item.sublabel && (
                  <span className="text-[9px] text-text-ghost block">{item.sublabel}</span>
                )}
              </div>
              <div className="flex-1 h-[18px] bg-surface-base rounded overflow-hidden relative">
                <div
                  className="h-full rounded transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: barColor,
                    opacity: isHovered ? 1 : 0.75,
                  }}
                />
              </div>
              <span className="text-[11px] font-medium text-text-primary w-12 text-right shrink-0 tabular-nums">
                {item.value.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
