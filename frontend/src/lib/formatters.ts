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
