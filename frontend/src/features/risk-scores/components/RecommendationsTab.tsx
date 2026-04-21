import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  RiskScoreAnalysis,
  ScoreRecommendation,
} from "../types/riskScore";
import { useRecommendScores } from "../hooks/useRiskScores";
import { CohortProfilePanel } from "./CohortProfilePanel";
import { ScoreRecommendationCard } from "./ScoreRecommendationCard";

interface RecommendationsTabProps {
  analysis: RiskScoreAnalysis;
  sourceId: number;
}

function groupRecommendations(recommendations: ScoreRecommendation[]) {
  const recommended: ScoreRecommendation[] = [];
  const available: ScoreRecommendation[] = [];
  const notApplicable: ScoreRecommendation[] = [];

  for (const recommendation of recommendations) {
    if (!recommendation.applicable) {
      notApplicable.push(recommendation);
    } else if (
      recommendation.expected_completeness !== null &&
      recommendation.expected_completeness >= 0.7
    ) {
      recommended.push(recommendation);
    } else {
      available.push(recommendation);
    }
  }

  return { recommended, available, notApplicable };
}

function RecommendationGroup({
  label,
  recommendations,
  selectedScoreIds,
}: {
  label: string;
  recommendations: ScoreRecommendation[];
  selectedScoreIds: string[];
}) {
  if (recommendations.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-text-muted">
        {label}
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {recommendations.map((recommendation) => (
          <ScoreRecommendationCard
            key={recommendation.score_id}
            recommendation={recommendation}
            readOnly
            selected={selectedScoreIds.includes(recommendation.score_id)}
            onToggle={() => {}}
          />
        ))}
      </div>
    </div>
  );
}

export function RecommendationsTab({
  analysis,
  sourceId,
}: RecommendationsTabProps) {
  const { t } = useTranslation("app");
  const targetCohortId = analysis.design_json.targetCohortIds[0] ?? 0;
  const { data, isLoading } = useRecommendScores(sourceId, targetCohortId);

  if (sourceId === 0 || analysis.design_json.targetCohortIds.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-raised p-8 text-center text-sm text-text-muted">
        {t("riskScores.recommendations.selectSourceToView")}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-text-ghost" />
      </div>
    );
  }

  if (!data) return null;

  const { recommended, available, notApplicable } = groupRecommendations(
    data.recommendations,
  );
  const selectedScoreIds = analysis.design_json.scoreIds;

  return (
    <div className="space-y-6">
      <CohortProfilePanel profile={data.profile} compact={false} />

      <RecommendationGroup
        label={t("riskScores.recommendations.recommended")}
        recommendations={recommended}
        selectedScoreIds={selectedScoreIds}
      />
      <RecommendationGroup
        label={t("riskScores.recommendations.available")}
        recommendations={available}
        selectedScoreIds={selectedScoreIds}
      />
      <RecommendationGroup
        label={t("riskScores.recommendations.notApplicable")}
        recommendations={notApplicable}
        selectedScoreIds={selectedScoreIds}
      />
    </div>
  );
}
