import { Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RiskScoreAnalysis } from "../types/riskScore";
import { ANALYSIS_STATUS_COLORS } from "../types/riskScore";
import {
  formatRiskScoreDate,
  getRiskScoreStatusLabel,
} from "../lib/i18n";

interface RiskScoreAnalysisCardProps {
  analysis: RiskScoreAnalysis;
  onClick: () => void;
}

export function RiskScoreAnalysisCard({
  analysis,
  onClick,
}: RiskScoreAnalysisCardProps) {
  const { t, i18n } = useTranslation("app");
  const latestExecution = analysis.executions?.[0];
  const status = latestExecution?.status ?? "draft";
  const statusColor = ANALYSIS_STATUS_COLORS[status] ?? "var(--text-muted)";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-lg border border-border-default bg-surface-raised p-5 text-left transition-all hover:border-success/30 hover:bg-surface-overlay"
    >
      <h3 className="mb-2 line-clamp-2 text-sm font-semibold leading-snug text-text-primary transition-colors group-hover:text-success">
        {analysis.name}
      </h3>

      {analysis.description ? (
        <p className="mb-3 line-clamp-2 text-xs text-text-muted">
          {analysis.description}
        </p>
      ) : (
        <p className="mb-3 flex items-center gap-1 line-clamp-2 text-xs italic text-text-ghost">
          <Activity className="h-3 w-3" />
          {t("riskScores.common.values.noDescription")}
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
          {t("riskScores.common.count.score", {
            count: analysis.design_json.scoreIds.length,
          })}
        </span>
        <span className="inline-flex items-center rounded bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info">
          {t("riskScores.common.count.cohort", {
            count: analysis.design_json.targetCohortIds.length,
          })}
        </span>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor: `${statusColor}15`,
            color: statusColor,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: statusColor }}
          />
          {getRiskScoreStatusLabel(t, status)}
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border-default pt-3">
        <div className="flex items-center gap-1.5">
          {analysis.author ? (
            <span className="text-[11px] text-text-muted">
              {analysis.author.name}
            </span>
          ) : null}
        </div>
        <span className="text-[11px] text-text-ghost">
          {formatRiskScoreDate(i18n.resolvedLanguage, analysis.created_at, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
    </button>
  );
}
