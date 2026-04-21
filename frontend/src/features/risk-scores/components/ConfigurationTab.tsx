import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RiskScoreAnalysis } from "../types/riskScore";
import { ANALYSIS_STATUS_COLORS } from "../types/riskScore";
import {
  formatRiskScoreDate,
  formatRiskScoreDuration,
  getRiskScoreStatusLabel,
} from "../lib/i18n";

interface ConfigurationTabProps {
  analysis: RiskScoreAnalysis;
  onReRun: () => void;
}

export function ConfigurationTab({
  analysis,
  onReRun,
}: ConfigurationTabProps) {
  const { t, i18n } = useTranslation("app");
  const { design_json } = analysis;
  const executions = analysis.executions ?? [];

  const datetimeOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border-default bg-surface-raised p-6">
        <h3 className="mb-4 text-sm font-medium text-text-primary">
          {t("riskScores.configuration.analysisDesign")}
        </h3>

        <div className="space-y-4">
          <div>
            <span className="text-xs text-text-muted">
              {t("riskScores.configuration.targetCohorts")}
            </span>
            <div className="mt-1 flex flex-wrap gap-2">
              {design_json.targetCohortIds.map((id) => (
                <span
                  key={id}
                  className="rounded-full bg-info/10 px-2.5 py-0.5 text-xs font-medium text-info"
                >
                  {t("riskScores.common.count.cohort", { count: 1 })} {id}
                </span>
              ))}
              {design_json.targetCohortIds.length === 0 && (
                <span className="text-xs text-text-ghost">
                  {t("riskScores.common.values.noneSelected")}
                </span>
              )}
            </div>
          </div>

          <div>
            <span className="text-xs text-text-muted">
              {t("riskScores.configuration.selectedScores")}
            </span>
            <div className="mt-1 flex flex-wrap gap-2">
              {design_json.scoreIds.map((id) => (
                <span
                  key={id}
                  className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"
                >
                  {id}
                </span>
              ))}
              {design_json.scoreIds.length === 0 && (
                <span className="text-xs text-text-ghost">
                  {t("riskScores.common.values.noneSelected")}
                </span>
              )}
            </div>
          </div>

          {(design_json.minCompleteness !== undefined ||
            design_json.storePatientLevel !== undefined) && (
            <div>
              <span className="text-xs text-text-muted">
                {t("riskScores.configuration.parameters")}
              </span>
              <div className="mt-1 space-y-1">
                {design_json.minCompleteness !== undefined && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <span className="text-text-ghost">
                      {t("riskScores.configuration.minCompleteness")}
                    </span>
                    <span className="font-['IBM_Plex_Mono',monospace]">
                      {design_json.minCompleteness}
                    </span>
                  </div>
                )}
                {design_json.storePatientLevel !== undefined && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <span className="text-text-ghost">
                      {t("riskScores.configuration.storePatientLevel")}
                    </span>
                    <span className="font-['IBM_Plex_Mono',monospace]">
                      {design_json.storePatientLevel
                        ? t("riskScores.common.values.yes")
                        : t("riskScores.common.values.no")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-raised p-6">
        <h3 className="mb-4 text-sm font-medium text-text-primary">
          {t("riskScores.configuration.executionHistory")}
        </h3>

        {executions.length === 0 ? (
          <p className="text-sm text-text-ghost">
            {t("riskScores.configuration.noExecutionsYet")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-default text-xs text-text-muted">
                  <th className="pb-2 pr-4 font-medium">
                    {t("riskScores.common.headers.number")}
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    {t("riskScores.common.headers.status")}
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    {t("riskScores.common.headers.started")}
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    {t("riskScores.common.headers.duration")}
                  </th>
                  <th className="pb-2 font-medium">
                    {t("riskScores.common.headers.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {executions.map((execution, index) => {
                  const statusColor =
                    ANALYSIS_STATUS_COLORS[execution.status] ?? "var(--text-muted)";
                  const duration =
                    execution.started_at && execution.completed_at
                      ? formatRiskScoreDuration(
                          t,
                          new Date(execution.completed_at).getTime() -
                            new Date(execution.started_at).getTime(),
                        )
                      : "\u2014";

                  return (
                    <tr
                      key={execution.id}
                      className="border-b border-border-default/50 last:border-b-0"
                    >
                      <td className="py-2.5 pr-4 font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">
                        {index + 1}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: `${statusColor}15`,
                            color: statusColor,
                          }}
                        >
                          {getRiskScoreStatusLabel(t, execution.status)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-text-secondary">
                        {formatRiskScoreDate(
                          i18n.resolvedLanguage,
                          execution.created_at,
                          datetimeOptions,
                        )}
                      </td>
                      <td className="py-2.5 pr-4 font-['IBM_Plex_Mono',monospace] text-xs text-text-secondary">
                        {duration}
                      </td>
                      <td className="py-2.5">
                        <span className="text-xs text-text-ghost">
                          #{index + 1}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onReRun}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-light"
      >
        <RefreshCw className="h-4 w-4" />
        {t("riskScores.common.actions.reRunAnalysis")}
      </button>
    </div>
  );
}
