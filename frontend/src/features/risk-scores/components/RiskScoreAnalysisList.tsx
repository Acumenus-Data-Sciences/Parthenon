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
      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted cursor-pointer select-none hover:text-text-secondary transition-colors"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === field ? (
          sortDir === "asc" ? <ChevronUp size={12} className="text-success" /> : <ChevronDown size={12} className="text-success" />
        ) : (
          <ChevronUp size={12} className="opacity-0 group-hover:opacity-30" />
        )}
      </span>
    </th>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-critical">Failed to load analyses</p>
      </div>
    );
  }

  if (analyses.length === 0 && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-surface-overlay mb-4">
          <Activity size={24} className="text-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">
          {searchActive ? "No matching analyses" : "No analyses yet"}
        </h3>
        <p className="mt-2 text-sm text-text-muted">
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
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-overlay">
              <SortHeader label="Name" field="name" />
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Cohort
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Scores
              </th>
              <SortHeader label="Status" field="status" />
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Last Run
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Author
              </th>
              <SortHeader label="Created" field="created_at" />
            </tr>
          </thead>
          <tbody>
            {sortedAnalyses.map((analysis, i) => {
              const status = getLatestStatus(analysis);
              const statusColor = ANALYSIS_STATUS_COLORS[status] ?? "var(--text-muted)";
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
                    "border-t border-surface-overlay transition-colors hover:bg-surface-overlay cursor-pointer",
                    i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                  )}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {analysis.name}
                      </p>
                      {analysis.description && (
                        <p className="text-xs text-text-muted truncate max-w-[400px]">
                          {analysis.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-info/10 text-info">
                      {cohortCount} cohort{cohortCount !== 1 ? "s" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
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
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {lastRunDate ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {analysis.author?.name ?? "\u2014"}
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
          <p className="text-xs text-text-muted">
            Showing {(page - 1) * perPage + 1} –{" "}
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
            <span className="text-xs text-text-secondary px-2">
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
