import { useMemo, useState } from "react";
import { Users, BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PopulationSummary, RiskScoreTier } from "../types/riskScore";
import { TIER_COLORS, TIER_ORDER } from "../types/riskScore";
import { TierBreakdownChart } from "./TierBreakdownChart";
import { getRiskScoreTierLabel } from "../lib/i18n";

interface ResultsTabProps {
  analysisId: number;
  executionId: number | null;
  summaries: PopulationSummary[];
  scoreNames: Record<string, string>;
  onCreateCohort: (scoreId: string, tier: string, patientCount: number) => void;
}

export function ResultsTab({
  summaries,
  scoreNames,
  onCreateCohort,
}: ResultsTabProps) {
  const { t } = useTranslation("app");
  const [activeScore, setActiveScore] = useState<string | null>(null);

  const groupedByScore = useMemo(() => {
    const groups = new Map<string, PopulationSummary[]>();
    for (const summary of summaries) {
      const existing = groups.get(summary.score_id);
      if (existing) {
        existing.push(summary);
      } else {
        groups.set(summary.score_id, [summary]);
      }
    }

    for (const [, tiers] of groups) {
      tiers.sort((left, right) => {
        const leftIndex = TIER_ORDER.indexOf(
          left.risk_tier as (typeof TIER_ORDER)[number],
        );
        const rightIndex = TIER_ORDER.indexOf(
          right.risk_tier as (typeof TIER_ORDER)[number],
        );
        return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
      });
    }

    return groups;
  }, [summaries]);

  const scoreIds = useMemo(() => [...groupedByScore.keys()], [groupedByScore]);
  const visibleScoreIds = useMemo(
    () => (activeScore ? [activeScore] : scoreIds),
    [activeScore, scoreIds],
  );

  if (summaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="mb-4 h-12 w-12 text-text-ghost" />
        <p className="text-sm text-text-muted">
          {t("riskScores.results.noResultsAvailable")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveScore(null)}
          className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
            activeScore === null
              ? "border-success/40 bg-success/10 text-success"
              : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary"
          }`}
        >
          {t("riskScores.results.allScores")}
        </button>
        {scoreIds.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveScore(id === activeScore ? null : id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
              activeScore === id
                ? "border-success/40 bg-success/10 text-success"
                : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary"
            }`}
          >
            {scoreNames[id] ?? id}
          </button>
        ))}
      </div>

      {visibleScoreIds.map((scoreId) => {
        const scoreSummaries = groupedByScore.get(scoreId) ?? [];
        const totalPatients = scoreSummaries.reduce(
          (sum, summary) => sum + summary.patient_count,
          0,
        );

        const tierData: RiskScoreTier[] = scoreSummaries.map((summary) => ({
          risk_tier: summary.risk_tier,
          patient_count: summary.patient_count,
          tier_fraction:
            totalPatients > 0 ? summary.patient_count / totalPatients : null,
          mean_score: summary.mean_score,
          p25_score: summary.p25_score,
          median_score: summary.median_score,
          p75_score: summary.p75_score,
          mean_confidence: summary.mean_confidence,
          mean_completeness: summary.mean_completeness,
          missing_components: {},
        }));

        const avgCompleteness =
          scoreSummaries.length > 0
            ? scoreSummaries.reduce(
                (sum, summary) => sum + (summary.mean_completeness ?? 0),
                0,
              ) / scoreSummaries.length
            : null;

        return (
          <div
            key={scoreId}
            className="rounded-xl border border-border-default bg-surface-raised p-6"
          >
            <div className="mb-4 flex items-center gap-3">
              <h3 className="text-base font-semibold text-text-primary">
                {scoreNames[scoreId] ?? scoreId}
              </h3>
              <span className="rounded-md border border-border-default bg-surface-overlay px-2 py-0.5 text-[10px] font-medium text-text-muted">
                {scoreId}
              </span>
            </div>

            <TierBreakdownChart tiers={tierData} />

            <div className="mt-4 overflow-hidden rounded-xl border border-border-default">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-default bg-surface-base">
                    <th className="px-3 py-2 text-left font-medium text-text-muted">
                      {t("riskScores.common.headers.tier")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-text-muted">
                      {t("riskScores.common.headers.count")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-text-muted">
                      {t("riskScores.results.percentOfTotal")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-text-muted">
                      {t("riskScores.common.headers.meanScore")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-text-muted">
                      {t("riskScores.common.headers.confidence")}
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-text-muted">
                      {t("riskScores.results.action")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scoreSummaries.map((summary) => {
                    const pct =
                      totalPatients > 0
                        ? (summary.patient_count / totalPatients) * 100
                        : 0;
                    return (
                      <tr
                        key={summary.risk_tier}
                        className="border-b border-border-default/50 transition-colors last:border-b-0 hover:bg-surface-overlay"
                      >
                        <td className="px-3 py-2 text-text-primary">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  TIER_COLORS[summary.risk_tier] ??
                                  TIER_COLORS.uncomputable,
                              }}
                            />
                            {getRiskScoreTierLabel(t, summary.risk_tier)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-secondary">
                          {summary.patient_count.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-muted">
                          {pct.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-secondary">
                          {summary.mean_score != null
                            ? Number(summary.mean_score).toFixed(1)
                            : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-secondary">
                          {summary.mean_confidence != null
                            ? `${(Number(summary.mean_confidence) * 100).toFixed(0)}%`
                            : "-"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              onCreateCohort(
                                scoreId,
                                summary.risk_tier,
                                summary.patient_count,
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-success/20 bg-success/10 px-2 py-1 text-[10px] font-medium text-success transition-colors hover:bg-success/20"
                            title={t("riskScores.common.actions.createCohort")}
                          >
                            <Users className="h-3 w-3" />
                            {t("riskScores.common.actions.createCohort")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {avgCompleteness != null && (
              <p className="mt-3 text-[10px] text-text-ghost">
                {t("riskScores.results.averageCompleteness")}{" "}
                <span className="text-text-muted">
                  {(avgCompleteness * 100).toFixed(1)}%
                </span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
