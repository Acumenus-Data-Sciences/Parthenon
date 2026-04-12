import { Loader2 } from "lucide-react";
import type { RiskScoreAnalysis, ScoreRecommendation } from "../types/riskScore";
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

  for (const r of recommendations) {
    if (!r.applicable) {
      notApplicable.push(r);
    } else if (
      r.expected_completeness !== null &&
      r.expected_completeness >= 0.7
    ) {
      recommended.push(r);
    } else {
      available.push(r);
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
      <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-3">
        {label}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recommendations.map((r) => (
          <ScoreRecommendationCard
            key={r.score_id}
            recommendation={r}
            readOnly={true}
            selected={selectedScoreIds.includes(r.score_id)}
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
  const targetCohortId = analysis.design_json.targetCohortIds[0] ?? 0;
  const { data, isLoading } = useRecommendScores(sourceId, targetCohortId);

  if (sourceId === 0 || analysis.design_json.targetCohortIds.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-raised p-8 text-center text-sm text-text-muted">
        Select a source to view recommendations
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
        label="Recommended"
        recommendations={recommended}
        selectedScoreIds={selectedScoreIds}
      />
      <RecommendationGroup
        label="Available"
        recommendations={available}
        selectedScoreIds={selectedScoreIds}
      />
      <RecommendationGroup
        label="Not Applicable"
        recommendations={notApplicable}
        selectedScoreIds={selectedScoreIds}
      />
    </div>
  );
}
