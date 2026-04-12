import { cn } from "@/lib/utils";
import { nullPct as computeNullPct, scoreToGrade } from "../lib/profiler-utils";

// ---------------------------------------------------------------------------
// Column type badge
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  varchar: { bg: "rgba(96,165,250,0.15)", text: "var(--info)" },
  text: { bg: "rgba(96,165,250,0.15)", text: "var(--info)" },
  integer: { bg: "rgba(45,212,191,0.15)", text: "var(--success)" },
  int: { bg: "rgba(45,212,191,0.15)", text: "var(--success)" },
  bigint: { bg: "rgba(45,212,191,0.15)", text: "var(--success)" },
  numeric: { bg: "rgba(201,162,39,0.15)", text: "var(--accent)" },
  float: { bg: "rgba(201,162,39,0.15)", text: "var(--accent)" },
  double: { bg: "rgba(201,162,39,0.15)", text: "var(--accent)" },
  decimal: { bg: "rgba(201,162,39,0.15)", text: "var(--accent)" },
  date: { bg: "rgba(167,139,250,0.15)", text: "var(--domain-observation)" },
  datetime: { bg: "rgba(167,139,250,0.15)", text: "var(--domain-observation)" },
  timestamp: { bg: "rgba(167,139,250,0.15)", text: "var(--domain-observation)" },
  boolean: { bg: "rgba(251,146,60,0.15)", text: "var(--domain-device)" },
  bool: { bg: "rgba(251,146,60,0.15)", text: "var(--domain-device)" },
};

export function TypeBadge({ type }: { type: string }) {
  const lc = type.toLowerCase().replace(/\s*\(.*\)/, "");
  const colors = TYPE_COLORS[lc] ?? { bg: "var(--surface-accent)", text: "var(--text-muted)" };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-medium"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Null-percent bar
// ---------------------------------------------------------------------------

export function NullBar({ pct }: { pct: number }) {
  const isHigh = pct > 50;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: isHigh ? "var(--critical)" : pct > 20 ? "var(--accent)" : "var(--success)",
          }}
        />
      </div>
      <span
        className={cn(
          "text-xs tabular-nums w-8 text-right",
          isHigh ? "text-critical" : "text-text-muted",
        )}
      >
        {pct}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sample values chips
// ---------------------------------------------------------------------------

export function SampleValues({ values }: { values?: Record<string, number> }) {
  if (!values) return <span className="text-text-ghost text-xs">-</span>;
  const entries = Object.entries(values)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([v, cnt]) => (
        <span
          key={v}
          className="inline-block px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted text-[11px]"
          title={`Count: ${cnt}`}
        >
          {v.length > 20 ? v.slice(0, 20) + "\u2026" : v}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grade badge component
// ---------------------------------------------------------------------------

export function GradeBadge({ score }: { score: number }) {
  const grade = scoreToGrade(score);
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold"
      style={{ backgroundColor: grade.bg, color: grade.color }}
    >
      {grade.letter}
    </span>
  );
}

// Re-export nullPct for convenience (used by TableAccordion)
export const nullPct = computeNullPct;
