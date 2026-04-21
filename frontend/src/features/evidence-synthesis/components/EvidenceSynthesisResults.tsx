import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { AnalysisExecution } from "@/features/analyses/types/analysis";
import type { EvidenceSynthesisResult } from "../types/evidenceSynthesis";
import { ForestPlot } from "./ForestPlot";
import { EvidenceSynthesisVerdictDashboard } from "./EvidenceSynthesisVerdictDashboard";
import { fmt, num } from "@/lib/formatters";

interface EvidenceSynthesisResultsProps {
  execution: AnalysisExecution | null;
  isLoading?: boolean;
}

export function EvidenceSynthesisResults({
  execution,
  isLoading,
}: EvidenceSynthesisResultsProps) {
  const { t } = useTranslation("app");
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
          {t("analyses.auto.evidenceSynthesisIs_70665b", {
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

  const result = execution.result_json as unknown as EvidenceSynthesisResult | null;

  if (!result || result.status !== "completed") {
    return (
        <div className="text-center py-12 text-text-ghost text-sm">
        {result?.message ?? t("analyses.auto.noResultsAvailable_e29de7")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Verdict Dashboard */}
      <EvidenceSynthesisVerdictDashboard result={result} />

      {/* Pooled Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: t("analyses.auto.pooledHR_034d3e"),
            value: fmt(result.pooled.hr),
          },
          {
            label: t("analyses.auto.95CI_4009a0"),
            value: `[${fmt(result.pooled.ci_lower)}, ${fmt(
              result.pooled.ci_upper,
            )}]`,
          },
          {
            label: t("analyses.auto.method_4c3880"),
            value:
              result.method === "bayesian"
                ? t("analyses.auto.bayesianRE_922421")
                : t("analyses.auto.fixedEffect_d62bdf"),
          },
          {
            label: t("analyses.auto.tauHeterogeneity_b3e756"),
            value: isNaN(num(result.pooled.tau))
              ? t("analyses.auto.nA_382b0f")
              : fmt(result.pooled.tau, 4),
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-border-default bg-surface-raised p-4 text-center"
          >
            <p className="text-lg font-bold text-text-primary font-mono">{card.value}</p>
            <p className="text-xs text-text-muted mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Forest Plot */}
      {result.per_site && result.per_site.length > 0 && (
        <ForestPlot perSite={result.per_site} pooled={result.pooled} />
      )}

      {/* Per-site Table */}
      {result.per_site && result.per_site.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
          <div className="p-4 border-b border-border-default">
            <h3 className="text-sm font-semibold text-text-primary">{t("analyses.auto.perSiteResults_2586a4")}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default">
                  {[
                    t("analyses.auto.site_a7d647"),
                    t("analyses.auto.hR_fd4c63"),
                    t("analyses.auto.95CILower_3d16ad"),
                    t("analyses.auto.95CIUpper_7d61ea"),
                    t("analyses.auto.logRR_53d74d"),
                    "SE",
                  ].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.per_site.map((site, idx) => (
                  <tr key={idx} className="border-b border-border-default last:border-0">
                    <td className="px-4 py-2 text-text-primary">{site.site_name}</td>
                    <td className={cn(
                      "px-4 py-2 font-mono font-semibold",
                      num(site.hr) > 1 ? "text-critical" : num(site.hr) < 1 ? "text-success" : "text-text-primary",
                    )}>
                      {fmt(site.hr, 4)}
                    </td>
                    <td className="px-4 py-2 font-mono text-text-muted">{fmt(site.ci_lower, 4)}</td>
                    <td className="px-4 py-2 font-mono text-text-muted">{fmt(site.ci_upper, 4)}</td>
                    <td className="px-4 py-2 font-mono text-text-muted">{fmt(site.log_rr, 4)}</td>
                    <td className="px-4 py-2 font-mono text-text-muted">{fmt(site.se_log_rr, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timing */}
      {result.elapsed_seconds != null && (
        <p className="text-xs text-text-ghost">
          {t("analyses.auto.completedIn_d9d00a")} {fmt(result.elapsed_seconds, 1)}s
        </p>
      )}
    </div>
  );
}
