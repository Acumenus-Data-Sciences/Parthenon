import { cn } from "@/lib/utils";

export type SignificanceVerdict = "protective" | "harmful" | "not_significant";

export interface SignificanceVerdictBadgeProps {
  hr: number;
  pValue: number;
  ciLower?: number;
  ciUpper?: number;
  className?: string;
}

const VERDICT_CONFIG: Record<
  SignificanceVerdict,
  { label: string; icon: string; colorClasses: string }
> = {
  protective: {
    label: "Significant protective effect",
    icon: "\u2193", // ↓
    colorClasses: "bg-success/15 text-success border-success/30",
  },
  harmful: {
    label: "Significant harmful effect",
    icon: "\u2191", // ↑
    colorClasses: "bg-critical/15 text-critical border-critical/30",
  },
  not_significant: {
    label: "Not statistically significant",
    icon: "\u2194", // ↔
    colorClasses: "bg-text-muted/15 text-text-muted border-text-muted/30",
  },
};

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

export function SignificanceVerdictBadge({
  hr,
  pValue,
  ciLower,
  ciUpper,
  className,
}: SignificanceVerdictBadgeProps) {
  const verdict = getVerdict(hr, pValue, ciLower, ciUpper);
  const config = VERDICT_CONFIG[verdict];

  return (
    <span
      data-testid="significance-verdict-badge"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        config.colorClasses,
        className,
      )}
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  );
}
