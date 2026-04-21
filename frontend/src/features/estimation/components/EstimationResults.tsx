import { Loader2, AlertCircle, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ForestPlot } from "./ForestPlot";
import { KaplanMeierPlot } from "./KaplanMeierPlot";
import { AttritionDiagram } from "./AttritionDiagram";
import { PropensityScorePlot } from "./PropensityScorePlot";
import { LovePlot } from "./LovePlot";
import { SystematicErrorPlot } from "./SystematicErrorPlot";
import { PowerTable } from "./PowerTable";
import { EstimationVerdictDashboard } from "./EstimationVerdictDashboard";
import type { AnalysisExecution } from "@/features/analyses/types/analysis";
import type { EstimationResult } from "../types/estimation";

import { fmt, num } from "@/lib/formatters";

interface EstimationResultsProps {
  execution?: AnalysisExecution | null;
  isLoading?: boolean;
}

function normalizeResult(result: EstimationResult): EstimationResult {
  return {
    ...result,
    summary: {
      target_count: result.summary?.target_count ?? 0,
      comparator_count: result.summary?.comparator_count ?? 0,
      outcome_counts: result.summary?.outcome_counts ?? {},
    },
    estimates: Array.isArray(result.estimates) ? result.estimates : [],
    propensity_score: result.propensity_score
      ? {
          ...result.propensity_score,
          distribution: result.propensity_score.distribution
            ? {
                target: Array.isArray(result.propensity_score.distribution.target)
                  ? result.propensity_score.distribution.target
                  : [],
                comparator: Array.isArray(result.propensity_score.distribution.comparator)
                  ? result.propensity_score.distribution.comparator
                  : [],
              }
            : undefined,
        }
      : undefined,
    covariate_balance: Array.isArray(result.covariate_balance)
      ? result.covariate_balance
      : [],
    kaplan_meier: result.kaplan_meier
      ? {
          target: Array.isArray(result.kaplan_meier.target)
            ? result.kaplan_meier.target
            : [],
          comparator: Array.isArray(result.kaplan_meier.comparator)
            ? result.kaplan_meier.comparator
            : [],
        }
      : undefined,
    attrition: Array.isArray(result.attrition) ? result.attrition : [],
    mdrr:
      result.mdrr && typeof result.mdrr === "object" && !Array.isArray(result.mdrr)
        ? result.mdrr
        : {},
    negative_controls: Array.isArray(result.negative_controls)
      ? result.negative_controls
      : [],
    power_analysis: Array.isArray(result.power_analysis)
      ? result.power_analysis
      : [],
  };
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
  const { t } = useTranslation("app");
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
          {t("analyses.auto.noResultsAvailable_e29de7")}
        </h3>
        <p className="mt-1 text-xs text-text-muted">
          {execution
            ? t("analyses.auto.executionStatusStatus_540db0", {
                status: execution.status,
              })
            : t("analyses.auto.executeTheAnalysisToGenerateResults_a62421")}
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
          {t("analyses.auto.executionCompletedButNoResultsWereReturned_bc0318")}
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
              {t("analyses.auto.rSidecarPending_b8be5c")}
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              {result.message ||
                "The R execution environment is not yet available. Your study design has been validated and saved. Results will be available once the R sidecar is deployed."}
            </p>
          </div>
        </div>

        {result.design_validated && (
          <div className="rounded-lg border border-success/30 bg-success/5 p-4">
            <p className="text-xs font-medium text-success">
              {t("analyses.auto.designValidatedSuccessfully_ab70c9")}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Defensive: ensure all arrays/objects exist even if API returned partial results
  const estimates = result.estimates ?? [];
  const attrition = result.attrition ?? [];
  const km = result.kaplan_meier ?? { target: [], comparator: [] };
  const ps = result.propensity_score ?? {} as NonNullable<typeof result.propensity_score>;
  const covBalance = result.covariate_balance ?? [];
  const mdrr = result.mdrr ?? {};
  const negControls = result.negative_controls ?? [];
  const summary = result.summary ?? { target_count: 0, comparator_count: 0, outcome_counts: {} };

  return (
    <div className="space-y-6">
      {/* Verdict Dashboard */}
      {(estimates ?? []).length > 0 && (
        <EstimationVerdictDashboard result={result} />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <p className="text-xs font-medium text-text-muted">{t("analyses.auto.targetCount_27c467")}</p>
          <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-success">
            {num(summary.target_count).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <p className="text-xs font-medium text-text-muted">
            {t("analyses.auto.comparatorCount_595cfe")}
          </p>
          <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-accent">
            {num(summary.comparator_count).toLocaleString()}
          </p>
        </div>
        {Object.entries(summary.outcome_counts)
          .slice(0, 2)
          .map(([name, count]) => (
            <div
              key={name}
              className="rounded-lg border border-border-default bg-surface-raised p-4"
            >
              <p className="text-xs font-medium text-text-muted truncate">
                {name}
              </p>
              <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-text-primary">
                {num(count).toLocaleString()}
              </p>
            </div>
          ))}
      </div>

      {/* Forest Plot */}
      {estimates.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            {t("analyses.auto.forestPlot_38213b")}
          </h3>
          <ForestPlot estimates={estimates} />
        </div>
      )}

      {/* Estimates Table */}
      {estimates.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
          <div className="p-4 border-b border-border-default">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("analyses.auto.effectEstimates_1c8237")}
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-surface-overlay">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t("analyses.auto.outcome_cf73bd")}
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  HR
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t("analyses.auto.95CI_4009a0")}
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t("analyses.auto.pValue_925c64")}
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t("analyses.auto.targetEvents_4a3799")}
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t("analyses.auto.comparatorEvents_cf170f")}
                </th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((est, i) => {
                const isSignificant = num(est.p_value) < 0.05;
                return (
                  <tr
                    key={est.outcome_id}
                    className={
                      i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay"
                    }
                  >
                    <td className="px-4 py-3 text-sm text-text-primary">
                      {est.outcome_name}
                    </td>
                    <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-sm">
                      <span
                        className={
                          isSignificant
                            ? num(est.hazard_ratio) < 1
                              ? "text-success"
                              : "text-critical"
                            : "text-text-secondary"
                        }
                      >
                        {fmt(est.hazard_ratio)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
                      {fmt(est.ci_95_lower, 2)} -{" "}
                      {fmt(est.ci_95_upper, 2)}
                    </td>
                    <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs">
                      <span
                        className={
                          isSignificant
                            ? "text-accent"
                            : "text-text-ghost"
                        }
                      >
                        {num(est.p_value) < 0.001
                          ? "<0.001"
                          : fmt(est.p_value)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-text-muted">
                      {num(est.target_outcomes).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-text-muted">
                      {num(est.comparator_outcomes).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Propensity Score Diagnostics */}
      {ps && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">
            {t("analyses.auto.propensityScoreDiagnostics_eb4571")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border-default bg-surface-base p-3">
              <p className="text-xs font-medium text-text-muted">{t("analyses.auto.pSAUC_ef1041")}</p>
              <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-success">
                {fmt(ps.auc)}
              </p>
            </div>
            <div className="rounded-lg border border-border-default bg-surface-base p-3">
              <p className="text-xs font-medium text-text-muted">
                {t("analyses.auto.beforeMatchingSMD_ecee6e")}
              </p>
              <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-sm text-text-secondary">
                {t("analyses.auto.mean_66cdfc")}{" "}
                {fmt(ps.mean_smd_before ?? ps.before_matching?.mean_smd ?? 0)}
              </p>
              <p className="font-['IBM_Plex_Mono',monospace] text-sm text-text-secondary">
                {t("analyses.auto.max_9ace3e")}{" "}
                {fmt(ps.max_smd_before ?? ps.before_matching?.max_smd ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-border-default bg-surface-base p-3">
              <p className="text-xs font-medium text-text-muted">
                {t("analyses.auto.afterMatchingSMD_d36edd")}
              </p>
              <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-sm text-success">
                {t("analyses.auto.mean_66cdfc")}{" "}
                {fmt(ps.mean_smd_after ?? ps.after_matching?.mean_smd ?? 0)}
              </p>
              <p className="font-['IBM_Plex_Mono',monospace] text-sm text-success">
                {t("analyses.auto.max_9ace3e")}{" "}
                {fmt(ps.max_smd_after ?? ps.after_matching?.max_smd ?? 0)}
              </p>
            </div>
          </div>

          {/* PS Distribution Plot */}
          {ps.distribution && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-text-muted mb-3">
                {t("analyses.auto.propensityScoreDistribution_9394bd")}
              </h4>
              <PropensityScorePlot
                data={ps.distribution.target.map(
                  (t, i) => ({
                    score: t.x,
                    targetCount: t.y,
                    comparatorCount:
                      ps!.distribution!.comparator[i]?.y ?? 0,
                  }),
                )}
                auc={ps.auc}
              />
            </div>
          )}
        </div>
      )}

      {/* Kaplan-Meier Survival Curves */}
      {km &&
        km.target &&
        km.target.length > 0 && (
          <div className="rounded-lg border border-border-default bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              {t("analyses.auto.kaplanMeierSurvivalCurves_10e9c6")}
            </h3>
            <KaplanMeierPlot
              targetCurve={km.target.map((p) => ({
                time: p.time,
                surv: p.survival,
                survLower: p.lower,
                survUpper: p.upper,
                nAtRisk: 0,
                nEvents: 0,
                nCensored: 0,
              }))}
              comparatorCurve={(km.comparator ?? []).map(
                (p) => ({
                  time: p.time,
                  surv: p.survival,
                  survLower: p.lower,
                  survUpper: p.upper,
                  nAtRisk: 0,
                  nEvents: 0,
                  nCensored: 0,
                }),
              )}
            />
          </div>
        )}

      {/* Attrition Diagram */}
      {attrition && attrition.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            {t("analyses.auto.attritionDiagram_a01d75")}
          </h3>
          <AttritionDiagram
            targetSteps={attrition.map((s) => ({
              description: s.step,
              subjectsCount: s.target,
            }))}
            comparatorSteps={attrition.map((s) => ({
              description: s.step,
              subjectsCount: s.comparator,
            }))}
          />
        </div>
      )}

      {/* Love Plot (Covariate Balance Scatter) */}
      {covBalance && covBalance.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            {t("analyses.auto.covariateBalanceLovePlot_dd27cc")}
          </h3>
          <LovePlot data={covBalance} />
        </div>
      )}

      {/* Covariate Balance Table */}
      {covBalance && covBalance.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
          <div className="p-4 border-b border-border-default">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("analyses.auto.topCovariateBalanceBeforeAfterMatching_965076")}
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-surface-overlay">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t("analyses.auto.covariate_51b9fe")}
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t("analyses.auto.sMDBefore_d1d70b")}
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t("analyses.auto.sMDAfter_946dc8")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t("analyses.auto.balance_99a808")}
                </th>
              </tr>
            </thead>
            <tbody>
              {covBalance.slice(0, 30).map((cv, i) => {
                const absBefore = Math.abs(cv.smd_before);
                const absAfter = Math.abs(cv.smd_after);
                const maxSmd = Math.max(
                  ...covBalance!.map((c) =>
                    Math.max(Math.abs(c.smd_before), Math.abs(c.smd_after)),
                  ),
                  0.1,
                );
                const beforeWidth = (absBefore / maxSmd) * 100;
                const afterWidth = (absAfter / maxSmd) * 100;

                return (
                  <tr
                    key={i}
                    className={
                      i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay"
                    }
                  >
                    <td className="px-4 py-2.5 text-xs text-text-secondary max-w-[200px] truncate">
                      {cv.covariate_name}
                    </td>
                    <td className="px-4 py-2.5 text-right font-['IBM_Plex_Mono',monospace] text-xs">
                      <span
                        className={
                          absBefore > 0.1
                            ? "text-critical"
                            : "text-text-muted"
                        }
                      >
                        {fmt(cv.smd_before)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-['IBM_Plex_Mono',monospace] text-xs">
                      <span
                        className={
                          absAfter > 0.1
                            ? "text-critical"
                            : "text-success"
                        }
                      >
                        {fmt(cv.smd_after)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-2 rounded-full bg-surface-base relative">
                          <div
                            className="absolute top-0 h-full rounded-full bg-critical opacity-40"
                            style={{ width: `${Math.min(beforeWidth, 100)}%` }}
                          />
                          <div
                            className="absolute top-0 h-full rounded-full bg-success"
                            style={{ width: `${Math.min(afterWidth, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Negative Control / Systematic Error Plot */}
      {negControls && negControls.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            {t("analyses.auto.empiricalCalibrationSystematicError_61fcf2")}
          </h3>
          <div className="flex justify-center">
            <SystematicErrorPlot negativeControls={negControls} />
          </div>
        </div>
      )}

      {/* Power Analysis Table */}
      {result.power_analysis && result.power_analysis.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            {t("analyses.auto.statisticalPowerAnalysis_03fb2a")}
          </h3>
          <PowerTable entries={result.power_analysis} />
        </div>
      )}

      {/* Diagnostics / MDRR */}
      {(result.diagnostics || mdrr || ps?.equipoise) && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">
            {t("analyses.auto.diagnostics_36b64a")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(result.diagnostics?.equipoise ?? ps?.equipoise) != null && (
              <div className="rounded-lg border border-border-default bg-surface-base p-3">
                <p className="text-xs font-medium text-text-muted">{t("analyses.auto.equipoise_e41807")}</p>
                <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-accent">
                  {fmt(result.diagnostics?.equipoise ?? ps?.equipoise ?? 0)}
                </p>
              </div>
            )}
            {mdrr && Object.keys(mdrr).length > 0 && (
              <div className="rounded-lg border border-border-default bg-surface-base p-3">
                <p className="text-xs font-medium text-text-muted">
                  {t("analyses.auto.minDetectableRelativeRisk_9ac488")}
                </p>
                <div className="mt-1 space-y-1">
                  {Object.entries(mdrr).map(([outcomeId, mdrr]) => (
                    <div
                      key={outcomeId}
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs text-text-muted">
                        {t("analyses.auto.outcome_cf73bd")} {outcomeId}
                      </span>
                      <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-secondary">
                        {fmt(mdrr)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.diagnostics?.power && (
              <div className="rounded-lg border border-border-default bg-surface-base p-3">
                <p className="text-xs font-medium text-text-muted">
                  {t("analyses.auto.statisticalPower_df6140")}
                </p>
                <div className="mt-1 space-y-1">
                  {Object.entries(result.diagnostics.power).map(
                    ([name, power]) => (
                      <div
                        key={name}
                        className="flex items-center justify-between"
                      >
                        <span className="text-xs text-text-muted truncate max-w-[150px]">
                          {name}
                        </span>
                        <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-secondary">
                          {fmt(num(power) * 100, 1)}%
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
