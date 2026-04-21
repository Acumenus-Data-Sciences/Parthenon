import { Loader2, Play, ArrowRight, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type {
  RiskScoreAnalysis,
  PopulationSummary,
  AnalysisExecution,
} from "../types/riskScore";
import {
  TIER_COLORS,
  TIER_ORDER,
  ANALYSIS_STATUS_COLORS,
} from "../types/riskScore";
import {
  formatRiskScoreDate,
  formatRiskScoreDuration,
  getRiskScoreStatusLabel,
  getRiskScoreTierLabel,
} from "../lib/i18n";

interface OverviewTabProps {
  analysis: RiskScoreAnalysis;
  latestExecution: AnalysisExecution | null;
  populationSummaries: PopulationSummary[];
  onRunClick: () => void;
  onTabChange: (tab: string) => void;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-4">
      <p className="mb-1 text-[10px] uppercase tracking-wider text-text-ghost">
        {label}
      </p>
      <p className="font-['IBM_Plex_Mono',monospace] text-lg font-semibold text-text-primary">
        {value}
      </p>
      <p className="text-[10px] text-text-muted">{sub}</p>
    </div>
  );
}

function MiniTierBar({
  summaries,
}: {
  summaries: PopulationSummary[];
}) {
  const total = summaries.reduce((sum, summary) => sum + summary.patient_count, 0);
  if (total === 0) return null;

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-overlay">
      {TIER_ORDER.map((tier) => {
        const tierData = summaries.find((summary) => summary.risk_tier === tier);
        if (!tierData || tierData.patient_count === 0) return null;
        const pct = (tierData.patient_count / total) * 100;
        return (
          <div
            key={tier}
            className="h-full"
            style={{
              width: `${pct}%`,
              backgroundColor: TIER_COLORS[tier] ?? "var(--text-ghost)",
            }}
          />
        );
      })}
    </div>
  );
}

function computeStats(populationSummaries: PopulationSummary[]) {
  const byScore = new Map<string, PopulationSummary[]>();
  for (const summary of populationSummaries) {
    const existing = byScore.get(summary.score_id) ?? [];
    existing.push(summary);
    byScore.set(summary.score_id, existing);
  }

  let patientsScored = 0;
  for (const [, tiers] of byScore) {
    const scorePatients = tiers.reduce((sum, tier) => sum + tier.patient_count, 0);
    patientsScored = Math.max(patientsScored, scorePatients);
  }

  const completenessValues = populationSummaries
    .map((summary) => summary.mean_completeness)
    .filter((value): value is number => value !== null);
  const avgCompleteness =
    completenessValues.length > 0
      ? completenessValues.reduce((left, right) => left + right, 0) /
        completenessValues.length
      : null;

  const confidenceValues = populationSummaries
    .map((summary) => summary.mean_confidence)
    .filter((value): value is number => value !== null);
  const avgConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((left, right) => left + right, 0) /
        confidenceValues.length
      : null;

  return {
    uniqueScoreCount: byScore.size,
    patientsScored,
    avgCompleteness,
    avgConfidence,
    byScore,
  };
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: TFunction;
}) {
  const color = ANALYSIS_STATUS_COLORS[status] ?? "var(--text-muted)";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{getRiskScoreStatusLabel(t, status)}</span>
    </span>
  );
}

