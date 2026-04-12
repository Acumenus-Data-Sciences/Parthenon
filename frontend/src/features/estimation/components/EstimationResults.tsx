import { Loader2, AlertCircle, Info } from "lucide-react";
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

  const parsed = parseResults(execution);
  const result = parsed ? normalizeResult(parsed) : null;
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
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <p className="text-xs font-medium text-[#8A857D]">Target Count</p>
          <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#2DD4BF]">
            {num(summary.target_count).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <p className="text-xs font-medium text-[#8A857D]">
            Comparator Count
          </p>
          <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#C9A227]">
            {num(summary.comparator_count).toLocaleString()}
          </p>
        </div>
        {Object.entries(summary.outcome_counts)
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
                {num(count).toLocaleString()}
              </p>
            </div>
          ))}
      </div>

      {/* Forest Plot */}
      {estimates.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">
            Forest Plot
          </h3>
          <ForestPlot estimates={estimates} />
        </div>
      )}

      {/* Estimates Table */}
      {estimates.length > 0 && (
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
              {estimates.map((est, i) => {
                const isSignificant = num(est.p_value) < 0.05;
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
                            ? num(est.hazard_ratio) < 1
                              ? "text-[#2DD4BF]"
                              : "text-[#E85A6B]"
                            : "text-[#C5C0B8]"
                        }
                      >
                        {fmt(est.hazard_ratio)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
                      {fmt(est.ci_95_lower, 2)} -{" "}
                      {fmt(est.ci_95_upper, 2)}
                    </td>
                    <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs">
                      <span
                        className={
                          isSignificant
                            ? "text-[#C9A227]"
                            : "text-[#5A5650]"
                        }
                      >
                        {num(est.p_value) < 0.001
                          ? "<0.001"
                          : fmt(est.p_value)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[#8A857D]">
                      {num(est.target_outcomes).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[#8A857D]">
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
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
          <h3 className="text-sm font-semibold text-[#F0EDE8]">
            Propensity Score Diagnostics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3">
              <p className="text-xs font-medium text-[#8A857D]">PS AUC</p>
              <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#2DD4BF]">
                {fmt(ps.auc)}
              </p>
            </div>
            <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3">
              <p className="text-xs font-medium text-[#8A857D]">
                Before Matching SMD
              </p>
              <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-sm text-[#C5C0B8]">
                Mean:{" "}
                {fmt(ps.mean_smd_before ?? ps.before_matching?.mean_smd ?? 0)}
              </p>
              <p className="font-['IBM_Plex_Mono',monospace] text-sm text-[#C5C0B8]">
                Max:{" "}
                {fmt(ps.max_smd_before ?? ps.before_matching?.max_smd ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3">
              <p className="text-xs font-medium text-[#8A857D]">
                After Matching SMD
              </p>
              <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-sm text-[#2DD4BF]">
                Mean:{" "}
                {fmt(ps.mean_smd_after ?? ps.after_matching?.mean_smd ?? 0)}
              </p>
              <p className="font-['IBM_Plex_Mono',monospace] text-sm text-[#2DD4BF]">
                Max:{" "}
                {fmt(ps.max_smd_after ?? ps.after_matching?.max_smd ?? 0)}
              </p>
            </div>
          </div>

          {/* PS Distribution Plot */}
          {ps.distribution && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-[#8A857D] mb-3">
                Propensity Score Distribution
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
          <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
            <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">
              Kaplan-Meier Survival Curves
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
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">
            Attrition Diagram
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
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">
            Covariate Balance — Love Plot
          </h3>
          <LovePlot data={covBalance} />
        </div>
      )}

      {/* Covariate Balance Table */}
      {covBalance && covBalance.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
          <div className="p-4 border-b border-[#232328]">
            <h3 className="text-sm font-semibold text-[#F0EDE8]">
              Top Covariate Balance (Before/After Matching)
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-[#1C1C20]">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Covariate
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  SMD Before
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  SMD After
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Balance
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
                      i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]"
                    }
                  >
                    <td className="px-4 py-2.5 text-xs text-[#C5C0B8] max-w-[200px] truncate">
                      {cv.covariate_name}
                    </td>
                    <td className="px-4 py-2.5 text-right font-['IBM_Plex_Mono',monospace] text-xs">
                      <span
                        className={
                          absBefore > 0.1
                            ? "text-[#E85A6B]"
                            : "text-[#8A857D]"
                        }
                      >
                        {fmt(cv.smd_before)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-['IBM_Plex_Mono',monospace] text-xs">
                      <span
                        className={
                          absAfter > 0.1
                            ? "text-[#E85A6B]"
                            : "text-[#2DD4BF]"
                        }
                      >
                        {fmt(cv.smd_after)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-2 rounded-full bg-[#0E0E11] relative">
                          <div
                            className="absolute top-0 h-full rounded-full bg-[#E85A6B] opacity-40"
                            style={{ width: `${Math.min(beforeWidth, 100)}%` }}
                          />
                          <div
                            className="absolute top-0 h-full rounded-full bg-[#2DD4BF]"
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
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">
            Empirical Calibration — Systematic Error
          </h3>
          <div className="flex justify-center">
            <SystematicErrorPlot negativeControls={negControls} />
          </div>
        </div>
      )}

      {/* Power Analysis Table */}
      {result.power_analysis && result.power_analysis.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">
            Statistical Power Analysis
          </h3>
          <PowerTable entries={result.power_analysis} />
        </div>
      )}

      {/* Diagnostics / MDRR */}
      {(result.diagnostics || mdrr || ps?.equipoise) && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
          <h3 className="text-sm font-semibold text-[#F0EDE8]">
            Diagnostics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(result.diagnostics?.equipoise ?? ps?.equipoise) != null && (
              <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3">
                <p className="text-xs font-medium text-[#8A857D]">Equipoise</p>
                <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#C9A227]">
                  {fmt(result.diagnostics?.equipoise ?? ps?.equipoise ?? 0)}
                </p>
              </div>
            )}
            {mdrr && Object.keys(mdrr).length > 0 && (
              <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3">
                <p className="text-xs font-medium text-[#8A857D]">
                  Min Detectable Relative Risk
                </p>
                <div className="mt-1 space-y-1">
                  {Object.entries(mdrr).map(([outcomeId, mdrr]) => (
                    <div
                      key={outcomeId}
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs text-[#8A857D]">
                        Outcome {outcomeId}
                      </span>
                      <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                        {fmt(mdrr)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.diagnostics?.power && (
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
