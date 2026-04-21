import { useState, useMemo } from "react";
import { Loader2, AlertCircle, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { SccsTimeline } from "@/features/estimation/components/SccsTimeline";
import { SccsVerdictDashboard, InlineMiniForestPlot } from "./SccsVerdictDashboard";
import type { AnalysisExecution } from "@/features/analyses/types/analysis";
import type { SccsResult } from "../types/sccs";
import { fmt, num } from "@/lib/formatters";

interface SccsResultsProps {
  execution: AnalysisExecution | null;
  isLoading?: boolean;
}

type SortField = "covariate" | "irr";
type SortDir = "asc" | "desc";

export function SccsResults({ execution, isLoading }: SccsResultsProps) {
  const { t } = useTranslation("app");
  const [sortField, setSortField] = useState<SortField>("irr");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="text-center py-12 text-text-ghost text-sm">
        {t("analyses.auto.noExecutionSelectedRunTheAnalysisToSeeResults_cb09f9")}
      </div>
    );
  }

  if (execution.status === "running" || execution.status === "queued" || execution.status === "pending") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 size={24} className="animate-spin text-success" />
        <p className="text-sm text-text-muted">
          {t("analyses.auto.sCCSAnalysisIs_c68ce9", {
            status: execution.status,
          })}
        </p>
      </div>
    );
  }

  if (execution.status === "failed") {
    return (
      <div className="rounded-lg border border-critical/30 bg-critical/5 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-critical shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-critical">{t("analyses.auto.executionFailed_d0cb03")}</p>
            <p className="text-xs text-text-muted mt-1">
              {execution.fail_message ?? t("analyses.auto.unknownError_aee978")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const result = execution.result_json as unknown as SccsResult | null;

  if (!result || result.status !== "completed") {
    return (
      <div className="text-center py-12 text-text-ghost text-sm">
        {result?.message ?? t("analyses.auto.noResultsAvailable_e29de7")}
      </div>
    );
  }

  return (
    <SccsResultsContent
      result={result}
      sortField={sortField}
      sortDir={sortDir}
      toggleSort={toggleSort}
    />
  );
}

// ---------------------------------------------------------------------------
// Inner content component (avoids conditional hook calls)
// ---------------------------------------------------------------------------

function SccsResultsContent({
  result,
  sortField,
  sortDir,
  toggleSort,
}: {
  result: SccsResult;
  sortField: SortField;
  sortDir: SortDir;
  toggleSort: (field: SortField) => void;
}) {
  const { t } = useTranslation("app");
  const sortedEstimates = useMemo(() => {
    if (!result.estimates || result.estimates.length === 0) return [];
    const sorted = [...result.estimates].sort((a, b) => {
      if (sortField === "irr") {
        return num(a.irr) - num(b.irr);
      }
      return a.covariate.localeCompare(b.covariate);
    });
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [result.estimates, sortField, sortDir]);

  return (
    <div className="space-y-6">
      {/* Verdict Dashboard — above all existing content */}
      <SccsVerdictDashboard result={result} />

      {/* Population Summary */}
      {result.population && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t("analyses.auto.cases_b1f0b8"), value: result.population.cases },
            { label: t("analyses.auto.outcomes_d08355"), value: result.population.outcomes },
            {
              label: t("analyses.auto.observationPeriods_6ee256"),
              value: result.population.observation_periods,
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-border-default bg-surface-raised p-4 text-center"
            >
              <p className="text-2xl font-bold text-text-primary">
                {num(card.value).toLocaleString()}
              </p>
              <p className="text-xs text-text-muted mt-1">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Enhanced IRR Estimates Table */}
      {sortedEstimates.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
          <div className="p-4 border-b border-border-default">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("analyses.auto.incidenceRateRatios_2b6445")}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default">
                  <th
                    className="px-4 py-2 text-left text-xs font-medium text-text-muted cursor-pointer hover:text-text-primary select-none"
                    onClick={() => toggleSort("covariate")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {t("analyses.auto.covariate_51b9fe")}
                      <ArrowUpDown size={12} className="opacity-50" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-2 text-left text-xs font-medium text-text-muted cursor-pointer hover:text-text-primary select-none"
                    onClick={() => toggleSort("irr")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {t("analyses.auto.iRR_eaa16a")}
                      <ArrowUpDown size={12} className="opacity-50" />
                    </span>
                  </th>
                  {[
                    t("analyses.auto.95CILower_3d16ad"),
                    t("analyses.auto.95CIUpper_7d61ea"),
                    t("analyses.auto.logRR_0b9483"),
                    "SE",
                    "",
                  ].map((h) => (
                    <th key={h || "forest"} className="px-4 py-2 text-left text-xs font-medium text-text-muted">
                      {h || t("analyses.auto.forestPlot_38213b")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedEstimates.map((est, idx) => (
                  <tr key={idx} className="border-b border-border-default last:border-0">
                    <td className="px-4 py-2 text-text-primary">{est.covariate}</td>
                    <td className={cn(
                      "px-4 py-2 font-mono font-semibold",
                      num(est.irr) > 1 ? "text-critical" : num(est.irr) < 1 ? "text-success" : "text-text-primary",
                    )}>
                      {fmt(est.irr)}
                    </td>
                    <td className="px-4 py-2 font-mono text-text-muted">{fmt(est.ci_lower)}</td>
                    <td className="px-4 py-2 font-mono text-text-muted">{fmt(est.ci_upper)}</td>
                    <td className="px-4 py-2 font-mono text-text-muted">{fmt(est.log_rr, 4)}</td>
                    <td className="px-4 py-2 font-mono text-text-muted">{fmt(est.se_log_rr, 4)}</td>
                    <td className="px-4 py-2">
                      <InlineMiniForestPlot
                        irr={num(est.irr)}
                        ciLower={est.ci_lower != null ? num(est.ci_lower) : undefined}
                        ciUpper={est.ci_upper != null ? num(est.ci_upper) : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SCCS Era Timeline */}
      {result.eras && result.eras.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            {t("analyses.auto.riskWindowTimeline_f301f1")}
          </h3>
          <div className="flex justify-center">
            <SccsTimeline eras={result.eras} />
          </div>
        </div>
      )}

      {/* Execution Info */}
      {result.elapsed_seconds != null && (
        <p className="text-xs text-text-ghost">
          {t("analyses.auto.completedIn_d9d00a")} {fmt(result.elapsed_seconds, 1)}s
        </p>
      )}
    </div>
  );
}
