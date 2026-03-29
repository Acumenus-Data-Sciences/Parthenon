import { RefreshCw } from "lucide-react";
import type { RiskScoreAnalysis } from "../types/riskScore";
import { ANALYSIS_STATUS_COLORS } from "../types/riskScore";

interface ConfigurationTabProps {
  analysis: RiskScoreAnalysis;
  onReRun: () => void;
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: string, completedAt: string): string {
  const ms =
    new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function ConfigurationTab({
  analysis,
  onReRun,
}: ConfigurationTabProps) {
  const { design_json } = analysis;
  const executions = analysis.executions ?? [];

  return (
    <div className="space-y-6">
      {/* Design Panel */}
      <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-6">
        <h3 className="mb-4 text-sm font-medium text-[#E8E4DE]">
          Analysis Design
        </h3>

        <div className="space-y-4">
          {/* Target Cohorts */}
          <div>
            <span className="text-xs text-[#8A857D]">Target Cohorts</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {design_json.targetCohortIds.map((id) => (
                <span
                  key={id}
                  className="rounded-full bg-[#60A5FA]/10 px-2.5 py-0.5 text-xs font-medium text-[#60A5FA]"
                >
                  Cohort {id}
                </span>
              ))}
              {design_json.targetCohortIds.length === 0 && (
                <span className="text-xs text-[#5A5650]">None selected</span>
              )}
            </div>
          </div>

          {/* Selected Scores */}
          <div>
            <span className="text-xs text-[#8A857D]">Selected Scores</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {design_json.scoreIds.map((id) => (
                <span
                  key={id}
                  className="rounded-full bg-[#2DD4BF]/10 px-2.5 py-0.5 text-xs font-medium text-[#2DD4BF]"
                >
                  {id}
                </span>
              ))}
              {design_json.scoreIds.length === 0 && (
                <span className="text-xs text-[#5A5650]">None selected</span>
              )}
            </div>
          </div>

          {/* Parameters */}
          {(design_json.minCompleteness !== undefined ||
            design_json.storePatientLevel !== undefined) && (
            <div>
              <span className="text-xs text-[#8A857D]">Parameters</span>
              <div className="mt-1 space-y-1">
                {design_json.minCompleteness !== undefined && (
                  <div className="flex items-center gap-2 text-xs text-[#C5C0B8]">
                    <span className="text-[#5A5650]">Min Completeness:</span>
                    <span className="font-['IBM_Plex_Mono',monospace]">
                      {design_json.minCompleteness}
                    </span>
                  </div>
                )}
                {design_json.storePatientLevel !== undefined && (
                  <div className="flex items-center gap-2 text-xs text-[#C5C0B8]">
                    <span className="text-[#5A5650]">
                      Store Patient Level:
                    </span>
                    <span className="font-['IBM_Plex_Mono',monospace]">
                      {design_json.storePatientLevel ? "Yes" : "No"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Execution History Panel */}
      <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-6">
        <h3 className="mb-4 text-sm font-medium text-[#E8E4DE]">
          Execution History
        </h3>

        {executions.length === 0 ? (
          <p className="text-sm text-[#5A5650]">No executions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#2A2A2F] text-xs text-[#8A857D]">
                  <th className="pb-2 pr-4 font-medium">#</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Started</th>
                  <th className="pb-2 pr-4 font-medium">Duration</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {executions.map((execution, index) => {
                  const statusColor =
                    ANALYSIS_STATUS_COLORS[execution.status] ?? "#8A857D";
                  const duration =
                    execution.started_at && execution.completed_at
                      ? formatDuration(
                          execution.started_at,
                          execution.completed_at,
                        )
                      : "\u2014";

                  return (
                    <tr
                      key={execution.id}
                      className="border-b border-[#2A2A2F]/50 last:border-b-0"
                    >
                      <td className="py-2.5 pr-4 font-['IBM_Plex_Mono',monospace] text-xs text-[#5A5650]">
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
                          {execution.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-[#C5C0B8]">
                        {formatDatetime(execution.created_at)}
                      </td>
                      <td className="py-2.5 pr-4 font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                        {duration}
                      </td>
                      <td className="py-2.5">
                        <span className="text-xs text-[#5A5650]">
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

      {/* Re-run Button */}
      <button
        type="button"
        onClick={onReRun}
        className="flex items-center gap-2 rounded-lg bg-[#9B1B30] px-4 py-2 text-sm font-medium text-white hover:bg-[#B42240] transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Re-run Analysis
      </button>
    </div>
  );
}
