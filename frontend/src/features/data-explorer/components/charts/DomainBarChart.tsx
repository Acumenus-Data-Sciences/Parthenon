import { formatCompact, DOMAIN_COLORS, CHART } from "./chartUtils";

interface DomainBarChartProps {
  data: { name: string; size: number; color: string }[];
  onDomainClick?: (domain: string) => void;
}

export function DomainBarChart({ data, onDomainClick }: DomainBarChartProps) {
  if (!data.length) return null;

  const sorted = [...data].sort((a, b) => b.size - a.size);
  const total = sorted.reduce((s, d) => s + d.size, 0);
  const max = sorted[0]?.size ?? 1;

  return (
    <div className="space-y-2.5">
      {sorted.map((d) => {
        const pct = total > 0 ? (d.size / total) * 100 : 0;
        const barWidth = (d.size / max) * 100;

        return (
          <div
            key={d.name}
            className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#1A1A1E]"
            onClick={() => onDomainClick?.(d.name.toLowerCase().replace(/ /g, "_"))}
            style={{ cursor: onDomainClick ? "pointer" : "default" }}
            role={onDomainClick ? "button" : undefined}
            tabIndex={onDomainClick ? 0 : undefined}
            onKeyDown={
              onDomainClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ")
                      onDomainClick(d.name.toLowerCase().replace(/ /g, "_"));
                  }
                : undefined
            }
          >
            {/* Domain label */}
            <div className="flex w-28 shrink-0 items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-xs font-medium text-[#C5C0B8] group-hover:text-[#F0EDE8]">
                {d.name}
              </span>
            </div>

            {/* Bar */}
            <div className="relative flex-1">
              <div className="h-6 w-full rounded bg-[#1E1E22]">
                <div
                  className="h-6 rounded transition-all duration-300"
                  style={{
                    width: `${Math.max(barWidth, 1.5)}%`,
                    backgroundColor: d.color,
                    opacity: 0.65,
                  }}
                />
              </div>
            </div>

            {/* Count + percentage */}
            <div className="flex w-28 shrink-0 items-baseline justify-end gap-2">
              <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                {formatCompact(d.size)}
              </span>
              <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-[#5A5650]">
                {pct.toFixed(1)}%
              </span>
            </div>
          </div>
        );
      })}

      {/* Total row */}
      <div className="mt-1 flex items-center gap-3 border-t border-[#232328] px-2 pt-3">
        <div className="w-28 shrink-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
            Total
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex w-28 shrink-0 items-baseline justify-end gap-2">
          <span className="font-['IBM_Plex_Mono',monospace] text-xs font-semibold text-[#F0EDE8]">
            {formatCompact(total)}
          </span>
          <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-[#5A5650]">
            100%
          </span>
        </div>
      </div>
    </div>
  );
}

export { DOMAIN_COLORS };
