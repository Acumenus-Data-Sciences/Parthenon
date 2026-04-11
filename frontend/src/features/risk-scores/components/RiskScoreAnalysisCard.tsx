import { Activity } from "lucide-react";
import type { RiskScoreAnalysis } from "../types/riskScore";
import { ANALYSIS_STATUS_COLORS } from "../types/riskScore";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface RiskScoreAnalysisCardProps {
  analysis: RiskScoreAnalysis;
  onClick: () => void;
}

export function RiskScoreAnalysisCard({
  analysis,
  onClick,
}: RiskScoreAnalysisCardProps) {
  const latestExecution = analysis.executions?.[0];
  const status = latestExecution?.status ?? "draft";
  const statusColor = ANALYSIS_STATUS_COLORS[status] ?? "var(--text-muted)";

  const scoreCount = analysis.design_json.scoreIds.length;
  const cohortCount = analysis.design_json.targetCohortIds.length;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col text-left rounded-lg border border-border-default bg-surface-raised p-5 hover:border-success/30 hover:bg-surface-overlay transition-all group"
    >
      {/* Name */}
      <h3 className="text-sm font-semibold text-text-primary leading-snug line-clamp-2 mb-2 group-hover:text-success transition-colors">
        {analysis.name}
      </h3>

      {/* Description */}
      {analysis.description ? (
        <p className="text-xs text-text-muted line-clamp-2 mb-3">
          {analysis.description}
        </p>
      ) : (
        <p className="text-xs text-text-ghost italic line-clamp-2 mb-3 flex items-center gap-1">
          <Activity className="w-3 h-3" />
          No description
        </p>
      )}

      {/* Score count + Cohort count badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-success/10 text-success">
          {scoreCount} {scoreCount === 1 ? "score" : "scores"}
        </span>
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-info/10 text-info">
          {cohortCount} {cohortCount === 1 ? "cohort" : "cohorts"}
        </span>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor: `${statusColor}15`,
            color: statusColor,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: statusColor }}
          />
          {status}
        </span>
      </div>

      {/* Footer: Author + Date */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-border-default">
        <div className="flex items-center gap-1.5">
          {analysis.author ? (
            <span className="text-[11px] text-text-muted">
              {analysis.author.name}
            </span>
          ) : null}
        </div>
        <span className="text-[11px] text-text-ghost">
          {formatDate(analysis.created_at)}
        </span>
      </div>
    </button>
  );
}
