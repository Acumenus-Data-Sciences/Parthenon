import type { MappingStats } from "@/types/ingestion";

interface ReviewStatsBarProps {
  stats: MappingStats;
  onSegmentClick?: (segment: string) => void;
}

const SEGMENTS: {
  key: keyof Pick<MappingStats, "auto_accepted" | "quick_review" | "full_review" | "unmappable">;
  label: string;
  color: string;
}[] = [
  { key: "auto_accepted", label: "Auto-Accepted", color: "var(--success)" },
  { key: "quick_review", label: "Quick Review", color: 'var(--warning)' },
  { key: "full_review", label: "Full Review", color: "var(--critical)" },
  { key: "unmappable", label: "Unmappable", color: "var(--text-ghost)" },
];

export function ReviewStatsBar({ stats, onSegmentClick }: ReviewStatsBarProps) {
  const total = stats.total || 1;

  return (
    <div className="space-y-3">
      {/* Progress info */}
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>
          <span className="text-text-primary font-medium tabular-nums">
            {stats.reviewed}
          </span>{" "}
          of{" "}
          <span className="text-text-secondary tabular-nums">{stats.total}</span>{" "}
          reviewed
        </span>
        <span className="tabular-nums">
          {stats.pending} pending
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-elevated">
        {SEGMENTS.map(({ key, color }) => {
          const count = stats[key];
          if (count <= 0) return null;
          const widthPct = (count / total) * 100;

          return (
            <div
              key={key}
              className="h-full transition-all duration-300"
              style={{
                width: `${widthPct}%`,
                backgroundColor: color,
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {SEGMENTS.map(({ key, label, color }) => (
          <div
            key={key}
            className="flex items-center gap-1.5 text-xs transition-colors hover:text-text-primary cursor-pointer"
            onClick={() => onSegmentClick?.(key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSegmentClick?.(key); }}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-text-muted">{label}</span>
            <span className="font-medium text-text-secondary tabular-nums font-['IBM_Plex_Mono',monospace]">
              {stats[key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
