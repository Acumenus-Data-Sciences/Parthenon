import { Loader2, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExecutionStatusBadge } from "./ExecutionStatusBadge";
import type {
  Characterization,
  IncidenceRateAnalysis,
  AnalysisExecution,
} from "../types/analysis";
import type { PathwayAnalysis } from "@/features/pathways/types/pathway";
import type { EstimationAnalysis } from "@/features/estimation/types/estimation";
import type { PredictionAnalysis } from "@/features/prediction/types/prediction";
import type { SccsAnalysis } from "@/features/sccs/types/sccs";
import type { EvidenceSynthesisAnalysis } from "@/features/evidence-synthesis/types/evidenceSynthesis";
import { useTranslation } from "react-i18next";

type Analysis =
  | Characterization
  | IncidenceRateAnalysis
  | PathwayAnalysis
  | EstimationAnalysis
  | PredictionAnalysis
  | SccsAnalysis
  | EvidenceSynthesisAnalysis;

type AnalysisType =
  | "characterization"
  | "incidence-rate"
  | "pathway"
  | "estimation"
  | "prediction"
  | "sccs"
  | "evidence-synthesis";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getLatestExecution(
  analysis: Analysis,
): AnalysisExecution | null {
  if (analysis.latest_execution) return analysis.latest_execution;
  if (analysis.executions && analysis.executions.length > 0) {
    return analysis.executions.reduce((a, b) =>
      new Date(b.created_at) > new Date(a.created_at) ? b : a,
    );
  }
  return null;
}

const typeLabelMap: Record<AnalysisType, string> = {
  characterization: "characterizations",
  "incidence-rate": "incidence rate analyses",
  pathway: "pathway analyses",
  estimation: "estimation analyses",
  prediction: "prediction models",
  sccs: "SCCS analyses",
  "evidence-synthesis": "evidence synthesis analyses",
};

const typeLabelSingularMap: Record<AnalysisType, string> = {
  characterization: "characterization",
  "incidence-rate": "incidence rate analysis",
  pathway: "pathway analysis",
  estimation: "estimation analysis",
  prediction: "prediction model",
  sccs: "SCCS analysis",
  "evidence-synthesis": "evidence synthesis analysis",
};

interface AnalysisListProps {
  analyses: Analysis[];
  type: AnalysisType;
  onSelect: (id: number) => void;
  isLoading?: boolean;
  error?: Error | null;
  page?: number;
  totalPages?: number;
  total?: number;
  perPage?: number;
  onPageChange?: (page: number) => void;
  isSearching?: boolean;
}

export function AnalysisList({
  analyses,
  type,
  onSelect,
  isLoading,
  error,
  page = 1,
  totalPages = 1,
  total = 0,
  perPage = 15,
  onPageChange,
  isSearching = false,
}: AnalysisListProps) {
  const { t } = useTranslation("app");
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  const typeLabel = typeLabelMap[type];
  const typeLabelSingular = typeLabelSingularMap[type];

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-critical">
          {t("analyses.auto.failedToLoad_8344cc")} {typeLabel}
        </p>
      </div>
    );
  }

  if (analyses.length === 0 && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-surface-overlay mb-4">
          <Layers size={24} className="text-text-muted" />
        </div>
        {isSearching ? (
          <>
            <h3 className="text-lg font-semibold text-text-primary">
              {t("analyses.auto.noMatching_cf918e")} {typeLabel}
            </h3>
            <p className="mt-2 text-sm text-text-muted">
              {t("analyses.auto.tryAdjustingYourSearchTerms_546a65")}
            </p>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-text-primary">
              {t("analyses.auto.no_bafd73")} {typeLabel} yet
            </h3>
            <p className="mt-2 text-sm text-text-muted">
              {t("analyses.auto.createYourFirst_11586f")} {typeLabelSingular} {t("analyses.auto.toGetStarted_51b1bd")}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-overlay">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("analyses.auto.name_49ee30")}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("analyses.auto.description_b5a7ad")}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("analyses.auto.author_a51774")}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("analyses.auto.status_ec53a8")}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("analyses.auto.lastRun_05a3a2")}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("analyses.auto.created_0eceeb")}
              </th>
            </tr>
          </thead>
          <tbody>
            {analyses.map((analysis, i) => {
              const latest = getLatestExecution(analysis);
              return (
                <tr
                  key={analysis.id}
                  onClick={() => onSelect(analysis.id)}
                  className={cn(
                    "border-t border-border-subtle transition-colors hover:bg-surface-overlay cursor-pointer",
                    i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-text-primary">
                      {analysis.name}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-text-muted truncate max-w-[250px]">
                      {analysis.description || "--"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-text-muted">
                      {analysis.author?.name ?? "--"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {latest ? (
                      <ExecutionStatusBadge status={latest.status} />
                    ) : (
                      <span className="text-sm text-text-ghost">
                        {t("analyses.auto.notExecuted_ce1910")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {latest?.completed_at
                      ? formatDate(latest.completed_at)
                      : latest?.started_at
                        ? formatDate(latest.started_at)
                        : "--"}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {formatDate(analysis.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-text-muted">
            {t("analyses.auto.showing_b4e610")} {(page - 1) * perPage + 1} -{" "}
            {Math.min(page * perPage, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange?.(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-text-secondary px-2">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                onPageChange?.(Math.min(totalPages, page + 1))
              }
              disabled={page >= totalPages}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
