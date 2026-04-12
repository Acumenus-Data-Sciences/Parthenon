import { Loader2, AlertCircle, Info } from "lucide-react";
import { RocCurve } from "./RocCurve";
import { CalibrationPlot } from "./CalibrationPlot";
import { PrecisionRecallCurve } from "./PrecisionRecallCurve";
import { DiscriminationBoxPlot } from "./DiscriminationBoxPlot";
import { NetBenefitCurve } from "./NetBenefitCurve";
import { PredictionDistribution } from "./PredictionDistribution";
import { ExternalValidationComparison } from "./ExternalValidationComparison";
import { PredictionVerdictDashboard } from "./PredictionVerdictDashboard";
import type { AnalysisExecution } from "@/features/analyses/types/analysis";
import type { PredictionResult } from "../types/prediction";
import { fmt, num } from "@/lib/formatters";

interface PredictionResultsProps {
  execution?: AnalysisExecution | null;
  isLoading?: boolean;
}

function normalizeResult(result: PredictionResult): PredictionResult {
  return {
    ...result,
    summary: {
      target_count: result.summary?.target_count ?? 0,
      outcome_count: result.summary?.outcome_count ?? 0,
      outcome_rate: result.summary?.outcome_rate ?? 0,
    },
    performance: {
      auc: result.performance?.auc ?? 0,
      auc_ci_lower: result.performance?.auc_ci_lower ?? 0,
      auc_ci_upper: result.performance?.auc_ci_upper ?? 0,
      brier_score: result.performance?.brier_score ?? 0,
      calibration_slope: result.performance?.calibration_slope ?? 0,
      calibration_intercept: result.performance?.calibration_intercept ?? 0,
      auprc: result.performance?.auprc,
    },
    top_predictors: Array.isArray(result.top_predictors)
      ? result.top_predictors.map((predictor, index) => ({
          covariate_name:
            predictor?.covariate_name ?? `Predictor ${index + 1}`,
          coefficient: predictor?.coefficient ?? 0,
          importance: predictor?.importance ?? 0,
        }))
      : [],
    roc_curve: Array.isArray(result.roc_curve) ? result.roc_curve : [],
    precision_recall_curve: Array.isArray(result.precision_recall_curve)
      ? result.precision_recall_curve
      : [],
    calibration: Array.isArray(result.calibration) ? result.calibration : [],
    discrimination: result.discrimination
      ? {
          outcome_group: {
            min: result.discrimination.outcome_group?.min ?? 0,
            q1: result.discrimination.outcome_group?.q1 ?? 0,
            median: result.discrimination.outcome_group?.median ?? 0,
            q3: result.discrimination.outcome_group?.q3 ?? 0,
            max: result.discrimination.outcome_group?.max ?? 0,
            mean: result.discrimination.outcome_group?.mean ?? 0,
          },
          no_outcome_group: {
            min: result.discrimination.no_outcome_group?.min ?? 0,
            q1: result.discrimination.no_outcome_group?.q1 ?? 0,
            median: result.discrimination.no_outcome_group?.median ?? 0,
            q3: result.discrimination.no_outcome_group?.q3 ?? 0,
            max: result.discrimination.no_outcome_group?.max ?? 0,
            mean: result.discrimination.no_outcome_group?.mean ?? 0,
          },
        }
      : undefined,
    net_benefit: Array.isArray(result.net_benefit) ? result.net_benefit : [],
    prediction_distribution: Array.isArray(result.prediction_distribution)
      ? result.prediction_distribution
      : [],
    external_validation: Array.isArray(result.external_validation)
      ? result.external_validation.map((validation, index) => ({
          ...validation,
          database_name: validation?.database_name ?? `Validation ${index + 1}`,
          auc: validation?.auc ?? 0,
          auc_ci_lower: validation?.auc_ci_lower ?? 0,
          auc_ci_upper: validation?.auc_ci_upper ?? 0,
          brier_score: validation?.brier_score ?? 0,
          calibration_slope: validation?.calibration_slope ?? 0,
          calibration_intercept: validation?.calibration_intercept ?? 0,
          population_size: validation?.population_size ?? 0,
          outcome_count: validation?.outcome_count ?? 0,
        }))
      : [],
  };
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
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (!execution || execution.status !== "completed") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <AlertCircle size={24} className="text-text-ghost mb-3" />
        <h3 className="text-sm font-semibold text-text-primary">
          No results available
        </h3>
        <p className="mt-1 text-xs text-text-muted">
          {execution
            ? `Execution status: ${execution.status}`
            : "Execute the analysis to generate results."}
        </p>
        {execution?.fail_message && (
          <p className="mt-2 text-xs text-critical max-w-md text-center">
            {execution.fail_message}
          </p>
        )}
      </div>
    );
  }

  const parsed = parseResults(execution);
  const result = parsed ? normalizeResult(parsed) : null;
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <AlertCircle size={24} className="text-text-ghost mb-3" />
        <p className="text-sm text-text-muted">
          Execution completed but no results were returned.
        </p>
      </div>
    );
  }

  // R sidecar not implemented yet
  if (result.status === "r_not_implemented") {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
          <Info size={18} className="text-accent shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-accent">
              R Sidecar Pending
            </h3>
            <p className="mt-1 text-xs text-text-muted">
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
      {/* Verdict Dashboard */}
      <PredictionVerdictDashboard result={result} />

      {/* Performance Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <p className="text-xs font-medium text-text-muted">AUC</p>
          <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-success">
            {fmt(result.performance.auc)}
          </p>
          <p className="text-[10px] text-text-ghost">
            {fmt(result.performance.auc_ci_lower)} -{" "}
            {fmt(result.performance.auc_ci_upper)}
          </p>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <p className="text-xs font-medium text-text-muted">Brier Score</p>
          <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-accent">
            {fmt(result.performance.brier_score, 4)}
          </p>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <p className="text-xs font-medium text-text-muted">
            Calibration Slope
          </p>
          <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-text-primary">
            {fmt(result.performance.calibration_slope)}
          </p>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <p className="text-xs font-medium text-text-muted">
            Calibration Intercept
          </p>
          <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-text-primary">
            {fmt(result.performance.calibration_intercept)}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4">
        <div className="flex items-center gap-8">
          <div>
            <p className="text-xs font-medium text-text-muted">
              Target Population
            </p>
            <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-success">
              {num(result.summary.target_count).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted">
              Outcome Count
            </p>
            <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-accent">
              {num(result.summary.outcome_count).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted">
              Outcome Rate
            </p>
            <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-text-primary">
              {fmt(num(result.summary.outcome_rate) * 100, 2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ROC Curve */}
        {result.roc_curve && result.roc_curve.length > 0 && (
          <div className="rounded-lg border border-border-default bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              ROC Curve
            </h3>
            <div className="flex justify-center">
              <RocCurve
                data={result.roc_curve}
                auc={num(result.performance.auc)}
              />
            </div>
          </div>
        )}

        {/* Calibration Plot */}
        {result.calibration && result.calibration.length > 0 && (
          <div className="rounded-lg border border-border-default bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              Calibration Plot
            </h3>
            <div className="flex justify-center">
              <CalibrationPlot
                data={result.calibration}
                slope={num(result.performance.calibration_slope)}
                intercept={num(result.performance.calibration_intercept)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Precision-Recall & Discrimination */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {result.precision_recall_curve && result.precision_recall_curve.length > 0 && (
          <div className="rounded-lg border border-border-default bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Precision-Recall Curve</h3>
            <div className="flex justify-center">
              <PrecisionRecallCurve data={result.precision_recall_curve} auprc={num(result.performance.auprc)} />
            </div>
          </div>
        )}
        {result.discrimination && (
          <div className="rounded-lg border border-border-default bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Discrimination Box Plot</h3>
            <div className="flex justify-center">
              <DiscriminationBoxPlot outcomeGroup={result.discrimination.outcome_group} noOutcomeGroup={result.discrimination.no_outcome_group} />
            </div>
          </div>
        )}
      </div>

      {/* Decision Curve & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {result.net_benefit && result.net_benefit.length > 0 && (
          <div className="rounded-lg border border-border-default bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Decision Curve Analysis</h3>
            <div className="flex justify-center">
              <NetBenefitCurve data={result.net_benefit} />
            </div>
          </div>
        )}
        {result.prediction_distribution && result.prediction_distribution.length > 0 && (
          <div className="rounded-lg border border-border-default bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Prediction Distribution</h3>
            <div className="flex justify-center">
              <PredictionDistribution bins={result.prediction_distribution} />
            </div>
          </div>
        )}
      </div>

      {/* External Validation Comparison */}
      {result.external_validation && result.external_validation.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-4">External Validation Comparison</h3>
          <ExternalValidationComparison
            development={{
              database_name: "Development",
              auc: num(result.performance.auc),
              auc_ci_lower: num(result.performance.auc_ci_lower),
              auc_ci_upper: num(result.performance.auc_ci_upper),
              brier_score: num(result.performance.brier_score),
              calibration_slope: num(result.performance.calibration_slope),
              calibration_intercept: num(result.performance.calibration_intercept),
              population_size: num(result.summary.target_count),
              outcome_count: num(result.summary.outcome_count),
            }}
            validations={result.external_validation}
          />
        </div>
      )}

      {/* Top Predictors */}
      {result.top_predictors && result.top_predictors.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
          <div className="p-4 border-b border-border-default">
            <h3 className="text-sm font-semibold text-text-primary">
              Top Predictors
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-surface-overlay">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Covariate
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Coefficient
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Importance
                </th>
              </tr>
            </thead>
            <tbody>
              {result.top_predictors.map((pred, i) => {
                const coeff = num(pred.coefficient);
                const imp = num(pred.importance);
                const maxImportance = Math.max(
                  ...result.top_predictors.map((p) =>
                    Math.abs(num(p.importance)),
                  ),
                );
                const barWidth =
                  maxImportance > 0
                    ? (Math.abs(imp) / maxImportance) * 100
                    : 0;

                return (
                  <tr
                    key={i}
                    className={
                      i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay"
                    }
                  >
                    <td className="px-4 py-3 text-sm text-text-primary">
                      {pred.covariate_name}
                    </td>
                    <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs">
                      <span
                        className={
                          coeff > 0
                            ? "text-critical"
                            : coeff < 0
                              ? "text-success"
                              : "text-text-muted"
                        }
                      >
                        {coeff > 0 ? "+" : ""}
                        {fmt(coeff, 4)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-surface-base">
                          <div
                            className="h-full rounded-full bg-success"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-text-muted w-12 text-right">
                          {fmt(imp)}
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
