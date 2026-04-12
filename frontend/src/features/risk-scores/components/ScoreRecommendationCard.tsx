import { CheckCircle2 } from "lucide-react";
import type { ScoreRecommendation } from "../types/riskScore";

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
  recommended: "border-[#2DD4BF]/40 bg-[#2DD4BF]/5",
  available: "border-[#F59E0B]/40 bg-[#F59E0B]/5",
  "not-applicable": "border-[#323238] bg-[#151518] opacity-60",
};

export function ScoreRecommendationCard({
  recommendation,
  selected,
  onToggle,
  readOnly = false,
}: ScoreRecommendationCardProps) {
  const tier = getTier(recommendation);
  const isApplicable = recommendation.applicable;
  const isClickable = !readOnly && isApplicable;

  const completeness = recommendation.expected_completeness ?? 0;
  const completenessPercent = Math.round(completeness * 100);

  function handleClick() {
    if (isClickable) {
      onToggle(recommendation.score_id);
    }
  }

  return (
    <div
      className={`flex flex-row items-start gap-3 rounded-lg border p-4 ${TIER_STYLES[tier]} ${
        isClickable ? "cursor-pointer" : "cursor-default"
      }`}
      onClick={handleClick}
    >
      {/* Left side: checkbox or checkmark */}
      <div className="shrink-0 pt-0.5">
        {isApplicable && !readOnly && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(recommendation.score_id)}
            className="h-4 w-4 rounded border-[#323238] bg-[#1A1A1F] text-[#2DD4BF] focus:ring-[#2DD4BF]/50"
          />
        )}
        {readOnly && selected && (
          <CheckCircle2 className="h-4 w-4 text-[#2DD4BF]" />
        )}
      </div>

      {/* Right side: content */}
      <div className="flex-1 min-w-0">
        {/* Score name */}
        <div className="text-sm font-medium text-[#F0EDE8]">
          {recommendation.score_name}
        </div>

        {/* Category badge */}
        <span className="mt-1 inline-block rounded bg-[#1A1A1F] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#8A857D]">
          {recommendation.category}
        </span>

        {/* Reason */}
        <div className="mt-1.5 text-xs text-[#8A857D]">
          {recommendation.reason}
        </div>

        {/* Expected completeness bar */}
        {isApplicable && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-[#232328]">
              <div
                className="h-1.5 rounded-full bg-[#2DD4BF]"
                style={{ width: `${completenessPercent}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] tabular-nums text-[#8A857D]">
              {completenessPercent}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
