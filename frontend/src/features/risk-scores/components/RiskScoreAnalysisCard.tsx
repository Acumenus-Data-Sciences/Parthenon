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
  const statusColor = ANALYSIS_STATUS_COLORS[status] ?? "#8A857D";

  const scoreCount = analysis.design_json.scoreIds.length;
  const cohortCount = analysis.design_json.targetCohortIds.length;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col text-left rounded-lg border border-[#232328] bg-[#151518] p-5 hover:border-[#2DD4BF]/30 hover:bg-[#1C1C20] transition-all group"
    >
      {/* Name */}
      <h3 className="text-sm font-semibold text-[#F0EDE8] leading-snug line-clamp-2 mb-2 group-hover:text-[#2DD4BF] transition-colors">
        {analysis.name}
      </h3>

      {/* Description */}
      {analysis.description ? (
        <p className="text-xs text-[#8A857D] line-clamp-2 mb-3">
          {analysis.description}
        </p>
      ) : (
        <p className="text-xs text-[#5A5650] italic line-clamp-2 mb-3 flex items-center gap-1">
          <Activity className="w-3 h-3" />
          No description
        </p>
      )}

      {/* Score count + Cohort count badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/10 text-[#2DD4BF]">
          {scoreCount} {scoreCount === 1 ? "score" : "scores"}
        </span>
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#60A5FA]/10 text-[#60A5FA]">
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
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#232328]">
        <div className="flex items-center gap-1.5">
          {analysis.author ? (
            <span className="text-[11px] text-[#8A857D]">
              {analysis.author.name}
            </span>
          ) : null}
        </div>
        <span className="text-[11px] text-[#5A5650]">
          {formatDate(analysis.created_at)}
        </span>
      </div>
    </button>
  );
}
