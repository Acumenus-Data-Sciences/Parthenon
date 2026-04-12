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
  "var(--success)", "var(--accent)", "var(--primary)", "#7c8aed", "var(--critical)",
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
          <div key={d.name} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-overlay">
            {/* Vocabulary name */}
            <div className="flex w-32 shrink-0 items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="truncate text-xs text-text-secondary" title={d.name}>
                {d.name}
              </span>
            </div>

            {/* Bar */}
            <div className="relative flex-1">
              <div className="h-5 w-full rounded bg-surface-base">
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
              <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-secondary">
                {formatCompact(d.value)}
              </span>
              <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-text-ghost">
                {d.code_count.toLocaleString()} codes
              </span>
              <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-text-ghost">
                {pct.toFixed(1)}%
              </span>
            </div>
          </div>
        );
      })}

      {/* Total row */}
      {sorted.length > 1 && (
        <div className="mt-1 flex items-center gap-3 border-t border-border-default px-2 pt-3">
          <div className="w-32 shrink-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Total
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex w-40 shrink-0 items-baseline justify-end gap-3">
            <span className="font-['IBM_Plex_Mono',monospace] text-xs font-semibold text-text-primary">
              {formatCompact(total)}
            </span>
            <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-text-ghost">
              {sorted.reduce((s, d) => s + d.code_count, 0).toLocaleString()} codes
            </span>
            <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-text-ghost">
              100%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
