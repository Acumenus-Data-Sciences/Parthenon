/**
 * Defensive numeric formatting helpers for R runtime values.
 *
 * R can return "NA" (string), null, NaN, or string-encoded numbers
 * for fields that TypeScript types expect as `number`. These helpers
 * prevent crashes from calling .toFixed() on non-numeric values.
 */

/** Format a value as a fixed-decimal string, returning "N/A" for non-numeric values */
export function fmt(v: unknown, decimals = 3): string {
  if (v == null || v === "NA" || v === "NaN" || v === "") return "N/A";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(decimals) : "N/A";
}

/** Coerce a value to a finite number, returning 0 for non-numeric values */
export function num(v: unknown): number {
  if (v == null || v === "NA" || v === "NaN") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Format a percentage value, returning "N/A" for non-numeric values */
export function fmtPct(v: unknown, decimals = 1): string {
  if (v == null || v === "NA" || v === "NaN" || v === "") return "N/A";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? `${n.toFixed(decimals)}%` : "N/A";
}

/** Format a number in compact notation (1.2M, 3.4K) */
export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ── Clinical metric utilities ───────────────────────────────────────────────

/**
 * Compute Number Needed to Treat from absolute survival proportions.
 * NNT = 1 / ARR where ARR = targetSurvival - comparatorSurvival.
 * Positive = benefit (target better), negative = harm.
 * Returns Infinity when ARR is zero (no difference).
 */
export function computeNNT(
  targetSurvival: number,
  comparatorSurvival: number,
): number {
  if (!Number.isFinite(targetSurvival) || !Number.isFinite(comparatorSurvival)) {
    return Infinity;
  }
  const arr = targetSurvival - comparatorSurvival;
  if (Math.abs(arr) < 1e-10) return Infinity;
  return 1 / arr;
}

/**
 * Compute Incidence Rate Difference with approximate 95% CI.
 * Uses normal approximation: SE = sqrt(rate1/py1 + rate2/py2).
 * Returns zero-width CI at 0 when either person-years is zero.
 */
export function computeRateDifference(
  rate1: number,
  rate2: number,
  personYears1: number,
  personYears2: number,
): { ird: number; ciLower: number; ciUpper: number } {
  if (personYears1 === 0 || personYears2 === 0) {
    return { ird: 0, ciLower: 0, ciUpper: 0 };
  }
  const ird = rate1 - rate2;
  const se = Math.sqrt(rate1 / personYears1 + rate2 / personYears2);
  return {
    ird,
    ciLower: ird - 1.96 * se,
    ciUpper: ird + 1.96 * se,
  };
}

/** Classify I² heterogeneity: <25 Low, 25–75 Moderate, >75 High */
export function heterogeneityLabel(
  iSquared: number,
): "Low" | "Moderate" | "High" {
  if (iSquared < 25) return "Low";
  if (iSquared <= 75) return "Moderate";
  return "High";
}

/**
 * Format a p-value for display.
 * - p < 0.001 → "<0.001"
 * - p < 0.01  → 3 decimal places
 * - otherwise → 2 decimal places
 */
export function fmtP(p: number): string {
  if (!Number.isFinite(p) || p < 0) return "N/A";
  if (p < 0.001) return "<0.001";
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(2);
}
