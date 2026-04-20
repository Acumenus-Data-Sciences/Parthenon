import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  score: number;
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const { t } = useTranslation("app");
  const { bg, text, labelKey } = getScoreStyle(score);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        bg,
        text,
      )}
    >
      <span className="font-['IBM_Plex_Mono',monospace] tabular-nums">
        {score > 0 ? score.toFixed(2) : "--"}
      </span>
      <span>{t(labelKey)}</span>
    </span>
  );
}

function getScoreStyle(score: number) {
  if (score >= 0.95) {
    return {
      bg: "bg-success/20",
      text: "text-success",
      labelKey: "ingestion.confidence.high",
    };
  }
  if (score >= 0.7) {
    return {
      bg: "bg-warning/20",
      text: "text-warning",
      labelKey: "ingestion.confidence.medium",
    };
  }
  if (score > 0) {
    return {
      bg: "bg-critical/20",
      text: "text-critical",
      labelKey: "ingestion.confidence.low",
    };
  }
  return {
    bg: "bg-surface-highlight",
    text: "text-text-ghost",
    labelKey: "ingestion.confidence.none",
  };
}
