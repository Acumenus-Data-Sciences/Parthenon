import { useMemo, useState } from "react";
import { Users, BarChart3 } from "lucide-react";
import type { PopulationSummary, RiskScoreTier } from "../types/riskScore";
import { TIER_COLORS, TIER_ORDER } from "../types/riskScore";
import { TierBreakdownChart } from "./TierBreakdownChart";

interface ResultsTabProps {
  analysisId: number;
  executionId: number | null;
  summaries: PopulationSummary[];
  scoreNames: Record<string, string>;
  onCreateCohort: (scoreId: string, tier: string, patientCount: number) => void;
}

function tierLabel(tier: string): string {
  return tier
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ResultsTab({
  summaries,
  scoreNames,
  onCreateCohort,
}: ResultsTabProps) {
  const [activeScore, setActiveScore] = useState<string | null>(null);

  // Group summaries by score_id, sorted by TIER_ORDER within each group
  const groupedByScore = useMemo(() => {
    const groups = new Map<string, PopulationSummary[]>();
    for (const s of summaries) {
      const existing = groups.get(s.score_id);
      if (existing) {
        existing.push(s);
      } else {
        groups.set(s.score_id, [s]);
      }
    }
    // Sort tiers within each group
    for (const [, tiers] of groups) {
      tiers.sort((a, b) => {
        const ai = TIER_ORDER.indexOf(a.risk_tier as (typeof TIER_ORDER)[number]);
        const bi = TIER_ORDER.indexOf(b.risk_tier as (typeof TIER_ORDER)[number]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    }
    return groups;
  }, [summaries]);

  const scoreIds = useMemo(() => [...groupedByScore.keys()], [groupedByScore]);

  const visibleScoreIds = useMemo(
    () => (activeScore ? [activeScore] : scoreIds),
    [activeScore, scoreIds],
  );

  // Empty state
  if (summaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="h-12 w-12 text-text-ghost mb-4" />
        <p className="text-text-muted text-sm">
          No results available. Run the analysis to compute risk scores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveScore(null)}
          className={`rounded-full px-4 py-1.5 text-xs font-medium border transition-colors ${
            activeScore === null
              ? "bg-success/10 text-success border-success/40"
              : "bg-surface-raised text-text-muted border-border-default hover:text-text-secondary"
          }`}
        >
          All Scores
        </button>
        {scoreIds.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveScore(id === activeScore ? null : id)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium border transition-colors ${
              activeScore === id
                ? "bg-success/10 text-success border-success/40"
                : "bg-surface-raised text-text-muted border-border-default hover:text-text-secondary"
            }`}
          >
            {scoreNames[id] ?? id}
          </button>
        ))}
      </div>

      {/* Per-score result cards */}
      {visibleScoreIds.map((scoreId) => {
        const scoreSummaries = groupedByScore.get(scoreId) ?? [];
        const totalPatients = scoreSummaries.reduce(
          (sum, s) => sum + s.patient_count,
          0,
        );

        const tierData: RiskScoreTier[] = scoreSummaries.map((s) => ({
          risk_tier: s.risk_tier,
          patient_count: s.patient_count,
          tier_fraction:
            totalPatients > 0 ? s.patient_count / totalPatients : null,
          mean_score: s.mean_score,
          p25_score: s.p25_score,
          median_score: s.median_score,
          p75_score: s.p75_score,
          mean_confidence: s.mean_confidence,
          mean_completeness: s.mean_completeness,
          missing_components: {},
        }));

        const avgCompleteness =
          scoreSummaries.length > 0
            ? scoreSummaries.reduce(
                (sum, s) => sum + (s.mean_completeness ?? 0),
                0,
              ) / scoreSummaries.length
            : null;

        return (
          <div
            key={scoreId}
            className="rounded-xl border border-border-default bg-surface-raised p-6"
          >
            {/* Header */}
            <div className="mb-4 flex items-center gap-3">
              <h3 className="text-base font-semibold text-text-primary">
                {scoreNames[scoreId] ?? scoreId}
              </h3>
              <span className="rounded-md bg-surface-overlay px-2 py-0.5 text-[10px] font-medium text-text-muted border border-border-default">
                {scoreId}
              </span>
            </div>

            {/* Tier breakdown chart */}
            <TierBreakdownChart tiers={tierData} />

            {/* Tier table with actions */}
            <div className="mt-4 overflow-hidden rounded-xl border border-border-default">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-default bg-surface-base">
                    <th className="px-3 py-2 text-left text-text-muted font-medium">
                      Tier
                    </th>
                    <th className="px-3 py-2 text-right text-text-muted font-medium">
                      Count
                    </th>
                    <th className="px-3 py-2 text-right text-text-muted font-medium">
                      % of Total
                    </th>
                    <th className="px-3 py-2 text-right text-text-muted font-medium">
                      Mean Score
                    </th>
                    <th className="px-3 py-2 text-right text-text-muted font-medium">
                      Confidence
                    </th>
                    <th className="px-3 py-2 text-center text-text-muted font-medium">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scoreSummaries.map((s) => {
                    const pct =
                      totalPatients > 0
                        ? (s.patient_count / totalPatients) * 100
                        : 0;
                    return (
                      <tr
                        key={s.risk_tier}
                        className="border-b border-border-default/50 last:border-b-0 hover:bg-surface-overlay transition-colors"
                      >
                        <td className="px-3 py-2 text-text-primary">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  TIER_COLORS[s.risk_tier] ??
                                  TIER_COLORS.uncomputable,
                              }}
                            />
                            {tierLabel(s.risk_tier)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-secondary">
                          {s.patient_count.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-muted">
                          {pct.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-secondary">
                          {s.mean_score != null
                            ? Number(s.mean_score).toFixed(1)
                            : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-secondary">
                          {s.mean_confidence != null
                            ? `${(Number(s.mean_confidence) * 100).toFixed(0)}%`
                            : "-"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              onCreateCohort(
                                scoreId,
                                s.risk_tier,
                                s.patient_count,
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-[10px] font-medium text-success border border-success/20 hover:bg-success/20 transition-colors"
                            title="Create Cohort"
                          >
                            <Users className="h-3 w-3" />
                            Create Cohort
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Completeness note */}
            {avgCompleteness != null && (
              <p className="mt-3 text-[10px] text-text-ghost">
                Average completeness:{" "}
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
