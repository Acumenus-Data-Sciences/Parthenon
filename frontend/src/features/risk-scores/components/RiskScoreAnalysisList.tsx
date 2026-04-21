import { useState, useMemo } from "react";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Activity,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { RiskScoreAnalysis } from "../types/riskScore";
import { ANALYSIS_STATUS_COLORS } from "../types/riskScore";
import {
  formatRiskScoreDate,
  getRiskScoreStatusLabel,
} from "../lib/i18n";

type SortKey = "name" | "status" | "created_at";
type SortDir = "asc" | "desc";

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

function SortHeader({
  label,
  field,
  sortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  field: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onToggle: (field: SortKey) => void;
}) {
  return (
    <th
      onClick={() => onToggle(field)}
      className="cursor-pointer select-none px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:text-text-secondary"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === field ? (
          sortDir === "asc" ? (
            <ChevronUp size={12} className="text-success" />
          ) : (
            <ChevronDown size={12} className="text-success" />
          )
        ) : (
          <ChevronUp size={12} className="opacity-0" />
        )}
      </span>
    </th>
  );
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
  const { t, i18n } = useTranslation("app");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  const sortedAnalyses = useMemo(() => {
    if (!sortKey) return analyses;
    return [...analyses].sort((left, right) => {
      let cmp: number;
      if (sortKey === "status") {
        cmp = getLatestStatus(left).localeCompare(getLatestStatus(right));
      } else if (sortKey === "created_at") {
        cmp =
          new Date(left.created_at).getTime() -
          new Date(right.created_at).getTime();
      } else {
        cmp = (left[sortKey] ?? "").localeCompare(right[sortKey] ?? "");
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [analyses, sortKey, sortDir]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-critical">
          {t("riskScores.hub.errors.failedToLoadAnalyses")}
        </p>
      </div>
    );
  }

  if (analyses.length === 0 && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-overlay">
          <Activity size={24} className="text-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">
          {searchActive
            ? t("riskScores.hub.empty.noMatchingAnalyses")
            : t("riskScores.hub.empty.noRiskScoreAnalysesYet")}
        </h3>
        <p className="mt-2 text-sm text-text-muted">
          {searchActive
            ? t("riskScores.patients.adjustFilters")
            : t("riskScores.hub.empty.createFirst")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border-default bg-surface-raised">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-overlay">
              <SortHeader
                label={t("riskScores.common.headers.name")}
                field="name"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
              />
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("riskScores.common.headers.cohort")}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("riskScores.common.headers.scores")}
              </th>
              <SortHeader
                label={t("riskScores.common.headers.status")}
                field="status"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
              />
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("riskScores.common.headers.lastRun")}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("riskScores.common.headers.author")}
              </th>
              <SortHeader
                label={t("riskScores.common.headers.created")}
                field="created_at"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
              />
            </tr>
          </thead>
          <tbody>
            {sortedAnalyses.map((analysis, index) => {
              const status = getLatestStatus(analysis);
              const statusColor = ANALYSIS_STATUS_COLORS[status] ?? "var(--text-muted)";
              const lastExecution = analysis.executions?.[0];
              const lastRunDate =
                status !== "draft" && lastExecution?.created_at
                  ? formatRiskScoreDate(i18n.resolvedLanguage, lastExecution.created_at, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : null;

              return (
                <tr
                  key={analysis.id}
                  onClick={() => onSelect(analysis.id)}
                  className={cn(
                    "cursor-pointer border-t border-border-subtle transition-colors hover:bg-surface-overlay",
                    index % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                  )}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {analysis.name}
                      </p>
                      {analysis.description && (
                        <p className="max-w-[400px] truncate text-xs text-text-muted">
                          {analysis.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-medium text-info">
                      {t("riskScores.common.count.cohort", {
                        count: analysis.design_json.targetCohortIds.length,
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {t("riskScores.common.count.score", {
                      count: analysis.design_json.scoreIds.length,
                    })}
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
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: statusColor }}
                      />
                      {getRiskScoreStatusLabel(t, status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {lastRunDate ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {analysis.author?.name ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {formatRiskScoreDate(i18n.resolvedLanguage, analysis.created_at, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-text-muted">
            {t("riskScores.common.pagination.showingRange", {
              from: (page - 1) * perPage + 1,
              to: Math.min(page * perPage, total),
              total,
            })}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange?.(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 text-xs text-text-secondary">
              {t("riskScores.common.pagination.pageXOfY", {
                current: page,
                total: totalPages,
              })}
            </span>
            <button
              type="button"
              onClick={() => onPageChange?.(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
