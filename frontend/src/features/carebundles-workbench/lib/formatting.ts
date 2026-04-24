export function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return "never";
  const date = new Date(isoString);
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function formatRate(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Render a rate with its Wilson 95% CI bounds, e.g. "23.3% (22.9–23.7%)".
 */
export function formatRateWithCI(
  rate: number | null | undefined,
  ciLower: number | null | undefined,
  ciUpper: number | null | undefined,
): string {
  if (rate == null) return "—";
  const r = `${(rate * 100).toFixed(1)}%`;
  if (ciLower == null || ciUpper == null) return r;
  return `${r} (${(ciLower * 100).toFixed(1)}–${(ciUpper * 100).toFixed(1)}%)`;
}
