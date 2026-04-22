import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { getVerdict, type SignificanceVerdict } from "./significanceVerdict";

export interface SignificanceVerdictBadgeProps {
  hr: number;
  pValue: number;
  ciLower?: number;
  ciUpper?: number;
  className?: string;
}

const VERDICT_CONFIG: Record<
  SignificanceVerdict,
  { labelKey: string; icon: string; colorClasses: string }
> = {
  protective: {
    labelKey: "shared.significanceVerdict.protective",
    icon: "\u2193", // ↓
    colorClasses: "bg-success/15 text-success border-success/30",
  },
  harmful: {
    labelKey: "shared.significanceVerdict.harmful",
    icon: "\u2191", // ↑
    colorClasses: "bg-critical/15 text-critical border-critical/30",
  },
  not_significant: {
    labelKey: "shared.significanceVerdict.notSignificant",
    icon: "\u2194", // ↔
    colorClasses: "bg-text-muted/15 text-text-muted border-text-muted/30",
  },
};

export function SignificanceVerdictBadge({
  hr,
  pValue,
  ciLower,
  ciUpper,
  className,
}: SignificanceVerdictBadgeProps) {
  const { t } = useTranslation("app");
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
      {t(config.labelKey)}
    </span>
  );
}
