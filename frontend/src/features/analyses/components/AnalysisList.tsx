import { useEffect, useState } from "react";
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
import { useAuthStore } from "@/stores/authStore";
import { useRowSelection } from "@/features/library/hooks/useRowSelection";
import {
  useLifecycleMutations,
  useBulkLifecycleMutations,
} from "@/features/library/hooks/useLifecycleActions";
import { LifecycleStatusBadge } from "@/features/library/components/LifecycleStatusBadge";
import {
  LifecycleActionMenu,
  type LifecycleAction,
} from "@/features/library/components/LifecycleActionMenu";
import { LifecycleConfirmModal } from "@/features/library/components/LifecycleConfirmModal";
import { BulkActionToolbar } from "@/features/library/components/BulkActionToolbar";
import type { StatusTab } from "@/features/library/components/StatusTabs";
import type { LibraryEntity, LibraryStatus } from "@/features/library/types";
import { lifecycleEntityForAnalysis } from "@/features/library/lib/entityMap";

type PendingLifecycle =
  | { action: LifecycleAction; id: number; name: string | null }
  | { action: LifecycleAction; ids: number[]; name?: undefined; id?: undefined };

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
  /** Currently active lifecycle filter — drives BulkActionToolbar behaviour. */
  lifecycleStatus?: "active" | "draft" | "archived" | "all";
}

const ITEM_NOUNS: Record<AnalysisType, string> = {
  characterization: "characterizations",
  "incidence-rate": "analyses",
  pathway: "analyses",
  estimation: "analyses",
  prediction: "models",
  sccs: "analyses",
  "evidence-synthesis": "analyses",
};

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
  lifecycleStatus,
}: AnalysisListProps) {
  const { t } = useTranslation("app");

  // ---------------------------------------------------------------------
  // Lifecycle wiring. `entity === null` for characterizations (no lifecycle).
  // We still call the hooks unconditionally (rules of hooks) with a safe
  // fallback entity; the UI is hidden when entity is null.
  // ---------------------------------------------------------------------
  const entity = lifecycleEntityForAnalysis(type);
  const safeEntity: LibraryEntity = entity ?? "cohort-definitions";
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());
  const sel = useRowSelection();
  const { promote, archive, restore } = useLifecycleMutations(safeEntity);
  const { bulkArchive, bulkRestore } = useBulkLifecycleMutations(safeEntity);
  const [pending, setPending] = useState<PendingLifecycle | null>(null);

  useEffect(() => {
    sel.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, page, lifecycleStatus]);

  const handleRowAction = (
    action: LifecycleAction,
    id: number,
    name: string,
  ) => setPending({ action, id, name });
  const handleBulkArchive = (ids: number[]) =>
    setPending({ action: "archive", ids });
  const handleBulkRestore = (ids: number[]) =>
    setPending({ action: "restore", ids });

  const mutationPending =
    promote.isPending ||
    archive.isPending ||
    restore.isPending ||
    bulkArchive.isPending ||
    bulkRestore.isPending;

  const confirmPending = () => {
    if (!pending || !entity) return;
    if (pending.ids && pending.ids.length > 0) {
      const mut = pending.action === "archive" ? bulkArchive : bulkRestore;
      mut.mutate(pending.ids, {
        onSuccess: () => {
          setPending(null);
          sel.clear();
        },
      });
      return;
    }
    if (pending.id != null) {
      const mut =
        pending.action === "archive"
          ? archive
          : pending.action === "promote"
            ? promote
            : restore;
      mut.mutate(pending.id, { onSuccess: () => setPending(null) });
    }
  };

  const statusContext: StatusTab = lifecycleStatus ?? "active";
  const itemNoun = ITEM_NOUNS[type];
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
      {/* Bulk action toolbar — only when entity supports lifecycle */}
      {entity && (
        <BulkActionToolbar
          statusContext={statusContext}
          selectedIds={sel.selectedIds}
          onArchive={handleBulkArchive}
          onRestore={handleBulkRestore}
          onClear={sel.clear}
          itemNoun={itemNoun}
          isPending={bulkArchive.isPending || bulkRestore.isPending}
        />
      )}

      {/* Table */}
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-overlay">
              {entity && (
                <th className="w-8 px-3 py-2.5 text-left">
                  <input
                    type="checkbox"
                    aria-label="Select all visible rows"
                    checked={analyses.length > 0 && analyses.every((a) => sel.isSelected(a.id))}
                    ref={(el) => {
                      if (el) {
                        const some = analyses.some((a) => sel.isSelected(a.id));
                        const all = analyses.length > 0 && analyses.every((a) => sel.isSelected(a.id));
                        el.indeterminate = some && !all;
                      }
                    }}
                    onChange={() => sel.toggleAll(analyses.map((a) => a.id))}
                    className="h-3.5 w-3.5 rounded border-border-default bg-surface-overlay accent-accent cursor-pointer"
                  />
                </th>
              )}
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("analyses.auto.name_49ee30")}
              </th>
              {entity && (
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Lifecycle
                </th>
              )}
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
              {entity && (
                <th className="w-12 px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {analyses.map((analysis, i) => {
              const latest = getLatestExecution(analysis);
              const lifecycleStatusValue: LibraryStatus =
                (analysis.status as LibraryStatus | null | undefined) ?? "active";
              const isOwner = currentUserId === analysis.author_id;
              const canEdit = isOwner || isSuperAdmin;
              return (
                <tr
                  key={analysis.id}
                  onClick={() => onSelect(analysis.id)}
                  className={cn(
                    "border-t border-border-subtle transition-colors hover:bg-surface-overlay cursor-pointer",
                    i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                    entity && sel.isSelected(analysis.id) && "bg-accent/5",
                  )}
                >
                  {entity && (
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${analysis.name}`}
                        checked={sel.isSelected(analysis.id)}
                        onChange={() => sel.toggle(analysis.id)}
                        className="h-3.5 w-3.5 rounded border-border-default bg-surface-overlay accent-accent cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-text-primary">
                      {analysis.name}
                    </p>
                  </td>
                  {entity && (
                    <td className="px-4 py-3">
                      <LifecycleStatusBadge status={lifecycleStatusValue} />
                    </td>
                  )}
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
                  {entity && (
                    <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <LifecycleActionMenu
                        status={lifecycleStatusValue}
                        canEdit={canEdit}
                        disabled={mutationPending}
                        onAction={(action) => handleRowAction(action, analysis.id, analysis.name)}
                      />
                    </td>
                  )}
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

      {/* Lifecycle confirm modal (shared for row + bulk actions) */}
      {entity && (
        <LifecycleConfirmModal
          open={pending !== null}
          action={pending?.action ?? "archive"}
          itemName={pending?.id != null ? pending.name : null}
          count={pending?.ids?.length ?? 1}
          itemNoun={itemNoun}
          isPending={mutationPending}
          onConfirm={confirmPending}
          onClose={() => {
            if (!mutationPending) setPending(null);
          }}
        />
      )}
    </div>
  );
}
