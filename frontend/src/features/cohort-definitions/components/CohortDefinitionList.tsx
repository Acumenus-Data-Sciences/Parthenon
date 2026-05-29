import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Globe,
  Lock,
  Stethoscope,
  Plus,
  Database,
  User,
  Shield,
  Award,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useCohortDefinitions, useGroupedCohortDefinitions } from "../hooks/useCohortDefinitions";
import type { CohortGeneration, GenerationSource, QualityTier } from "../types/cohortExpression";
import { useTranslation } from "react-i18next";
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
import type { LibraryStatus } from "@/features/library/types";

type PendingLifecycle =
  | { action: LifecycleAction; id: number; name: string | null; ids?: undefined }
  | { action: LifecycleAction; ids: number[]; name?: undefined; id?: undefined };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function LatestGenerationBadge({
  generation,
}: {
  generation?: CohortGeneration | null;
}) {
  const { t } = useTranslation("app");
  if (!generation) {
    return (
      <span className="text-xs text-text-ghost">{t("cohortDefinitions.auto.noGenerations_328f09")}</span>
    );
  }

  const latest = generation;

  const config = {
    pending: { icon: Clock, color: "var(--text-muted)", label: t("cohortDefinitions.auto.pending_2d13df") },
    queued: { icon: Clock, color: "var(--accent)", label: t("cohortDefinitions.auto.queued_7b2f31") },
    running: { icon: Loader2, color: "var(--info)", label: t("cohortDefinitions.auto.running_5bda81") },
    completed: { icon: CheckCircle2, color: "var(--success)", label: t("cohortDefinitions.auto.completed_07ca50") },
    failed: { icon: XCircle, color: "var(--critical)", label: t("cohortDefinitions.auto.failed_d7c8c8") },
    cancelled: { icon: Clock, color: "var(--text-muted)", label: t("cohortDefinitions.auto.cancelled_a149e8") },
  }[latest.status];

  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{
          backgroundColor: `${config.color}15`,
          color: config.color,
        }}
      >
        <Icon
          size={10}
          className={latest.status === "running" ? "animate-spin" : ""}
        />
        {config.label}
      </span>
      {latest.person_count !== null && (
        <span className="inline-flex items-center gap-1 font-['IBM_Plex_Mono',monospace] text-xs text-success">
          <Users size={10} />
          {latest.person_count.toLocaleString()}
        </span>
      )}
    </div>
  );
}

function SourceBadges({ sources }: { sources?: GenerationSource[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {sources.map((s) => (
        <span
          key={s.source_id}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-info/10 text-info border border-info/20"
          title={`${s.person_count?.toLocaleString() ?? '?'} patients — ${s.completed_at ? new Date(s.completed_at).toLocaleDateString() : ''}`}
        >
          <Database size={8} />
          {s.source_name ?? `Source ${s.source_id}`}
          {s.person_count !== null && (
            <span className="opacity-70">({s.person_count.toLocaleString()})</span>
          )}
        </span>
      ))}
    </div>
  );
}

function TierBadge({ tier }: { tier?: string | null }) {
  const { t } = useTranslation("app");
  if (!tier) return <span className="text-xs text-text-ghost">--</span>;
  const config: Record<string, { color: string; label: string; Icon: typeof Shield }> = {
    "study-ready": { color: "var(--success)", label: t("cohortDefinitions.auto.studyReady_834a5b"), Icon: Shield },
    validated: { color: "var(--accent)", label: t("cohortDefinitions.auto.validated_536425"), Icon: Award },
    draft: { color: "var(--text-ghost)", label: t("cohortDefinitions.auto.draft_f03ab1"), Icon: FileText },
  };
  const c = config[tier];
  if (!c) return <span className="text-xs text-text-ghost">{tier}</span>;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: `${c.color}15`, color: c.color }}
    >
      <c.Icon size={10} />
      {c.label}
    </span>
  );
}

function DeprecatedBadge() {
  const { t } = useTranslation("app");
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-500">
      <AlertTriangle size={10} />
      {t("cohortDefinitions.auto.deprecated_0ac54c")}
    </span>
  );
}

interface Props {
  tags?: string[];
  search?: string;
  isPublic?: boolean;
  withGenerations?: boolean;
  lifecycleStatus?: "active" | "draft" | "archived" | "all";
  /** Super-admin "All users" scope (Phase D §6.5). Bypasses owner restriction. */
  allUsers?: boolean;
  onCreateFromBundle?: () => void;
  groupBy?: "domain" | null;
  tierFilter?: string | null;
}

