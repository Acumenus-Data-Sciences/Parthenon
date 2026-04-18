import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Activity, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { formatDateTime } from "@/i18n/format";
import { useStudyActivity } from "../hooks/useStudies";

const ACTION_COLORS: Record<string, string> = {
  created: "var(--success)",
  updated: "var(--info)",
  deleted: "var(--critical)",
  status_changed: "var(--warning)",
  member_added: "var(--success)",
  member_removed: "var(--critical)",
  site_added: "var(--success)",
  analysis_added: "var(--domain-observation)",
  executed: "var(--domain-device)",
};

interface StudyActivityTabProps {
  slug: string;
}

export function StudyActivityTab({ slug }: StudyActivityTabProps) {
  const { t } = useTranslation("app");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useStudyActivity(slug, page);

  const entries = data?.items ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / (data?.limit ?? 25)) || 1;

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-text-muted" /></div>;
  }

  const actionLabel = (action: string) =>
    t(`studies.activity.actions.${action}`, { defaultValue: action.replace(/_/g, " ") });
  const entityLabel = (entityType: string) =>
    t(`studies.activity.entities.${entityType}`, { defaultValue: entityType });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-secondary">
        {t("studies.activity.title")}
      </h3>

      {entries.length === 0 ? (
        <div className="empty-state">
          <Activity size={24} className="text-text-ghost mb-2" />
          <h3 className="empty-title">{t("studies.activity.empty.title")}</h3>
          <p className="empty-message">{t("studies.activity.empty.message")}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => {
            const color = ACTION_COLORS[entry.action] ?? "var(--text-muted)";
            return (
              <div key={entry.id} className="flex items-start gap-3 py-2.5 border-b border-border-default last:border-0">
                <div className="w-6 h-6 rounded-full bg-surface-raised border border-border-default flex items-center justify-center shrink-0 mt-0.5">
                  <Clock size={10} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    {entry.user && (
                      <span className="text-text-secondary font-medium">{entry.user.name}</span>
                    )}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ color, backgroundColor: `${color}15` }}>
                      {actionLabel(entry.action)}
                    </span>
                    {entry.entity_type && (
                      <span className="text-xs text-text-ghost">{entityLabel(entry.entity_type)}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-text-ghost mt-0.5">
                    {formatDateTime(entry.occurred_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="btn btn-ghost btn-sm"
          >
            <ChevronLeft size={14} /> {t("studies.activity.pagination.previous")}
          </button>
          <span className="text-xs text-text-ghost">
            {t("studies.activity.pagination.page", { page, totalPages })}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="btn btn-ghost btn-sm"
          >
            {t("studies.activity.pagination.next")} <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
