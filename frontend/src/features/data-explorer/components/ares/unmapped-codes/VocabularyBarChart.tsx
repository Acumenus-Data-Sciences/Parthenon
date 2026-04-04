import { formatCompact } from "../../charts/chartUtils";

interface VocabularyItem {
  name: string;
  value: number;
  code_count: number;
}

interface VocabularyBarChartProps {
  data: VocabularyItem[];
}

const COLORS = [
  "#2DD4BF", "#C9A227", "#9B1B30", "#7c8aed", "#e85d75",
  "#4ade80", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4",
];

export default function VocabularyBarChart({ data }: VocabularyBarChartProps) {
  if (data.length === 0) return null;

  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, d) => s + d.value, 0);
  const max = sorted[0]?.value ?? 1;

  return (
    <div className="space-y-2.5">
      {sorted.map((d, i) => {
        const pct = total > 0 ? (d.value / total) * 100 : 0;
        const barWidth = (d.value / max) * 100;
        const color = COLORS[i % COLORS.length];

        return (
          <div key={d.name} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[#1A1A1E]">
            {/* Vocabulary name */}
            <div className="flex w-32 shrink-0 items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="truncate text-xs text-[#C5C0B8]" title={d.name}>
                {d.name}
              </span>
            </div>

            {/* Bar */}
            <div className="relative flex-1">
              <div className="h-5 w-full rounded bg-[#0E0E11]">
                <div
                  className="h-5 rounded transition-all duration-300"
                  style={{
                    width: `${Math.max(barWidth, 1.5)}%`,
                    backgroundColor: color,
                    opacity: 0.65,
                  }}
                />
              </div>
            </div>

            {/* Count + codes */}
            <div className="flex w-40 shrink-0 items-baseline justify-end gap-3">
              <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                {formatCompact(d.value)}
              </span>
              <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-[#5A5650]">
                {d.code_count.toLocaleString()} codes
              </span>
              <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-[#5A5650]">
                {pct.toFixed(1)}%
              </span>
            </div>
          </div>
        );
      })}

      {/* Total row */}
      {sorted.length > 1 && (
        <div className="mt-1 flex items-center gap-3 border-t border-[#232328] px-2 pt-3">
          <div className="w-32 shrink-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Total
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex w-40 shrink-0 items-baseline justify-end gap-3">
            <span className="font-['IBM_Plex_Mono',monospace] text-xs font-semibold text-[#F0EDE8]">
              {formatCompact(total)}
            </span>
            <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-[#5A5650]">
              {sorted.reduce((s, d) => s + d.code_count, 0).toLocaleString()} codes
            </span>
            <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-[#5A5650]">
              100%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
