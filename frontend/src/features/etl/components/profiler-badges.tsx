import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { scoreToGrade } from "../lib/profiler-utils";

// ---------------------------------------------------------------------------
// Column type badge
// ---------------------------------------------------------------------------

function cssVar(token: string): string {
  return `var(--${token})`;
}

function getTypeColors(type: string): { bg: string; text: string } {
  switch (type) {
    case "varchar":
    case "text":
      return { bg: "rgba(96,165,250,0.15)", text: cssVar("info") };
    case "integer":
    case "int":
    case "bigint":
      return { bg: "rgba(45,212,191,0.15)", text: cssVar("success") };
    case "numeric":
    case "float":
    case "double":
    case "decimal":
      return { bg: "rgba(201,162,39,0.15)", text: cssVar("accent") };
    case "date":
    case "datetime":
    case "timestamp":
      return { bg: "rgba(167,139,250,0.15)", text: cssVar("domain-observation") };
    case "boolean":
    case "bool":
      return { bg: "rgba(251,146,60,0.15)", text: cssVar("domain-device") };
    default:
      return { bg: cssVar("surface-accent"), text: cssVar("text-muted") };
  }
}

export function TypeBadge({ type }: { type: string }) {
  const lc = type.toLowerCase().replace(/\s*\(.*\)/, "");
  const colors = getTypeColors(lc);
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
  const { t } = useTranslation("app");

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
          title={t("etl.profiler.pii.sampleCountTitle", { count: cnt })}
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
