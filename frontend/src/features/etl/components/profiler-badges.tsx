import { cn } from "@/lib/utils";
import { nullPct as computeNullPct, scoreToGrade } from "../lib/profiler-utils";
import type { ColumnProfile } from "../api";

// ---------------------------------------------------------------------------
// Column type badge
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  varchar: { bg: "rgba(96,165,250,0.15)", text: "#60A5FA" },
  text: { bg: "rgba(96,165,250,0.15)", text: "#60A5FA" },
  integer: { bg: "rgba(45,212,191,0.15)", text: "#2DD4BF" },
  int: { bg: "rgba(45,212,191,0.15)", text: "#2DD4BF" },
  bigint: { bg: "rgba(45,212,191,0.15)", text: "#2DD4BF" },
  numeric: { bg: "rgba(201,162,39,0.15)", text: "#C9A227" },
  float: { bg: "rgba(201,162,39,0.15)", text: "#C9A227" },
  double: { bg: "rgba(201,162,39,0.15)", text: "#C9A227" },
  decimal: { bg: "rgba(201,162,39,0.15)", text: "#C9A227" },
  date: { bg: "rgba(167,139,250,0.15)", text: "#A78BFA" },
  datetime: { bg: "rgba(167,139,250,0.15)", text: "#A78BFA" },
  timestamp: { bg: "rgba(167,139,250,0.15)", text: "#A78BFA" },
  boolean: { bg: "rgba(251,146,60,0.15)", text: "#FB923C" },
  bool: { bg: "rgba(251,146,60,0.15)", text: "#FB923C" },
};

export function TypeBadge({ type }: { type: string }) {
  const lc = type.toLowerCase().replace(/\s*\(.*\)/, "");
  const colors = TYPE_COLORS[lc] ?? { bg: "#2A2A30", text: "#8A857D" };
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
      <div className="w-20 h-1.5 rounded-full bg-[#232328] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: isHigh ? "#E85A6B" : pct > 20 ? "#C9A227" : "#2DD4BF",
          }}
        />
      </div>
      <span
        className={cn(
          "text-xs tabular-nums w-8 text-right",
          isHigh ? "text-[#E85A6B]" : "text-[#8A857D]",
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
  if (!values) return <span className="text-[#5A5650] text-xs">-</span>;
  const entries = Object.entries(values)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([v, cnt]) => (
        <span
          key={v}
          className="inline-block px-1.5 py-0.5 rounded bg-[#232328] text-[#8A857D] text-[11px]"
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
