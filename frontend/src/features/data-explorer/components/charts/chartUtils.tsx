import type { ReactNode } from "react";

// ── Number formatting ────────────────────────────────────────────────────────

/** Format large numbers compactly: 1005787 → "1.0M" */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Format YYYYMM or YYYY-MM to "Jan 2020" */
export function formatYearMonth(ym: string): string {
  const s = String(ym);
  const normalized = s.includes("-") ? s : `${s.slice(0, 4)}-${s.slice(4)}`;
  const [year, month] = normalized.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Convert table_name to Title Case with spaces */
export function formatTableName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Truncate long strings with ellipsis */
export function truncate(s: string, max = 40): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

// ── Color palettes ───────────────────────────────────────────────────────────

/** Colorblind-safe domain palette (Okabe-Ito inspired, tuned for dark theme) */
export const DOMAIN_COLORS: Record<string, string> = {
  condition: "#2DD4BF",
  drug: "#C9A227",
  procedure: "#60A5FA",
  measurement: "#A855F7",
  observation: "#E5A84B",
  visit: "#E85A6B",
  death: "#8B5CF6",
  drug_era: "#34D399",
  condition_era: "#F472B6",
  person: "#F0EDE8",
  observation_period: "#94A3B8",
  Condition: "#2DD4BF",
  Drug: "#C9A227",
  Procedure: "#60A5FA",
  Measurement: "#A855F7",
  Observation: "#E5A84B",
  Visit: "#E85A6B",
};

export const GENDER_COLORS: Record<string, string> = {
  Male: "#60A5FA",
  Female: "#E85A6B",
  Unknown: "#8A857D",
  Ambiguous: "#5A5650",
};

/** Standard dark theme chart styling constants */
export const CHART = {
  bg: "#151518",
  bgDarker: "#0E0E11",
  border: "#232328",
  grid: "#323238",
  text: "#F0EDE8",
  textSec: "#C5C0B8",
  textMuted: "#8A857D",
  textDim: "#5A5650",
  accent: "#2DD4BF",
  gold: "#C9A227",
  crimson: "#E85A6B",
  blue: "#60A5FA",
} as const;

/** Standard tooltip container classes */
export const TOOLTIP_CLS =
  "rounded-lg border border-[#323238] bg-[#1A1A1E] px-3 py-2 shadow-lg";

// ── Map CDM table name → domain name ─────────────────────────────────────────

const TABLE_TO_DOMAIN: Record<string, string> = {
  condition_occurrence: "condition",
  condition_era: "condition",
  drug_exposure: "drug",
  drug_era: "drug",
  procedure_occurrence: "procedure",
  measurement: "measurement",
  observation: "observation",
  visit_occurrence: "visit",
  visit_detail: "visit",
  device_exposure: "measurement",
  note: "observation",
  specimen: "observation",
  death: "condition",
  person: "person",
  observation_period: "observation_period",
  payer_plan_period: "visit",
  cost: "visit",
};

export function tableToDomain(table: string): string {
  return TABLE_TO_DOMAIN[table] ?? "other";
}

// ── Shared wrapper ───────────────────────────────────────────────────────────

interface ChartCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, children, className }: ChartCardProps) {
  return (
    <div className={`rounded-xl border border-[#232328] bg-[#151518] p-6 ${className ?? ""}`}>
      {title && (
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#8A857D]">
          {title}
        </h3>
      )}
      {subtitle && (
        <p className="mb-4 text-xs text-[#5A5650]">{subtitle}</p>
      )}
      {!subtitle && title && <div className="mb-4" />}
      {children}
    </div>
  );
}
