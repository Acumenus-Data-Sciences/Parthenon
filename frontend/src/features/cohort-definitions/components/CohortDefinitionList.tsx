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
  if (!generation) {
    return (
      <span className="text-xs text-text-ghost">No generations</span>
    );
  }

  const latest = generation;

  const config = {
    pending: { icon: Clock, color: "var(--text-muted)", label: "Pending" },
    queued: { icon: Clock, color: "var(--accent)", label: "Queued" },
    running: { icon: Loader2, color: "var(--info)", label: "Running" },
    completed: { icon: CheckCircle2, color: "var(--success)", label: "Completed" },
    failed: { icon: XCircle, color: "var(--critical)", label: "Failed" },
    cancelled: { icon: Clock, color: "var(--text-muted)", label: "Cancelled" },
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
  if (!tier) return <span className="text-xs text-text-ghost">--</span>;
  const config: Record<string, { color: string; label: string; Icon: typeof Shield }> = {
    "study-ready": { color: "var(--success)", label: "Study-Ready", Icon: Shield },
    validated: { color: "var(--accent)", label: "Validated", Icon: Award },
    draft: { color: 'var(--text-ghost)', label: "Draft", Icon: FileText },
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
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-500">
      <AlertTriangle size={10} />
      Deprecated
    </span>
  );
}

interface Props {
  tags?: string[];
  search?: string;
  isPublic?: boolean;
  withGenerations?: boolean;
  onCreateFromBundle?: () => void;
  groupBy?: "domain" | null;
  tierFilter?: string | null;
}

export function CohortDefinitionList({ tags, search, isPublic, withGenerations, onCreateFromBundle, groupBy, tierFilter }: Props) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [myOnly, setMyOnly] = useState(true);
  const currentUser = useAuthStore((s) => s.user);
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
    author_id: myOnly && currentUser ? currentUser.id : undefined,
    enabled: isGrouped,
  });

  // Auto-expand first 3 groups on initial load
  useEffect(() => {
    if (groupedData?.data?.groups && expandedGroups.size === 0) {
      const firstThree = groupedData.data.groups.slice(0, 3).map((g) => g.key);
      setExpandedGroups(new Set(firstThree));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedData?.data?.groups]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, tags, isPublic, withGenerations, myOnly]);

  const { data, isLoading, error } = useCohortDefinitions({
    page,
    limit,
    tags,
    search,
    is_public: isPublic || undefined,
    with_generations: withGenerations || undefined,
    author_id: myOnly && currentUser ? currentUser.id : undefined,
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
        {/* My / All toggle */}
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
            My Definitions
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
            All Definitions
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
            <Layers size={24} className="text-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-text-primary">No cohort definitions</h3>
            <p className="mt-2 text-sm text-text-muted">No definitions match the current filters.</p>
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
                            Name
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                            Tier
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                            N
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                            Sources
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
                            Updated
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.cohorts.map((def, i) => (
                          <tr
                            key={def.id}
                            onClick={() => navigate(`/cohort-definitions/${def.id}`)}
                            className={cn(
                              "border-t border-surface-overlay transition-colors hover:bg-surface-overlay cursor-pointer",
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
        <p className="text-critical">Failed to load cohort definitions</p>
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
              className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-medium text-surface-base hover:bg-success transition-colors"
            >
              <Plus size={16} />
              New Cohort Definition
            </button>
            {onCreateFromBundle && (
              <button
                type="button"
                onClick={onCreateFromBundle}
                className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-secondary hover:border-surface-highlight transition-colors"
              >
                <Stethoscope size={16} />
                Create from Care Bundle
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
          onClick={() => setMyOnly(true)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            myOnly
              ? "bg-surface-elevated text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-secondary",
          )}
        >
          <User size={12} />
          My Definitions
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
          All Definitions
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-overlay">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Name
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Tier
              </th>
              {!myOnly && (
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Author
                </th>
              )}
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Tags
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Latest Generation
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Generated Against
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((def, i) => (
              <tr
                key={def.id}
                onClick={() => navigate(`/cohort-definitions/${def.id}`)}
                className={cn(
                  "border-t border-surface-overlay transition-colors hover:bg-surface-overlay cursor-pointer",
                  i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                  def.deprecated_at && "opacity-60",
                )}
              >
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
                  <TierBadge tier={def.quality_tier} />
                </td>
                {!myOnly && (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-text-muted flex items-center gap-2">
            Showing {(page - 1) * limit + 1} -{" "}
            {Math.min(page * limit, total)} of {total}
            {engine === "solr" && (
              <span className="inline-flex items-center rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-success">
                Solr
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
    </div>
  );
}
