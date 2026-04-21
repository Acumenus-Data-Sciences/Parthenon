import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ScoreRecommendation } from "../types/riskScore";
import { getRiskScoreCategoryLabel } from "../lib/i18n";

interface ScoreRecommendationCardProps {
  recommendation: ScoreRecommendation;
  selected: boolean;
  onToggle: (scoreId: string) => void;
  readOnly?: boolean;
}

type Tier = "recommended" | "available" | "not-applicable";

function getTier(recommendation: ScoreRecommendation): Tier {
  if (!recommendation.applicable) return "not-applicable";
  if (
    recommendation.expected_completeness !== null &&
    recommendation.expected_completeness >= 0.7
  ) {
    return "recommended";
  }
  return "available";
}

const TIER_STYLES: Record<Tier, string> = {
  recommended: "border-success/40 bg-success/5",
  available: "border-warning/40 bg-warning/5",
  "not-applicable": "border-surface-highlight bg-surface-raised opacity-60",
};

export function ScoreRecommendationCard({
  recommendation,
  selected,
  onToggle,
  readOnly = false,
}: ScoreRecommendationCardProps) {
  const { t } = useTranslation("app");
  const tier = getTier(recommendation);
  const isApplicable = recommendation.applicable;
  const isClickable = !readOnly && isApplicable;
  const completeness = recommendation.expected_completeness ?? 0;
  const completenessPercent = Math.round(completeness * 100);

  return (
    <div
      className={`flex flex-row items-start gap-3 rounded-lg border p-4 ${TIER_STYLES[tier]} ${
        isClickable ? "cursor-pointer" : "cursor-default"
      }`}
      onClick={() => {
        if (isClickable) onToggle(recommendation.score_id);
      }}
    >
      <div className="shrink-0 pt-0.5">
        {isApplicable && !readOnly && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(recommendation.score_id)}
            className="h-4 w-4 rounded border-surface-highlight bg-surface-overlay text-success focus:ring-success/50"
          />
        )}
        {readOnly && selected && (
          <CheckCircle2 className="h-4 w-4 text-success" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-primary">
          {recommendation.score_name}
        </div>

        <span className="mt-1 inline-block rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
          {getRiskScoreCategoryLabel(t, recommendation.category)}
        </span>

        <div className="mt-1.5 text-xs text-text-muted">
          {recommendation.reason}
        </div>

        {isApplicable && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-surface-elevated">
              <div
                className="h-1.5 rounded-full bg-success"
                style={{ width: `${completenessPercent}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] tabular-nums text-text-muted">
              {completenessPercent}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
