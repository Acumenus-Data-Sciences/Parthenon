import { Loader2, AlertCircle, Info } from "lucide-react";
import { RocCurve } from "./RocCurve";
import { CalibrationPlot } from "./CalibrationPlot";
import { PrecisionRecallCurve } from "./PrecisionRecallCurve";
import { DiscriminationBoxPlot } from "./DiscriminationBoxPlot";
import { NetBenefitCurve } from "./NetBenefitCurve";
import { PredictionDistribution } from "./PredictionDistribution";
import type { AnalysisExecution } from "@/features/analyses/types/analysis";
import type { PredictionResult } from "../types/prediction";

interface PredictionResultsProps {
  execution?: AnalysisExecution | null;
  isLoading?: boolean;
}

function parseResults(
  execution: AnalysisExecution | null | undefined,
): PredictionResult | null {
  if (!execution?.result_json) return null;
  const json = execution.result_json;
  if (typeof json === "object" && "performance" in json) {
    return json as unknown as PredictionResult;
  }
  if (typeof json === "object" && "status" in json) {
    return json as unknown as PredictionResult;
  }
  return null;
}

export function PredictionResults({
  execution,
  isLoading,
}: PredictionResultsProps) {
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
                "The R/Python execution environment is not yet available. Your prediction model design has been validated and saved. Results will be available once the compute sidecar is deployed."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <p className="text-xs font-medium text-[#8A857D]">AUC</p>
          <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#2DD4BF]">
            {result.performance.auc.toFixed(3)}
          </p>
          <p className="text-[10px] text-[#5A5650]">
            {result.performance.auc_ci_lower.toFixed(3)} -{" "}
            {result.performance.auc_ci_upper.toFixed(3)}
          </p>
        </div>
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <p className="text-xs font-medium text-[#8A857D]">Brier Score</p>
          <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#C9A227]">
            {result.performance.brier_score.toFixed(4)}
          </p>
        </div>
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <p className="text-xs font-medium text-[#8A857D]">
            Calibration Slope
          </p>
          <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#F0EDE8]">
            {result.performance.calibration_slope.toFixed(3)}
          </p>
        </div>
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <p className="text-xs font-medium text-[#8A857D]">
            Calibration Intercept
          </p>
          <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#F0EDE8]">
            {result.performance.calibration_intercept.toFixed(3)}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
        <div className="flex items-center gap-8">
          <div>
            <p className="text-xs font-medium text-[#8A857D]">
              Target Population
            </p>
            <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#2DD4BF]">
              {result.summary.target_count.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#8A857D]">
              Outcome Count
            </p>
            <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#C9A227]">
              {result.summary.outcome_count.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#8A857D]">
              Outcome Rate
            </p>
            <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#F0EDE8]">
              {(result.summary.outcome_rate * 100).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ROC Curve */}
        {result.roc_curve && result.roc_curve.length > 0 && (
          <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
            <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">
              ROC Curve
            </h3>
            <div className="flex justify-center">
              <RocCurve
                data={result.roc_curve}
                auc={result.performance.auc}
              />
            </div>
          </div>
        )}

        {/* Calibration Plot */}
        {result.calibration && result.calibration.length > 0 && (
          <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
            <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">
              Calibration Plot
            </h3>
            <div className="flex justify-center">
              <CalibrationPlot
                data={result.calibration}
                slope={result.performance.calibration_slope}
                intercept={result.performance.calibration_intercept}
              />
            </div>
          </div>
        )}
      </div>

      {/* Precision-Recall & Discrimination */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {result.precision_recall_curve && result.precision_recall_curve.length > 0 && (
          <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
            <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">Precision-Recall Curve</h3>
            <div className="flex justify-center">
              <PrecisionRecallCurve data={result.precision_recall_curve} auprc={result.performance.auprc ?? 0} />
            </div>
          </div>
        )}
        {result.discrimination && (
          <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
            <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">Discrimination Box Plot</h3>
            <div className="flex justify-center">
              <DiscriminationBoxPlot outcomeGroup={result.discrimination.outcome_group} noOutcomeGroup={result.discrimination.no_outcome_group} />
            </div>
          </div>
        )}
      </div>

      {/* Decision Curve & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {result.net_benefit && result.net_benefit.length > 0 && (
          <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
            <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">Decision Curve Analysis</h3>
            <div className="flex justify-center">
              <NetBenefitCurve data={result.net_benefit} />
            </div>
          </div>
        )}
        {result.prediction_distribution && result.prediction_distribution.length > 0 && (
          <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
            <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">Prediction Distribution</h3>
            <div className="flex justify-center">
              <PredictionDistribution bins={result.prediction_distribution} />
            </div>
          </div>
        )}
      </div>

      {/* Top Predictors */}
      {result.top_predictors && result.top_predictors.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
          <div className="p-4 border-b border-[#232328]">
            <h3 className="text-sm font-semibold text-[#F0EDE8]">
              Top Predictors
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-[#1C1C20]">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Covariate
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Coefficient
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Importance
                </th>
              </tr>
            </thead>
            <tbody>
              {result.top_predictors.map((pred, i) => {
                const maxImportance = Math.max(
                  ...result.top_predictors.map((p) =>
                    Math.abs(p.importance),
                  ),
                );
                const barWidth =
                  maxImportance > 0
                    ? (Math.abs(pred.importance) / maxImportance) * 100
                    : 0;

                return (
                  <tr
                    key={i}
                    className={
                      i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]"
                    }
                  >
                    <td className="px-4 py-3 text-sm text-[#F0EDE8]">
                      {pred.covariate_name}
                    </td>
                    <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs">
                      <span
                        className={
                          pred.coefficient > 0
                            ? "text-[#E85A6B]"
                            : pred.coefficient < 0
                              ? "text-[#2DD4BF]"
                              : "text-[#8A857D]"
                        }
                      >
                        {pred.coefficient > 0 ? "+" : ""}
                        {pred.coefficient.toFixed(4)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-[#0E0E11]">
                          <div
                            className="h-full rounded-full bg-[#2DD4BF]"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-[#8A857D] w-12 text-right">
                          {pred.importance.toFixed(3)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