export function CohortDefinitionList({ tags, search, isPublic, withGenerations, lifecycleStatus, allUsers, onCreateFromBundle, groupBy, tierFilter }: Props) {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [myOnly, setMyOnly] = useState(true);
  const effectiveMyOnly = allUsers ? false : myOnly;
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());
  const limit = 20;

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isGrouped = groupBy === "domain";

  const { data: groupedData, isLoading: groupedLoading } = useGroupedCohortDefinitions({
    group_by: "domain",
    quality_tier: (tierFilter as QualityTier) ?? undefined,
    search: search || undefined,
    tags: tags && tags.length > 0 ? tags : undefined,
    author_id: effectiveMyOnly && currentUser ? currentUser.id : undefined,
    status: lifecycleStatus,
    scope: allUsers ? "all" : undefined,
    enabled: isGrouped,
  });

  // Auto-expand first 3 groups on initial load
  useEffect(() => {
    if (groupedData?.data?.groups && expandedGroups.size === 0) {
      const firstThree = groupedData.data.groups.slice(0, 3).map((g) => g.key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpandedGroups(new Set(firstThree));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedData?.data?.groups]);

  // Reset page when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [search, tags, isPublic, withGenerations, myOnly, allUsers]);

  // ---------------------------------------------------------------------
  // Lifecycle: selection state, mutations, confirm modal
  // ---------------------------------------------------------------------
  const sel = useRowSelection();
  const { promote, archive, restore } = useLifecycleMutations("cohort-definitions");
  const { bulkArchive, bulkRestore } = useBulkLifecycleMutations(
    "cohort-definitions",
  );
  const [pending, setPending] = useState<PendingLifecycle | null>(null);

  // Reset selection whenever the visible set could change.
  useEffect(() => {
    sel.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tags, isPublic, withGenerations, myOnly, allUsers, lifecycleStatus, page]);

  const handleRowAction = (
    action: LifecycleAction,
    id: number,
    name: string | null,
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
    if (!pending) return;
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

  const { data, isLoading, error } = useCohortDefinitions({
    page,
    limit,
    tags,
    search,
    is_public: isPublic || undefined,
    with_generations: withGenerations || undefined,
    author_id: effectiveMyOnly && currentUser ? currentUser.id : undefined,
    status: lifecycleStatus,
    scope: allUsers ? "all" : undefined,
    enabled: !isGrouped,
  });

  // -----------------------------------------------------------------------
  // Grouped domain view — checked BEFORE flat loading/error/empty states
  // -----------------------------------------------------------------------
  if (isGrouped) {
    if (groupedLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      );
    }

    const groups = groupedData?.data?.groups ?? [];

    return (
      <div className="space-y-4">
        {/* My / All toggle — hidden in super-admin "All users" mode */}
        {!allUsers && (
          <div className="flex items-center gap-1 rounded-lg bg-surface-overlay p-0.5 w-fit">
            <button
              type="button"
              onClick={() => setMyOnly(true)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                myOnly
                  ? "bg-surface-elevated text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              <User size={12} />
              {t("cohortDefinitions.auto.myDefinitions_5c115e")}
            </button>
            <button
              type="button"
              onClick={() => setMyOnly(false)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                !myOnly
                  ? "bg-surface-elevated text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              <Globe size={12} />
              {t("cohortDefinitions.auto.allDefinitions_39f3bd")}
            </button>
          </div>
        )}

        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
            <Layers size={24} className="text-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-text-primary">{t("cohortDefinitions.auto.noCohortDefinitions_a11064")}</h3>
            <p className="mt-2 text-sm text-text-muted">{t("cohortDefinitions.auto.noDefinitionsMatchTheCurrentFilters_df39c6")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              return (
                <div
                  key={group.key}
                  className="rounded-lg border border-border-default bg-surface-raised overflow-hidden"
                >
                  {/* Group header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-overlay transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-text-muted shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-text-muted shrink-0" />
                    )}
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      {group.label}
                    </span>
                    <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-text-muted">
                      {group.count}
                    </span>
                  </button>

                  {/* Expanded table */}
                  {isExpanded && group.cohorts.length > 0 && (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-surface-overlay">
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                            {t("cohortDefinitions.auto.name_49ee30")}
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                            Status
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                            {t("cohortDefinitions.auto.tier_9483f1")}
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                            {t("cohortDefinitions.auto.n_8d9c30")}
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                            {t("cohortDefinitions.auto.sources_fb6175")}
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                            {t("cohortDefinitions.auto.updated_ff0a3b")}
                          </th>
                          <th className="w-12 px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.cohorts.map((def, i) => (
                          <tr
                            key={def.id}
                            onClick={() => navigate(`/cohort-definitions/${def.id}`)}
                            className={cn(
                              "border-t border-border-subtle transition-colors hover:bg-surface-overlay cursor-pointer",
                              i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                              def.deprecated_at && "opacity-60",
                            )}
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                {def.is_public ? (
                                  <Globe size={11} className="text-info shrink-0" />
                                ) : (
                                  <Lock size={11} className="text-text-ghost shrink-0" />
                                )}
                                <p className={cn(
                                  "text-sm font-medium text-text-primary truncate max-w-[300px]",
                                  def.deprecated_at && "line-through",
                                )}>
                                  {def.name}
                                </p>
                                {def.deprecated_at && <DeprecatedBadge />}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <LifecycleStatusBadge
                                size="xs"
                                status={(def.status as LibraryStatus | null | undefined) ?? "active"}
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <TierBadge tier={def.quality_tier} />
                            </td>
                            <td className="px-4 py-2.5">
                              {def.latest_generation?.person_count != null ? (
                                <span className="inline-flex items-center gap-1 font-['IBM_Plex_Mono',monospace] text-xs text-success">
                                  <Users size={10} />
                                  {def.latest_generation.person_count.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-xs text-text-ghost">--</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <SourceBadges sources={def.generation_sources} />
                            </td>
                            <td className="px-4 py-2.5 text-xs text-text-muted">
                              {formatDate(def.updated_at)}
                            </td>
                            <td className="px-2 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                              {(() => {
                                const groupedStatus: LibraryStatus = (def.status as LibraryStatus | null | undefined) ?? "active";
                                const groupedCanEdit = (currentUser?.id === def.author_id) || isSuperAdmin;
                                return (
                                  <LifecycleActionMenu
                                    status={groupedStatus}
                                    canEdit={groupedCanEdit}
                                    disabled={mutationPending}
                                    onAction={(action) => handleRowAction(action, def.id, def.name)}
                                  />
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Lifecycle confirm modal — shared between grouped and flat views */}
        <LifecycleConfirmModal
          open={pending !== null}
          action={pending?.action ?? "archive"}
          itemName={pending?.id != null ? pending.name : null}
          count={pending?.ids?.length ?? 1}
          itemNoun="cohorts"
          isPending={mutationPending}
          onConfirm={confirmPending}
          onClose={() => {
            if (!mutationPending) setPending(null);
          }}
        />
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Flat view — loading / error / empty states
  // -----------------------------------------------------------------------
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const engine = data?.engine;

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
        <p className="text-critical">{t("cohortDefinitions.auto.failedToLoadCohortDefinitions_bd5113")}</p>
      </div>
    );
  }

  if (items.length === 0 && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-surface-overlay mb-4">
          <Layers size={24} className="text-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">
          {search ? "No matching cohort definitions" : "No cohort definitions"}
        </h3>
        <p className="mt-2 text-sm text-text-muted max-w-md text-center">
          {search
            ? `No results for "${search}". Try a different search term.`
            : "Cohort definitions let you define inclusion and exclusion criteria to identify patient populations for research studies."}
        </p>
        {!search && (
          <div className="flex items-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => navigate("/cohort-definitions")}
              className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors"
            >
              <Plus size={16} />
              {t("cohortDefinitions.auto.newCohortDefinition_3caa4c")}
            </button>
            {onCreateFromBundle && (
              <button
                type="button"
                onClick={onCreateFromBundle}
                className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-secondary hover:border-surface-highlight transition-colors"
              >
                <Stethoscope size={16} />
                {t("cohortDefinitions.auto.createFromCareBundle_b7b429")}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* My / All toggle — hidden in super-admin "All users" mode */}
      {!allUsers && (
        <div className="flex items-center gap-1 rounded-lg bg-surface-overlay p-0.5 w-fit">
          <button
            type="button"
            onClick={() => setMyOnly(true)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              myOnly
                ? "bg-surface-elevated text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            <User size={12} />
            {t("cohortDefinitions.auto.myDefinitions_5c115e")}
          </button>
          <button
            type="button"
            onClick={() => setMyOnly(false)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              !myOnly
                ? "bg-surface-elevated text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            <Globe size={12} />
            {t("cohortDefinitions.auto.allDefinitions_39f3bd")}
          </button>
        </div>
      )}

      {/* Bulk action toolbar (visible when rows are selected) */}
      <BulkActionToolbar
        statusContext={statusContext}
        selectedIds={sel.selectedIds}
        onArchive={handleBulkArchive}
        onRestore={handleBulkRestore}
        onClear={sel.clear}
        itemNoun="cohorts"
        isPending={bulkArchive.isPending || bulkRestore.isPending}
      />

      {/* Table */}
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-overlay">
              <th className="w-8 px-3 py-2.5 text-left">
                <input
                  type="checkbox"
                  aria-label="Select all visible rows"
                  checked={items.length > 0 && items.every((d) => sel.isSelected(d.id))}
                  ref={(el) => {
                    if (el) {
                      const some = items.some((d) => sel.isSelected(d.id));
                      const all = items.length > 0 && items.every((d) => sel.isSelected(d.id));
                      el.indeterminate = some && !all;
                    }
                  }}
                  onChange={() => sel.toggleAll(items.map((d) => d.id))}
                  className="h-3.5 w-3.5 rounded border-border-default bg-surface-overlay accent-accent cursor-pointer"
                />
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("cohortDefinitions.auto.name_49ee30")}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Status
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("cohortDefinitions.auto.tier_9483f1")}
              </th>
              {!effectiveMyOnly && (
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t("cohortDefinitions.auto.author_a51774")}
                </th>
              )}
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("cohortDefinitions.auto.tags_189f63")}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("cohortDefinitions.auto.latestGeneration_63ab9b")}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("cohortDefinitions.auto.generatedAgainst_8b61f8")}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("cohortDefinitions.auto.created_0eceeb")}
              </th>
              <th className="w-12 px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((def, i) => {
              const status: LibraryStatus = (def.status as LibraryStatus | null | undefined) ?? "active";
              const isOwner = currentUser?.id === def.author_id;
              const canEdit = isOwner || isSuperAdmin;
              return (
                <tr
                  key={def.id}
                  onClick={() => navigate(`/cohort-definitions/${def.id}`)}
                  className={cn(
                    "border-t border-border-subtle transition-colors hover:bg-surface-overlay cursor-pointer",
                    i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                    def.deprecated_at && "opacity-60",
                    sel.isSelected(def.id) && "bg-accent/5",
                  )}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select cohort ${def.name}`}
                      checked={sel.isSelected(def.id)}
                      onChange={() => sel.toggle(def.id)}
                      className="h-3.5 w-3.5 rounded border-border-default bg-surface-overlay accent-accent cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {def.is_public ? (
                        <Globe size={12} className="text-info shrink-0" />
                      ) : (
                        <Lock size={12} className="text-text-ghost shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className={cn(
                          "text-sm font-medium text-text-primary truncate",
                          def.deprecated_at && "line-through",
                        )}>
                          {def.name}
                        </p>
                        {def.description && (
                          <p className="text-[10px] text-text-ghost truncate max-w-[250px]">
                            {def.description}
                          </p>
                        )}
                      </div>
                      {def.deprecated_at && <DeprecatedBadge />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <LifecycleStatusBadge status={status} />
                  </td>
                  <td className="px-4 py-3">
                    <TierBadge tier={def.quality_tier} />
                  </td>
                  {!effectiveMyOnly && (
                    <td className="px-4 py-3">
                      <p className="text-xs text-text-muted">
                        {def.author?.name ?? "--"}
                      </p>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {def.tags?.map((tag) => (
                        <span
                          key={tag}
                          className="inline-block rounded px-1.5 py-0.5 text-[10px] bg-surface-overlay text-text-muted border border-border-default"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <LatestGenerationBadge generation={def.latest_generation} />
                  </td>
                  <td className="px-4 py-3">
                    <SourceBadges sources={def.generation_sources} />
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {formatDate(def.created_at)}
                  </td>
                  <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <LifecycleActionMenu
                      status={status}
                      canEdit={canEdit}
                      disabled={mutationPending}
                      onAction={(action) => handleRowAction(action, def.id, def.name)}
                    />
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
          <p className="text-xs text-text-muted flex items-center gap-2">
            {t("cohortDefinitions.auto.showing_b4e610")} {(page - 1) * limit + 1} -{" "}
            {Math.min(page * limit, total)} of {total}
            {engine === "solr" && (
              <span className="inline-flex items-center rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-success">
                {t("cohortDefinitions.auto.solr_dcdb64")}
              </span>
            )}
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

      {/* Lifecycle confirm modal (shared for row + bulk actions) */}
      <LifecycleConfirmModal
        open={pending !== null}
        action={pending?.action ?? "archive"}
        itemName={pending?.id != null ? pending.name : null}
        count={pending?.ids?.length ?? 1}
        itemNoun="cohorts"
        isPending={mutationPending}
        onConfirm={confirmPending}
        onClose={() => {
          if (!mutationPending) setPending(null);
        }}
      />
    </div>
  );
}
