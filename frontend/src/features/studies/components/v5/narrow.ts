import { formatNumber } from "@/i18n/format";
import type { CovariateBalanceEntry, EstimateEntry } from "@/features/estimation/types/estimation";

// ---------------------------------------------------------------------------
// Defensive narrowing for v5 summary_data (projected as Record<string, unknown>).
// Mirrors the helpers in StudyResultSummary so every field access is safe.
// ---------------------------------------------------------------------------

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function records(value: unknown): Record<string, unknown>[] {
  return asArray(value).map(asRecord);
}

export function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function bool(value: unknown): boolean {
  return value === true;
}

export function fmt(value: unknown, digits = 2): string {
  const n = num(value);
  return n === null ? "—" : n.toFixed(digits);
}

export function fmtCount(value: unknown): string {
  const n = num(value);
  return n === null ? "—" : formatNumber(n);
}

export function fmtPct(value: unknown, digits = 1): string {
  const n = num(value);
  return n === null ? "—" : `${(n * 100).toFixed(digits)}%`;
}

/** A summary_data row is a fixture when it carries the projector's _fixture flag. */
export function isFixture(data: Record<string, unknown>): boolean {
  return data._fixture === true;
}

// ---------------------------------------------------------------------------
// Adapters — compact v5 estimate/balance rows → the shapes the reusable
// estimation charts (ForestPlot, LovePlot) require. Required numeric fields the
// v5 payload does not carry are derived (log HR / SE from the CI) or zero-filled
// where the chart does not read them.
// ---------------------------------------------------------------------------

/** Build a full EstimateEntry (for ForestPlot) from a compact {outcome, HR, CI} row. */
export function toForestEstimate(row: Record<string, unknown>, index: number): EstimateEntry {
  const hr = num(row.hazard_ratio) ?? num(row.estimate) ?? 1;
  const lo = num(row.ci_95_lower) ?? hr;
  const hi = num(row.ci_95_upper) ?? hr;
  const safeHr = hr > 0 ? hr : 1;
  const seLogHr = hi > 0 && lo > 0 && hi > lo ? (Math.log(hi) - Math.log(lo)) / (2 * 1.96) : 0.1;

  return {
    outcome_id: index,
    outcome_name: str(row.outcome_name) || `#${index + 1}`,
    hazard_ratio: hr,
    ci_95_lower: lo,
    ci_95_upper: hi,
    p_value: num(row.p_value) ?? 1,
    log_hr: Math.log(safeHr),
    se_log_hr: seLogHr,
    target_outcomes: num(row.target_outcomes) ?? 0,
    comparator_outcomes: num(row.comparator_outcomes) ?? 0,
  };
}

/** Build a CovariateBalanceEntry (for LovePlot) from a compact {covariate, smd_before, smd_after} row. */
export function toBalanceEntry(row: Record<string, unknown>): CovariateBalanceEntry {
  return {
    covariate_name: str(row.covariate) || str(row.covariate_name) || "—",
    smd_before: num(row.smd_before) ?? 0,
    smd_after: num(row.smd_after) ?? 0,
    mean_target_before: 0,
    mean_comp_before: 0,
    mean_target_after: 0,
    mean_comp_after: 0,
  };
}
