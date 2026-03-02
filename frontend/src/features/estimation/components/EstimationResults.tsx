import { Loader2, AlertCircle, Info } from "lucide-react";
import { ForestPlot } from "./ForestPlot";
import type { AnalysisExecution } from "@/features/analyses/types/analysis";
import type { EstimationResult } from "../types/estimation";

interface EstimationResultsProps {
  execution?: AnalysisExecution | null;
  isLoading?: boolean;
}

function parseResults(
  execution: AnalysisExecution | null | undefined,
): EstimationResult | null {
  if (!execution?.result_json) return null;
  const json = execution.result_json;
  if (typeof json === "object" && "estimates" in json) {
    return json as unknown as EstimationResult;
  }
  if (typeof json === "object" && "status" in json) {
    return json as unknown as EstimationResult;
  }
  return null;
}

export function EstimationResults({
  execution,
  isLoading,
}: EstimationResultsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (!execution || execution.status !== "completed") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <AlertCircle size={24} className="text-[#323238] mb-3" />
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          No results available
        </h3>
        <p className="mt-1 text-xs text-[#8A857D]">
          {execution
            ? `Execution status: ${execution.status}`
            : "Execute the analysis to generate results."}
        </p>
        {execution?.fail_message && (
          <p className="mt-2 text-xs text-[#E85A6B] max-w-md text-center">
            {execution.fail_message}
          </p>
        )}
      </div>
    );
  }

  const result = parseResults(execution);
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <AlertCircle size={24} className="text-[#323238] mb-3" />
        <p className="text-sm text-[#8A857D]">
          Execution completed but no results were returned.
        </p>
      </div>
    );
  }

  // R sidecar not implemented yet
  if (result.status === "r_not_implemented") {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/5 p-4">
          <Info size={18} className="text-[#C9A227] shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-[#C9A227]">
              R Sidecar Pending
            </h3>
            <p className="mt-1 text-xs text-[#8A857D]">
              {result.message ||
                "The R execution environment is not yet available. Your study design has been validated and saved. Results will be available once the R sidecar is deployed."}
            </p>
          </div>
        </div>

        {result.design_validated && (
          <div className="rounded-lg border border-[#2DD4BF]/30 bg-[#2DD4BF]/5 p-4">
            <p className="text-xs font-medium text-[#2DD4BF]">
              Design validated successfully
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <p className="text-xs font-medium text-[#8A857D]">Target Count</p>
          <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#2DD4BF]">
            {result.summary.target_count.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <p className="text-xs font-medium text-[#8A857D]">
            Comparator Count
          </p>
          <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#C9A227]">
            {result.summary.comparator_count.toLocaleString()}
          </p>
        </div>
        {Object.entries(result.summary.outcome_counts)
          .slice(0, 2)
          .map(([name, count]) => (
            <div
              key={name}
              className="rounded-lg border border-[#232328] bg-[#151518] p-4"
            >
              <p className="text-xs font-medium text-[#8A857D] truncate">
                {name}
              </p>
              <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#F0EDE8]">
                {count.toLocaleString()}
              </p>
            </div>
          ))}
      </div>

      {/* Forest Plot */}
      {result.estimates.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">
            Forest Plot
          </h3>
          <ForestPlot estimates={result.estimates} />
        </div>
      )}

      {/* Estimates Table */}
      {result.estimates.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
          <div className="p-4 border-b border-[#232328]">
            <h3 className="text-sm font-semibold text-[#F0EDE8]">
              Effect Estimates
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-[#1C1C20]">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Outcome
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  HR
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  95% CI
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  P-value
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Target Events
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Comparator Events
                </th>
              </tr>
            </thead>
            <tbody>
              {result.estimates.map((est, i) => {
                const isSignificant = est.p_value < 0.05;
                return (
                  <tr
                    key={est.outcome_id}
                    className={
                      i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]"
                    }
                  >
                    <td className="px-4 py-3 text-sm text-[#F0EDE8]">
                      {est.outcome_name}
                    </td>
                    <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-sm">
                      <span
                        className={
                          isSignificant
                            ? est.hazard_ratio < 1
                              ? "text-[#2DD4BF]"
                              : "text-[#E85A6B]"
                            : "text-[#C5C0B8]"
                        }
                      >
                        {est.hazard_ratio.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
                      {est.ci_95_lower.toFixed(2)} -{" "}
                      {est.ci_95_upper.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs">
                      <span
                        className={
                          isSignificant
                            ? "text-[#C9A227]"
                            : "text-[#5A5650]"
                        }
                      >
                        {est.p_value < 0.001
                          ? "<0.001"
                          : est.p_value.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[#8A857D]">
                      {est.target_outcomes.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[#8A857D]">
                      {est.comparator_outcomes.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Propensity Score */}
      {result.propensity_score && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
          <h3 className="text-sm font-semibold text-[#F0EDE8]">
            Propensity Score Diagnostics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3">
              <p className="text-xs font-medium text-[#8A857D]">PS AUC</p>
              <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#2DD4BF]">
                {result.propensity_score.auc.toFixed(3)}
              </p>
            </div>
            <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3">
              <p className="text-xs font-medium text-[#8A857D]">
                Before Matching SMD
              </p>
              <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-sm text-[#C5C0B8]">
                Mean:{" "}
                {result.propensity_score.before_matching.mean_smd.toFixed(3)}
              </p>
              <p className="font-['IBM_Plex_Mono',monospace] text-sm text-[#C5C0B8]">
                Max:{" "}
                {result.propensity_score.before_matching.max_smd.toFixed(3)}
              </p>
            </div>
            <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3">
              <p className="text-xs font-medium text-[#8A857D]">
                After Matching SMD
              </p>
              <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-sm text-[#2DD4BF]">
                Mean:{" "}
                {result.propensity_score.after_matching.mean_smd.toFixed(3)}
              </p>
              <p className="font-['IBM_Plex_Mono',monospace] text-sm text-[#2DD4BF]">
                Max:{" "}
                {result.propensity_score.after_matching.max_smd.toFixed(3)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics */}
      {result.diagnostics && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
          <h3 className="text-sm font-semibold text-[#F0EDE8]">
            Diagnostics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3">
              <p className="text-xs font-medium text-[#8A857D]">Equipoise</p>
              <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#C9A227]">
                {result.diagnostics.equipoise.toFixed(3)}
              </p>
            </div>
            <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3">
              <p className="text-xs font-medium text-[#8A857D]">
                Statistical Power
              </p>
              <div className="mt-1 space-y-1">
                {Object.entries(result.diagnostics.power).map(
                  ([name, power]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs text-[#8A857D] truncate max-w-[150px]">
                        {name}
                      </span>
                      <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                        {(power * 100).toFixed(1)}%
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
