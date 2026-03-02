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

type Analysis = Characterization | IncidenceRateAnalysis | PathwayAnalysis | EstimationAnalysis | PredictionAnalysis;

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

interface AnalysisListProps {
  analyses: Analysis[];
  type: "characterization" | "incidence-rate" | "pathway" | "estimation" | "prediction";
  onSelect: (id: number) => void;
  isLoading?: boolean;
  error?: Error | null;
  page?: number;
  totalPages?: number;
  total?: number;
  perPage?: number;
  onPageChange?: (page: number) => void;
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
}: AnalysisListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  const typeLabelMap: Record<string, string> = {
    characterization: "characterizations",
    "incidence-rate": "incidence rate analyses",
    pathway: "pathway analyses",
    estimation: "estimation analyses",
    prediction: "prediction models",
  };
  const typeLabelSingularMap: Record<string, string> = {
    characterization: "characterization",
    "incidence-rate": "incidence rate analysis",
    pathway: "pathway analysis",
    estimation: "estimation analysis",
    prediction: "prediction model",
  };
  const typeLabel = typeLabelMap[type] ?? type;
  const typeLabelSingular = typeLabelSingularMap[type] ?? type;

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#E85A6B]">
          Failed to load {typeLabel}
        </p>
      </div>
    );
  }

  if (analyses.length === 0 && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#1C1C20] mb-4">
          <Layers size={24} className="text-[#8A857D]" />
        </div>
        <h3 className="text-lg font-semibold text-[#F0EDE8]">
          No {typeLabel} yet
        </h3>
        <p className="mt-2 text-sm text-[#8A857D]">
          Create your first {typeLabelSingular} to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#1C1C20]">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Name
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Description
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Status
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Last Run
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Created
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
                    "border-t border-[#1C1C20] transition-colors hover:bg-[#1C1C20] cursor-pointer",
                    i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-[#F0EDE8]">
                      {analysis.name}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-[#8A857D] truncate max-w-[300px]">
                      {analysis.description || "--"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {latest ? (
                      <ExecutionStatusBadge status={latest.status} />
                    ) : (
                      <span className="text-xs text-[#5A5650]">
                        Not executed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8A857D]">
                    {latest?.completed_at
                      ? formatDate(latest.completed_at)
                      : latest?.started_at
                        ? formatDate(latest.started_at)
                        : "--"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#8A857D]">
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
          <p className="text-xs text-[#8A857D]">
            Showing {(page - 1) * perPage + 1} -{" "}
            {Math.min(page * perPage, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange?.(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-[#C5C0B8] px-2">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                onPageChange?.(Math.min(totalPages, page + 1))
              }
              disabled={page >= totalPages}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
