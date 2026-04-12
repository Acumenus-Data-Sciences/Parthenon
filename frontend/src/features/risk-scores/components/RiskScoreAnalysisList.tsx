import { useState, useMemo } from "react";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiskScoreAnalysis } from "../types/riskScore";
import { ANALYSIS_STATUS_COLORS } from "../types/riskScore";

type SortKey = "name" | "status" | "created_at";
type SortDir = "asc" | "desc";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getLatestStatus(analysis: RiskScoreAnalysis): string {
  return analysis.executions?.[0]?.status ?? "draft";
}

interface RiskScoreAnalysisListProps {
  analyses: RiskScoreAnalysis[];
  onSelect: (id: number) => void;
  isLoading?: boolean;
  error?: Error | null;
  page?: number;
  totalPages?: number;
  total?: number;
  perPage?: number;
  onPageChange?: (page: number) => void;
  searchActive?: boolean;
}

export function RiskScoreAnalysisList({
  analyses,
  onSelect,
  isLoading,
  error,
  page = 1,
  totalPages = 1,
  total = 0,
  perPage = 20,
  onPageChange,
  searchActive = false,
}: RiskScoreAnalysisListProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedAnalyses = useMemo(() => {
    if (!sortKey) return analyses;
    return [...analyses].sort((a, b) => {
      let cmp: number;
      if (sortKey === "status") {
        cmp = getLatestStatus(a).localeCompare(getLatestStatus(b));
      } else if (sortKey === "created_at") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [analyses, sortKey, sortDir]);

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      onClick={() => toggleSort(field)}
      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D] cursor-pointer select-none hover:text-[#C5C0B8] transition-colors"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === field ? (
          sortDir === "asc" ? <ChevronUp size={12} className="text-[#2DD4BF]" /> : <ChevronDown size={12} className="text-[#2DD4BF]" />
        ) : (
          <ChevronUp size={12} className="opacity-0 group-hover:opacity-30" />
        )}
      </span>
    </th>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#E85A6B]">Failed to load analyses</p>
      </div>
    );
  }

  if (analyses.length === 0 && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#1C1C20] mb-4">
          <Activity size={24} className="text-[#8A857D]" />
        </div>
        <h3 className="text-lg font-semibold text-[#F0EDE8]">
          {searchActive ? "No matching analyses" : "No analyses yet"}
        </h3>
        <p className="mt-2 text-sm text-[#8A857D]">
          {searchActive
            ? "Try adjusting your search terms."
            : "Create your first risk score analysis to get started."}
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
              <SortHeader label="Name" field="name" />
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Cohort
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Scores
              </th>
              <SortHeader label="Status" field="status" />
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Last Run
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Author
              </th>
              <SortHeader label="Created" field="created_at" />
            </tr>
          </thead>
          <tbody>
            {sortedAnalyses.map((analysis, i) => {
              const status = getLatestStatus(analysis);
              const statusColor = ANALYSIS_STATUS_COLORS[status] ?? "#8A857D";
              const cohortCount = analysis.design_json.targetCohortIds.length;
              const scoreCount = analysis.design_json.scoreIds.length;
              const lastExecution = analysis.executions?.[0];
              const lastRunDate = status !== "draft" && lastExecution?.created_at
                ? formatDate(lastExecution.created_at)
                : null;

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
                    <div>
                      <p className="text-sm font-medium text-[#F0EDE8]">
                        {analysis.name}
                      </p>
                      {analysis.description && (
                        <p className="text-xs text-[#8A857D] truncate max-w-[400px]">
                          {analysis.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#60A5FA]/10 text-[#60A5FA]">
                      {cohortCount} cohort{cohortCount !== 1 ? "s" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#8A857D]">
                    {scoreCount} score{scoreCount !== 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${statusColor}15`,
                        color: statusColor,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: statusColor }}
                      />
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#8A857D]">
                    {lastRunDate ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#8A857D]">
                    {analysis.author?.name ?? "\u2014"}
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
            Showing {(page - 1) * perPage + 1} –{" "}
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
