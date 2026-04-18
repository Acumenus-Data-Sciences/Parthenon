import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Briefcase,
} from "lucide-react";
import { formatDate } from "@/i18n/format";
import { cn } from "@/lib/utils";
import type { Study } from "../types/study";

type SortKey = "title" | "study_type" | "status" | "priority" | "created_at";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--text-muted)",
  protocol_development: "var(--info)",
  feasibility: "var(--domain-observation)",
  irb_review: "var(--warning)",
  recruitment: "var(--domain-device)",
  execution: "var(--success)",
  analysis: "var(--success)",
  synthesis: "var(--info)",
  manuscript: "#C084FC",
  published: "var(--info)",
  archived: "var(--text-ghost)",
  withdrawn: "var(--critical)",
  running: "var(--warning)",
  completed: "var(--success)",
  failed: "var(--critical)",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "var(--critical)",
  high: "var(--warning)",
  medium: "var(--info)",
  low: "var(--text-muted)",
};

interface StudyListProps {
  studies: Study[];
  onSelect: (slugOrId: string | number) => void;
  isLoading?: boolean;
  error?: Error | null;
  page?: number;
  totalPages?: number;
  total?: number;
  perPage?: number;
  onPageChange?: (page: number) => void;
  searchActive?: boolean;
}

function renderSortHeader({
  label,
  field,
  sortKey,
  sortDir,
  onToggleSort,
}: {
  label: string;
  field: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onToggleSort: (field: SortKey) => void;
}) {
  return (
    <th
      onClick={() => onToggleSort(field)}
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
}

export function StudyList({
  studies,
  onSelect,
  isLoading,
  error,
  page = 1,
  totalPages = 1,
  total = 0,
  perPage = 20,
  onPageChange,
  searchActive = false,
}: StudyListProps) {
  const { t } = useTranslation("app");
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

  const sortedStudies = useMemo(() => {
    if (!sortKey) return studies;
    return [...studies].sort((a, b) => {
      const cmp =
        sortKey === "priority" ? (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) :
        sortKey === "created_at" ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime() :
        (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [studies, sortKey, sortDir]);

  const studyTypeLabel = (type: string) =>
    t(`studies.detail.studyTypes.${type}`, { defaultValue: type.replace(/_/g, " ") });
  const statusLabel = (status: string) =>
    t(`studies.detail.statuses.${status}`, { defaultValue: status.replace(/_/g, " ") });
  const priorityLabel = (priority: string) =>
    t(`studies.priorities.${priority}`, { defaultValue: priority });

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
        <p className="text-critical">{t("studies.list.loadFailed")}</p>
      </div>
    );
  }

  if (studies.length === 0 && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-surface-overlay mb-4">
          <Briefcase size={24} className="text-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">
          {searchActive ? t("studies.list.empty.noMatchingTitle") : t("studies.list.empty.noStudiesTitle")}
        </h3>
        <p className="mt-2 text-sm text-text-muted">
          {searchActive
            ? t("studies.list.empty.tryAdjusting")
            : t("studies.list.empty.createFirst")}
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
              {renderSortHeader({ label: t("studies.list.table.title"), field: "title", sortKey, sortDir, onToggleSort: toggleSort })}
              {renderSortHeader({ label: t("studies.list.table.type"), field: "study_type", sortKey, sortDir, onToggleSort: toggleSort })}
              {renderSortHeader({ label: t("studies.list.table.status"), field: "status", sortKey, sortDir, onToggleSort: toggleSort })}
              {renderSortHeader({ label: t("studies.list.table.priority"), field: "priority", sortKey, sortDir, onToggleSort: toggleSort })}
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("studies.list.table.pi")}
              </th>
              {renderSortHeader({ label: t("studies.list.table.created"), field: "created_at", sortKey, sortDir, onToggleSort: toggleSort })}
            </tr>
          </thead>
          <tbody>
            {sortedStudies.map((study, i) => {
              const statusColor = STATUS_COLORS[study.status] ?? "var(--text-muted)";
              const priorityColor = PRIORITY_COLORS[study.priority] ?? "var(--text-muted)";

              return (
                <tr
                  key={study.id}
                  onClick={() => onSelect(study.slug || study.id)}
                  className={cn(
                    "border-t border-border-subtle transition-colors hover:bg-surface-overlay cursor-pointer",
                    i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                  )}
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text-primary">
                          {study.title}
                        </p>
                        {study.short_title && (
                          <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold bg-accent/15 text-accent">
                            {study.short_title}
                          </span>
                        )}
                      </div>
                      {study.description && (
                        <p className="text-xs text-text-muted truncate max-w-[400px]">
                          {study.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-success/10 text-success">
                      {studyTypeLabel(study.study_type)}
                    </span>
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
                      {statusLabel(study.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium uppercase"
                      style={{
                        backgroundColor: `${priorityColor}15`,
                        color: priorityColor,
                      }}
                    >
                      {priorityLabel(study.priority)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {study.principal_investigator?.name ?? study.author?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {formatDate(study.created_at)}
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
            {t("studies.list.pagination.showing", {
              start: (page - 1) * perPage + 1,
              end: Math.min(page * perPage, total),
              total,
            })}
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
              {t("studies.list.pagination.page", { page, totalPages })}
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
