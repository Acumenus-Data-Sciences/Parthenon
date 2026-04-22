export type SignificanceVerdict = "protective" | "harmful" | "not_significant";

/**
 * Determine significance verdict from hazard ratio, p-value, and optional CI.
 * CI spanning null means ciLower <= 1 <= ciUpper (for HR, null = 1).
 */
export function getVerdict(
  hr: number,
  pValue: number,
  ciLower?: number,
  ciUpper?: number,
): SignificanceVerdict {
  const ciSpansNull =
    ciLower != null && ciUpper != null && ciLower <= 1 && ciUpper >= 1;

  if (pValue >= 0.05 || ciSpansNull) return "not_significant";
  if (hr < 1) return "protective";
  return "harmful";
}
