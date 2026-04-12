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
  condition: "var(--success)",
  drug: "var(--accent)",
  procedure: "var(--info)",
  measurement: "#A855F7",
  observation: "var(--warning)",
  visit: "var(--critical)",
  death: "var(--domain-observation)",
  drug_era: "var(--success)",
  condition_era: "var(--domain-procedure)",
  person: "var(--text-primary)",
  observation_period: "var(--text-muted)",
  Condition: "var(--success)",
  Drug: "var(--accent)",
  Procedure: "var(--info)",
  Measurement: "#A855F7",
  Observation: "var(--warning)",
  Visit: "var(--critical)",
};

export const GENDER_COLORS: Record<string, string> = {
  Male: "var(--info)",
  Female: "var(--critical)",
  Unknown: "var(--text-muted)",
  Ambiguous: "var(--text-ghost)",
};

/** Standard dark theme chart styling constants */
export const CHART = {
  bg: "var(--surface-raised)",
  bgDarker: "var(--surface-base)",
  border: "var(--surface-elevated)",
  grid: "var(--surface-highlight)",
  text: "var(--text-primary)",
  textSec: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  textDim: "var(--text-ghost)",
  accent: "var(--success)",
  gold: "var(--accent)",
  crimson: "var(--critical)",
  blue: "var(--info)",
} as const;

/** Standard tooltip container classes */
export const TOOLTIP_CLS =
  "rounded-lg border border-surface-highlight bg-surface-overlay px-3 py-2 shadow-lg";

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
    <div className={`rounded-xl border border-border-default bg-surface-raised p-6 ${className ?? ""}`}>
      {title && (
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-text-muted">
          {title}
        </h3>
      )}
      {subtitle && (
        <p className="mb-4 text-xs text-text-ghost">{subtitle}</p>
      )}
      {!subtitle && title && <div className="mb-4" />}
      {children}
    </div>
  );
}
