import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Globe,
  Lock,
  Plus,
  Stethoscope,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "react-i18next";
import { useConceptSets } from "../hooks/useConceptSets";
import { formatConceptSetDate } from "../lib/i18n";

interface ConceptSetListProps {
  search?: string;
  tags?: string[];
  isPublic?: boolean;
  withItems?: boolean;
  onCreateFromBundle?: () => void;
}

export function ConceptSetList({
  search,
  tags,
  isPublic,
  withItems,
  onCreateFromBundle,
}: ConceptSetListProps) {
  const { t, i18n } = useTranslation("app");
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [myOnly, setMyOnly] = useState(true);
  const currentUser = useAuthStore((s) => s.user);
  const limit = 20;

  const { data, isLoading, error } = useConceptSets({
    page,
    limit,
    search: search || undefined,
    tags: tags?.length ? tags : undefined,
    is_public: isPublic || undefined,
    with_items: withItems || undefined,
    author_id: myOnly && currentUser ? currentUser.id : undefined,
  });

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
        <p className="text-critical">{t("conceptSets.list.failedToLoad")}</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const isFiltering = !!(search || (tags && tags.length > 0));

  if (items.length === 0 && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-surface-overlay mb-4">
          <Layers size={24} className="text-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">
          {isFiltering
            ? t("conceptSets.list.noMatchingTitle")
            : t("conceptSets.list.emptyTitle")}
        </h3>
        <p className="mt-2 text-sm text-text-muted">
          {isFiltering
            ? t("conceptSets.list.noMatchingMessage")
            : t("conceptSets.list.emptyMessage")}
        </p>
        {!isFiltering && (
          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => navigate("/concept-sets")}
              className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors"
            >
              <Plus size={14} />
              {t("conceptSets.page.newConceptSet")}
            </button>
            {onCreateFromBundle && (
              <button
                type="button"
                onClick={onCreateFromBundle}
                className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-sm font-medium text-text-muted hover:text-text-secondary transition-colors"
              >
                <Stethoscope size={14} />
                {t("conceptSets.page.fromBundle")}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* My / All toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-surface-overlay p-0.5 w-fit">
        <button
          type="button"
          onClick={() => {
            setMyOnly(true);
            setPage(1);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            myOnly
              ? "bg-surface-elevated text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-secondary",
          )}
        >
          <User size={12} />
          {t("conceptSets.list.myConceptSets")}
        </button>
        <button
          type="button"
          onClick={() => {
            setMyOnly(false);
            setPage(1);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            !myOnly
              ? "bg-surface-elevated text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-secondary",
          )}
        >
          <Globe size={12} />
          {t("conceptSets.list.allConceptSets")}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-overlay">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("conceptSets.list.columns.name")}
              </th>
              {!myOnly && (
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t("conceptSets.list.columns.author")}
                </th>
              )}
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("conceptSets.list.columns.visibility")}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("conceptSets.list.columns.items")}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("conceptSets.list.columns.tags")}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("conceptSets.list.columns.updated")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((cs, i) => (
              <tr
                key={cs.id}
                onClick={() => navigate(`/concept-sets/${cs.id}`)}
                className={cn(
                  "border-t border-border-subtle transition-colors hover:bg-surface-overlay cursor-pointer",
                  i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                )}
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {cs.name}
                    </p>
                    {cs.description && (
                      <p className="mt-0.5 text-xs text-text-muted truncate max-w-[300px]">
                        {cs.description}
                      </p>
                    )}
                  </div>
                </td>
                {!myOnly && (
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {cs.author?.name ?? "--"}
                  </td>
                )}
                <td className="px-4 py-3">
                  {cs.is_public ? (
                    <span className="inline-flex items-center gap-1 text-xs text-success">
                      <Globe size={12} />
                      {t("conceptSets.list.visibility.public")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                      <Lock size={12} />
                      {t("conceptSets.list.visibility.private")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-secondary">
                    <Layers size={10} />
                    {cs.items_count ?? cs.items?.length ?? 0}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {cs.tags?.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent/15 text-accent"
                      >
                        {tag}
                      </span>
                    ))}
                    {cs.tags?.length > 3 && (
                      <span className="text-[10px] text-text-ghost">
                        +{cs.tags.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-text-muted">
                  {formatConceptSetDate(i18n.language, cs.updated_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-text-muted">
            {t("conceptSets.list.showingRange", {
              start: (page - 1) * limit + 1,
              end: Math.min(page * limit, total),
              total,
            })}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
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
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
