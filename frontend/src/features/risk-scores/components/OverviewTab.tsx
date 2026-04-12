import { Loader2, Play, ArrowRight, Clock } from "lucide-react";
import type {
  RiskScoreAnalysis,
  PopulationSummary,
  AnalysisExecution,
} from "../types/riskScore";
import { TIER_COLORS, TIER_ORDER, ANALYSIS_STATUS_COLORS } from "../types/riskScore";

interface OverviewTabProps {
  analysis: RiskScoreAnalysis;
  latestExecution: AnalysisExecution | null;
  populationSummaries: PopulationSummary[];
  onRunClick: () => void;
  onTabChange: (tab: string) => void;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-4">
      <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-semibold font-['IBM_Plex_Mono',monospace] text-[#F0EDE8]">{value}</p>
      <p className="text-[10px] text-[#8A857D]">{sub}</p>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: string, completedAt: string): string {
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function MiniTierBar({ summaries }: { summaries: PopulationSummary[] }) {
  const total = summaries.reduce((sum, s) => sum + s.patient_count, 0);
  if (total === 0) return null;

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#1A1A1F]">
      {TIER_ORDER.map((tier) => {
        const tierData = summaries.find((s) => s.risk_tier === tier);
        if (!tierData || tierData.patient_count === 0) return null;
        const pct = (tierData.patient_count / total) * 100;
        return (
          <div
            key={tier}
            className="h-full"
            style={{
              width: `${pct}%`,
              backgroundColor: TIER_COLORS[tier] ?? "#5A5650",
            }}
          />
        );
      })}
    </div>
  );
}

function computeStats(populationSummaries: PopulationSummary[]) {
  const byScore = new Map<string, PopulationSummary[]>();
  for (const s of populationSummaries) {
    const existing = byScore.get(s.score_id) ?? [];
    existing.push(s);
    byScore.set(s.score_id, existing);
  }

  const uniqueScoreCount = byScore.size;

  // Patients scored = max patients across any single score
  // (each score is computed against the same cohort, so max ≈ cohort size)
  let patientsScored = 0;
  for (const [, tiers] of byScore) {
    const scorePatients = tiers.reduce((sum, t) => sum + t.patient_count, 0);
    patientsScored = Math.max(patientsScored, scorePatients);
  }

  const completenessValues = populationSummaries
    .map((s) => s.mean_completeness)
    .filter((v): v is number => v !== null);
  const avgCompleteness =
    completenessValues.length > 0
      ? completenessValues.reduce((a, b) => a + b, 0) / completenessValues.length
      : null;

  const confidenceValues = populationSummaries
    .map((s) => s.mean_confidence)
    .filter((v): v is number => v !== null);
  const avgConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
      : null;

  return { uniqueScoreCount, patientsScored, avgCompleteness, avgConfidence, byScore };
}

function StatusBadge({ status }: { status: string }) {
  const color = ANALYSIS_STATUS_COLORS[status] ?? "#8A857D";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }} className="capitalize">
        {status}
      </span>
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
  const isCompleted = latestExecution?.status === "completed";
  const isRunning =
    latestExecution?.status === "running" || latestExecution?.status === "pending";
  const isDraft = !latestExecution;

  const stats = isCompleted ? computeStats(populationSummaries) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column */}
      <div className="lg:col-span-2 space-y-6">
        {/* About section */}
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-6">
          <h3 className="text-sm font-medium text-[#F0EDE8] mb-3">About</h3>
          {analysis.description ? (
            <p className="text-sm text-[#C5C0B8] mb-4">{analysis.description}</p>
          ) : (
            <p className="text-sm text-[#5A5650] italic mb-4">No description</p>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#8A857D]">
            <span>
              Author: {analysis.author?.name ?? "Unknown"}
              {analysis.author?.email ? ` (${analysis.author.email})` : ""}
            </span>
            <span>Created: {formatDate(analysis.created_at)}</span>
            <span>Updated: {formatDate(analysis.updated_at)}</span>
          </div>
        </div>

        {/* Smart Results Summary */}
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-6">
          <h3 className="text-sm font-medium text-[#F0EDE8] mb-4">Results Summary</h3>

          {isCompleted && stats ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <StatCard
                  label="Scores Computed"
                  value={String(stats.uniqueScoreCount)}
                  sub="unique scores"
                />
                <StatCard
                  label="Patients Scored"
                  value={stats.patientsScored.toLocaleString()}
                  sub="max per score"
                />
                <StatCard
                  label="Avg Completeness"
                  value={
                    stats.avgCompleteness !== null
                      ? `${(stats.avgCompleteness * 100).toFixed(1)}%`
                      : "N/A"
                  }
                  sub="across summaries"
                />
                <StatCard
                  label="Avg Confidence"
                  value={
                    stats.avgConfidence !== null
                      ? `${(stats.avgConfidence * 100).toFixed(1)}%`
                      : "N/A"
                  }
                  sub="across summaries"
                />
              </div>

              {/* Per-score mini cards */}
              <div className="space-y-3 mb-4">
                {Array.from(stats.byScore.entries()).map(([scoreId, tiers]) => (
                  <button
                    key={scoreId}
                    type="button"
                    onClick={() => onTabChange("results")}
                    className="w-full rounded-lg border border-[#2A2A2F] bg-[#1A1A1F] p-3 text-left hover:border-[#3A3A3F] transition-colors"
                  >
                    <p className="text-xs font-medium text-[#F0EDE8] mb-2">{scoreId}</p>
                    <MiniTierBar summaries={tiers} />
                    <div className="flex gap-3 mt-2">
                      {TIER_ORDER.map((tier) => {
                        const t = tiers.find((s) => s.risk_tier === tier);
                        if (!t || t.patient_count === 0) return null;
                        return (
                          <span
                            key={tier}
                            className="text-[10px]"
                            style={{ color: TIER_COLORS[tier] }}
                          >
                            {tier.replace("_", " ")}: {t.patient_count}
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
                className="inline-flex items-center gap-1 text-xs text-[#2DD4BF] hover:text-[#5EEAD4] transition-colors"
              >
                View Full Results <ArrowRight className="h-3 w-3" />
              </button>
            </>
          ) : isDraft ? (
            <div className="flex flex-col items-center justify-center py-10">
              <p className="text-sm text-[#8A857D] mb-4">
                This analysis hasn&apos;t been executed yet.
              </p>
              <button
                type="button"
                onClick={onRunClick}
                className="inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-4 py-2 text-sm font-medium text-text-primary hover:bg-[#B22040] transition-colors"
              >
                <Play className="h-4 w-4" />
                Run Analysis
              </button>
            </div>
          ) : isRunning ? (
            <div className="flex items-center justify-center gap-3 py-10">
              <Loader2 className="h-5 w-5 animate-spin text-[#C9A227]" />
              <p className="text-sm text-[#C9A227]">Execution in progress...</p>
            </div>
          ) : (
            /* failed or unknown status */
            <div className="flex flex-col items-center justify-center py-10">
              <p className="text-sm text-[#E85A6B] mb-4">
                Last execution failed.
              </p>
              <button
                type="button"
                onClick={onRunClick}
                className="inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-4 py-2 text-sm font-medium text-text-primary hover:bg-[#B22040] transition-colors"
              >
                <Play className="h-4 w-4" />
                Retry Analysis
              </button>
            </div>
          )}
        </div>

        {/* Execution Timeline */}
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-6">
          <h3 className="text-sm font-medium text-[#F0EDE8] mb-4">Execution History</h3>
          {analysis.executions && analysis.executions.length > 0 ? (
            <div className="space-y-3">
              {analysis.executions.map((exec) => (
                <div
                  key={exec.id}
                  className="flex items-center justify-between rounded-lg border border-[#2A2A2F] bg-[#1A1A1F] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={exec.status} />
                    <span className="text-xs text-[#8A857D]">
                      {formatDate(exec.created_at)}
                    </span>
                  </div>
                  {exec.completed_at && exec.started_at ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[#5A5650]">
                      <Clock className="h-3 w-3" />
                      {formatDuration(exec.started_at, exec.completed_at)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#5A5650] italic">No executions yet.</p>
          )}
        </div>
      </div>

      {/* Right column */}
      <div className="lg:col-span-1 space-y-6">
        {/* Selected Scores */}
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-6">
          <h3 className="text-sm font-medium text-[#F0EDE8] mb-3">Selected Scores</h3>
          <p className="text-xs text-[#5A5650] mb-3">
            {analysis.design_json.scoreIds.length} scores
          </p>
          <div className="flex flex-wrap gap-2">
            {analysis.design_json.scoreIds.map((scoreId) => (
              <span
                key={scoreId}
                className="inline-block rounded-md border border-[#2A2A2F] bg-[#1A1A1F] px-2 py-1 text-xs text-[#C5C0B8]"
              >
                {scoreId}
              </span>
            ))}
          </div>
        </div>

        {/* Cohort */}
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-6">
          <h3 className="text-sm font-medium text-[#F0EDE8] mb-3">Target Cohort</h3>
          <div className="space-y-2">
            {analysis.design_json.targetCohortIds.map((cohortId) => (
              <div
                key={cohortId}
                className="rounded-md border border-[#2A2A2F] bg-[#1A1A1F] px-3 py-2 text-xs text-[#C5C0B8]"
              >
                Cohort ID: {cohortId}
              </div>
            ))}
          </div>
        </div>

        {/* Author */}
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-6">
          <h3 className="text-sm font-medium text-[#F0EDE8] mb-3">Author</h3>
          <p className="text-sm text-[#C5C0B8]">
            {analysis.author?.name ?? "Unknown"}
          </p>
          {analysis.author?.email ? (
            <p className="text-xs text-[#8A857D] mt-1">{analysis.author.email}</p>
          ) : null}
          <p className="text-xs text-[#5A5650] mt-3">
            Created {formatDate(analysis.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}