export function OverviewTab({
  analysis,
  latestExecution,
  populationSummaries,
  onRunClick,
  onTabChange,
}: OverviewTabProps) {
  const { t, i18n } = useTranslation("app");
  const isCompleted = latestExecution?.status === "completed";
  const isRunning =
    latestExecution?.status === "running" ||
    latestExecution?.status === "pending";
  const isDraft = !latestExecution;
  const stats = isCompleted ? computeStats(populationSummaries) : null;

  const datetimeOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-xl border border-border-default bg-surface-raised p-6">
          <h3 className="mb-3 text-sm font-medium text-text-primary">
            {t("riskScores.overview.about")}
          </h3>
          {analysis.description ? (
            <p className="mb-4 text-sm text-text-secondary">
              {analysis.description}
            </p>
          ) : (
            <p className="mb-4 text-sm italic text-text-ghost">
              {t("riskScores.common.values.noDescription")}
            </p>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-text-muted">
            <span>
              {t("riskScores.overview.author", {
                value: analysis.author?.name ?? t("riskScores.common.values.unknown"),
              })}
              {analysis.author?.email ? ` (${analysis.author.email})` : ""}
            </span>
            <span>
              {t("riskScores.overview.created", {
                value: formatRiskScoreDate(
                  i18n.resolvedLanguage,
                  analysis.created_at,
                  datetimeOptions,
                ),
              })}
            </span>
            <span>
              {t("riskScores.overview.updated", {
                value: formatRiskScoreDate(
                  i18n.resolvedLanguage,
                  analysis.updated_at,
                  datetimeOptions,
                ),
              })}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-surface-raised p-6">
          <h3 className="mb-4 text-sm font-medium text-text-primary">
            {t("riskScores.overview.resultsSummary")}
          </h3>

          {isCompleted && stats ? (
            <>
              <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                  label={t("riskScores.overview.scoresComputed")}
                  value={String(stats.uniqueScoreCount)}
                  sub={t("riskScores.overview.uniqueScores")}
                />
                <StatCard
                  label={t("riskScores.overview.patientsScored")}
                  value={stats.patientsScored.toLocaleString()}
                  sub={t("riskScores.overview.maxPerScore")}
                />
                <StatCard
                  label={t("riskScores.overview.avgCompleteness")}
                  value={
                    stats.avgCompleteness !== null
                      ? `${(stats.avgCompleteness * 100).toFixed(1)}%`
                      : t("riskScores.common.values.notAvailable")
                  }
                  sub={t("riskScores.overview.acrossSummaries")}
                />
                <StatCard
                  label={t("riskScores.overview.avgConfidence")}
                  value={
                    stats.avgConfidence !== null
                      ? `${(stats.avgConfidence * 100).toFixed(1)}%`
                      : t("riskScores.common.values.notAvailable")
                  }
                  sub={t("riskScores.overview.acrossSummaries")}
                />
              </div>

              <div className="mb-4 space-y-3">
                {Array.from(stats.byScore.entries()).map(([scoreId, tiers]) => (
                  <button
                    key={scoreId}
                    type="button"
                    onClick={() => onTabChange("results")}
                    className="w-full rounded-lg border border-border-default bg-surface-overlay p-3 text-left transition-colors hover:border-surface-highlight"
                  >
                    <p className="mb-2 text-xs font-medium text-text-primary">
                      {scoreId}
                    </p>
                    <MiniTierBar summaries={tiers} />
                    <div className="mt-2 flex gap-3">
                      {TIER_ORDER.map((tier) => {
                        const tierData = tiers.find(
                          (summary) => summary.risk_tier === tier,
                        );
                        if (!tierData || tierData.patient_count === 0) return null;
                        return (
                          <span
                            key={tier}
                            className="text-[10px]"
                            style={{ color: TIER_COLORS[tier] }}
                          >
                            {getRiskScoreTierLabel(t, tier)}: {tierData.patient_count}
                          </span>
                        );
                      })}
                    </div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onTabChange("results")}
                className="inline-flex items-center gap-1 text-xs text-success transition-colors hover:text-success-light"
              >
                {t("riskScores.common.actions.viewFullResults")}
                <ArrowRight className="h-3 w-3" />
              </button>
            </>
          ) : isDraft ? (
            <div className="flex flex-col items-center justify-center py-10">
              <p className="mb-4 text-sm text-text-muted">
                {t("riskScores.overview.thisAnalysisHasNotBeenExecutedYet")}
              </p>
              <button
                type="button"
                onClick={onRunClick}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-light"
              >
                <Play className="h-4 w-4" />
                {t("riskScores.common.actions.runAnalysis")}
              </button>
            </div>
          ) : isRunning ? (
            <div className="flex items-center justify-center gap-3 py-10">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <p className="text-sm text-accent">
                {t("riskScores.overview.executionInProgress")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10">
              <p className="mb-4 text-sm text-critical">
                {t("riskScores.overview.lastExecutionFailed")}
              </p>
              <button
                type="button"
                onClick={onRunClick}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-light"
              >
                <Play className="h-4 w-4" />
                {t("riskScores.common.actions.runAnalysis")}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-border-default bg-surface-raised p-5">
          <h3 className="mb-3 text-sm font-medium text-text-primary">
            {t("riskScores.overview.recentExecution")}
          </h3>
          {latestExecution ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {t("riskScores.common.headers.status")}
                </span>
                <StatusBadge status={latestExecution.status} t={t} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {t("riskScores.overview.started")}
                </span>
                <span className="text-xs text-text-secondary">
                  {latestExecution.started_at
                    ? formatRiskScoreDate(
                        i18n.resolvedLanguage,
                        latestExecution.started_at,
                        datetimeOptions,
                      )
                    : "\u2014"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {t("riskScores.overview.completed")}
                </span>
                <span className="text-xs text-text-secondary">
                  {latestExecution.completed_at
                    ? formatRiskScoreDate(
                        i18n.resolvedLanguage,
                        latestExecution.completed_at,
                        datetimeOptions,
                      )
                    : "\u2014"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {t("riskScores.overview.duration")}
                </span>
                <span className="text-xs text-text-secondary">
                  {latestExecution.started_at && latestExecution.completed_at
                    ? formatRiskScoreDuration(
                        t,
                        new Date(latestExecution.completed_at).getTime() -
                          new Date(latestExecution.started_at).getTime(),
                      )
                    : "\u2014"}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Clock className="h-4 w-4" />
              {t("riskScores.overview.thisAnalysisHasNotBeenExecutedYet")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
