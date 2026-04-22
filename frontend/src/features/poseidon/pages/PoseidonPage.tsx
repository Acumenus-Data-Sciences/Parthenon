import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  GitBranch,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel } from "@/components/ui/Panel";
import {
  usePoseidonDashboard,
  usePoseidonFreshness,
  usePoseidonLineage,
  useTriggerPoseidonRun,
  useCancelPoseidonRun,
  useUpdatePoseidonSchedule,
} from "../hooks/usePoseidon";
import type {
  PoseidonRun,
  PoseidonSchedule,
  PoseidonLineageNode,
  PoseidonFreshness,
} from "../api/poseidonApi";
import { useTranslation } from "react-i18next";
import {
  getPoseidonRunStatusLabel,
  getPoseidonRunTypeLabel,
  getPoseidonScheduleTypeLabel,
  getPoseidonTierLabel,
} from "../lib/i18n";

/* ── Status maps ─────────────────────────────────────────────────────── */

const RUN_STATUS: Record<
  string,
  { variant: "success" | "warning" | "info" | "critical" | "inactive" }
> = {
  pending: { variant: "inactive" },
  running: { variant: "info" },
  success: { variant: "success" },
  failed: { variant: "critical" },
  cancelled: { variant: "inactive" },
};

function runStatusBadge(
  t: ReturnType<typeof useTranslation<"app">>["t"],
  status: string,
) {
  const s = RUN_STATUS[status] ?? {
    variant: "inactive" as const,
  };
  return (
    <Badge variant={s.variant}>{getPoseidonRunStatusLabel(t, status)}</Badge>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.floor((e - s) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainSec}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function isRunActive(run: Pick<PoseidonRun, "status">): boolean {
  return run.status === "pending" || run.status === "running";
}

/* ── Main page ───────────────────────────────────────────────────────── */

export default function PoseidonPage() {
  const { t } = useTranslation("app");
  const dashboardQuery = usePoseidonDashboard();
  const freshnessQuery = usePoseidonFreshness();
  const lineageQuery = usePoseidonLineage();

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (dashboardQuery.error || !dashboardQuery.data) {
    return (
      <Panel>
        <EmptyState
          icon={<Server size={36} />}
          title={t("poseidon.page.unavailableTitle")}
          message={t("poseidon.page.unavailableMessage")}
          action={
            <button
              type="button"
              onClick={() => dashboardQuery.refetch()}
              className="mt-3 text-sm text-success hover:underline"
            >
              {t("poseidon.page.retry")}
            </button>
          }
        />
      </Panel>
    );
  }

  const dashboard = dashboardQuery.data;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            {t("poseidon.page.title")}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {t("poseidon.page.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dashboardQuery.refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-surface-highlight px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          <RefreshCw size={14} />
          {t("poseidon.page.refresh")}
        </button>
      </div>

      {/* Overview metrics */}
      <OverviewMetrics dashboard={dashboard} />

      {/* Schedules panel */}
      <SchedulesPanel
        schedules={dashboard.schedules}
        activeRuns={dashboard.active_runs}
      />

      {/* Recent runs panel */}
      <RecentRunsPanel runs={dashboard.recent_runs} />

      {/* Freshness panel */}
      <FreshnessPanel
        freshness={freshnessQuery.data}
        isLoading={freshnessQuery.isLoading}
        observedAt={freshnessQuery.dataUpdatedAt}
      />

      {/* Lineage panel */}
      <LineagePanel
        lineage={lineageQuery.data}
        isLoading={lineageQuery.isLoading}
      />
    </div>
  );
}

/* ── Overview metrics ────────────────────────────────────────────────── */

function OverviewMetrics({ dashboard }: { dashboard: { active_schedules: number; total_schedules: number; active_runs: number; run_stats: { total: number; success: number; failed: number; active: number } } }) {
  const { t } = useTranslation("app");
  const { run_stats } = dashboard;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label={t("poseidon.overview.activeSchedules")}
        value={`${dashboard.active_schedules} / ${dashboard.total_schedules}`}
        icon={<Calendar size={16} />}
        variant={dashboard.active_schedules > 0 ? "success" : "default"}
      />
      <MetricCard
        label={t("poseidon.overview.runsInProgress")}
        value={dashboard.active_runs}
        icon={<Activity size={16} />}
        variant={dashboard.active_runs > 0 ? "info" : "default"}
      />
      <MetricCard
        label={t("poseidon.overview.successfulRuns")}
        value={run_stats.success}
        icon={<Zap size={16} />}
        variant="success"
        description={t("poseidon.overview.ofTotal", { count: run_stats.total })}
      />
      <MetricCard
        label={t("poseidon.overview.failedRuns")}
        value={run_stats.failed}
        icon={<AlertTriangle size={16} />}
        variant={run_stats.failed > 0 ? "critical" : "default"}
      />
    </div>
  );
}

/* ── Schedules panel ─────────────────────────────────────────────────── */

function SchedulesPanel({
  schedules,
  activeRuns,
}: {
  schedules: PoseidonSchedule[];
  activeRuns: number;
}) {
  const { t } = useTranslation("app");
  const [expanded, setExpanded] = useState(true);
  const triggerMutation = useTriggerPoseidonRun();
  const updateMutation = useUpdatePoseidonSchedule();

  return (
    <Panel
      header={
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-accent" />
            <span className="text-sm font-medium text-text-primary">
              {t("poseidon.schedules.title")}
            </span>
            <Badge variant="inactive">{schedules.length}</Badge>
          </div>
          {expanded ? (
            <ChevronUp size={16} className="text-text-muted" />
          ) : (
            <ChevronDown size={16} className="text-text-muted" />
          )}
        </button>
      }
    >
      {expanded && (
        <>
          {schedules.length === 0 ? (
            <EmptyState
              icon={<Calendar size={28} />}
              title={t("poseidon.schedules.emptyTitle")}
              message={t("poseidon.schedules.emptyMessage")}
            />
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-base px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {schedule.source?.source_name ?? `Source #${schedule.source_id}`}
                      </span>
                      <Badge
                        variant={schedule.is_active ? "success" : "inactive"}
                      >
                        {schedule.is_active
                          ? t("poseidon.schedules.active")
                          : t("poseidon.schedules.paused")}
                      </Badge>
                      <span className="text-xs text-text-muted">
                        {getPoseidonScheduleTypeLabel(
                          t,
                          schedule.schedule_type,
                        )}
                        {schedule.cron_expr && (
                          <span className="ml-1 font-mono text-accent">
                            {schedule.cron_expr}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-text-muted">
                      <span>
                        {t("poseidon.schedules.lastRun", {
                          value: formatDateTime(schedule.last_run_at),
                        })}
                      </span>
                      {schedule.next_run_at && (
                        <span>
                          {t("poseidon.schedules.nextRun", {
                            value: formatDateTime(schedule.next_run_at),
                          })}
                        </span>
                      )}
                      {schedule.runs_count != null && (
                        <span>
                          {t("poseidon.schedules.runCount", {
                            count: schedule.runs_count,
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateMutation.mutate({
                          id: schedule.id,
                          is_active: !schedule.is_active,
                        })
                      }
                      disabled={updateMutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-surface-highlight px-3 py-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
                      title={
                        schedule.is_active
                          ? t("poseidon.schedules.pauseSchedule")
                          : t("poseidon.schedules.activateSchedule")
                      }
                    >
                      {schedule.is_active ? (
                        <Pause size={12} />
                      ) : (
                        <Play size={12} />
                      )}
                      {schedule.is_active
                        ? t("poseidon.schedules.pause")
                        : t("poseidon.schedules.activate")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        triggerMutation.mutate({
                          source_id: schedule.source_id,
                          run_type: "incremental",
                          schedule_id: schedule.id,
                        })
                      }
                      disabled={triggerMutation.isPending || activeRuns > 0}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-surface-base transition-colors hover:bg-success-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {triggerMutation.isPending ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Play size={12} />
                      )}
                      {t("poseidon.schedules.runIncrementalRefresh")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/* ── Recent runs panel ───────────────────────────────────────────────── */

function RecentRunsPanel({ runs }: { runs: PoseidonRun[] }) {
  const { t } = useTranslation("app");
  const [expanded, setExpanded] = useState(true);
  const [selectedRun, setSelectedRun] = useState<PoseidonRun | null>(null);
  const cancelMutation = useCancelPoseidonRun();

  return (
    <Panel
      header={
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-success" />
            <span className="text-sm font-medium text-text-primary">
              {t("poseidon.recentRuns.title")}
            </span>
            <Badge variant="inactive">{runs.length}</Badge>
          </div>
          {expanded ? (
            <ChevronUp size={16} className="text-text-muted" />
          ) : (
            <ChevronDown size={16} className="text-text-muted" />
          )}
        </button>
      }
    >
      {expanded && (
        <>
          {runs.length === 0 ? (
            <EmptyState
              icon={<Activity size={28} />}
              title={t("poseidon.recentRuns.emptyTitle")}
              message={t("poseidon.recentRuns.emptyMessage")}
            />
          ) : (
            <div className="space-y-0">
              {/* Table */}
              <div className="overflow-hidden rounded-lg border border-border-default">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-raised">
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                        {t("poseidon.recentRuns.headers.source")}
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                        {t("poseidon.recentRuns.headers.type")}
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                        {t("poseidon.recentRuns.headers.status")}
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                        {t("poseidon.recentRuns.headers.trigger")}
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-text-muted">
                        {t("poseidon.recentRuns.headers.duration")}
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                        {t("poseidon.recentRuns.headers.started")}
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-text-muted">
                        {t("poseidon.recentRuns.headers.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr
                        key={run.id}
                        onClick={() =>
                          setSelectedRun(
                            selectedRun?.id === run.id ? null : run,
                          )
                        }
                        className={cn(
                          "cursor-pointer border-b border-border-default transition-colors",
                          selectedRun?.id === run.id
                            ? "bg-surface-raised"
                            : "bg-surface-base hover:bg-sidebar-bg-light",
                          isRunActive(run) && "animate-pulse",
                        )}
                      >
                        <td className="px-4 py-2.5 text-sm text-text-primary">
                          {run.source?.source_name ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-text-secondary">
                          {getPoseidonRunTypeLabel(t, run.run_type)}
                        </td>
                        <td className="px-4 py-2.5">
                          {runStatusBadge(t, run.status)}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-text-muted">
                          {run.triggered_by}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm text-text-muted">
                          {formatDuration(run.started_at, run.completed_at)}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-text-muted">
                          {formatDateTime(run.started_at)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {isRunActive(run) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelMutation.mutate(run.id);
                              }}
                              disabled={cancelMutation.isPending}
                              className="text-xs text-primary hover:text-primary-light hover:underline"
                            >
                              {t("poseidon.recentRuns.cancel")}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Inline run detail (click-to-expand) */}
              {selectedRun && <RunDetailInline run={selectedRun} />}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/* ── Run detail inline ───────────────────────────────────────────────── */

function RunDetailInline({ run }: { run: PoseidonRun }) {
  const { t } = useTranslation("app");
  const stats = run.stats;

  return (
    <div className="mt-3 rounded-lg border border-border-default bg-sidebar-bg-light p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-text-primary">
          {t("poseidon.runDetail.title", { id: run.id })}
          <span className="ml-2 font-mono text-xs text-text-muted">
            {run.dagster_run_id}
          </span>
        </h4>
        {runStatusBadge(t, run.status)}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t("poseidon.runDetail.type")}
          value={getPoseidonRunTypeLabel(t, run.run_type)}
          icon={<RefreshCw size={14} />}
        />
        <MetricCard
          label={t("poseidon.runDetail.triggeredBy")}
          value={run.triggered_by}
          icon={<Zap size={14} />}
        />
        <MetricCard
          label={t("poseidon.runDetail.duration")}
          value={formatDuration(run.started_at, run.completed_at)}
          icon={<Clock size={14} />}
        />
        <MetricCard
          label={t("poseidon.runDetail.modelsRun")}
          value={stats?.models_run ?? "—"}
          icon={<Server size={14} />}
        />
      </div>

      {stats && (
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          {stats.rows_inserted != null && (
            <MetricCard
              label={t("poseidon.runDetail.rowsInserted")}
              value={stats.rows_inserted.toLocaleString()}
              variant="success"
            />
          )}
          {stats.rows_updated != null && (
            <MetricCard
              label={t("poseidon.runDetail.rowsUpdated")}
              value={stats.rows_updated.toLocaleString()}
            />
          )}
          {stats.tests_passed != null && (
            <MetricCard
              label={t("poseidon.runDetail.testsPassed")}
              value={stats.tests_passed}
              variant="success"
            />
          )}
          {stats.tests_failed != null && (
            <MetricCard
              label={t("poseidon.runDetail.testsFailed")}
              value={stats.tests_failed}
              variant={stats.tests_failed > 0 ? "critical" : "success"}
            />
          )}
        </div>
      )}

      {run.error_message && (
        <div className="mt-3 rounded-md border border-primary/30 bg-surface-overlay px-3 py-2">
          <div className="text-xs font-medium text-primary">
            {t("poseidon.runDetail.error")}
          </div>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs text-text-secondary">
            {run.error_message}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ── Freshness panel ─────────────────────────────────────────────────── */

function FreshnessPanel({
  freshness,
  isLoading,
  observedAt,
}: {
  freshness: Record<string, PoseidonFreshness> | undefined;
  isLoading: boolean;
  observedAt: number;
}) {
  const { t } = useTranslation("app");
  const [expanded, setExpanded] = useState(false);
  const entries = freshness ? Object.values(freshness) : [];

  return (
    <Panel
      header={
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-accent" />
            <span className="text-sm font-medium text-text-primary">
              {t("poseidon.freshness.title")}
            </span>
            {entries.length > 0 && (
              <Badge variant="inactive">
                {t("poseidon.freshness.assetCount", { count: entries.length })}
              </Badge>
            )}
          </div>
          {expanded ? (
            <ChevronUp size={16} className="text-text-muted" />
          ) : (
            <ChevronDown size={16} className="text-text-muted" />
          )}
        </button>
      }
    >
      {expanded && (
        <>
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-text-muted">
              <Loader2 size={14} className="animate-spin" />
              {t("poseidon.freshness.loading")}
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={<Clock size={28} />}
              title={t("poseidon.freshness.emptyTitle")}
              message={t("poseidon.freshness.emptyMessage")}
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((entry) => {
                const isStale =
                  !entry.last_materialized ||
                  observedAt - new Date(entry.last_materialized).getTime() >
                    24 * 60 * 60 * 1000;
                return (
                  <div
                    key={entry.table}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2",
                      isStale
                        ? "border-accent/30 bg-surface-overlay"
                        : "border-border-default bg-surface-base",
                    )}
                  >
                    <span className="text-sm text-text-primary">
                      {entry.table}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        isStale ? "text-accent" : "text-text-muted",
                      )}
                    >
                      {entry.last_materialized
                        ? formatDateTime(entry.last_materialized)
                        : t("poseidon.freshness.never")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/* ── Lineage panel ───────────────────────────────────────────────────── */

function LineagePanel({
  lineage,
  isLoading,
}: {
  lineage: PoseidonLineageNode[] | undefined;
  isLoading: boolean;
}) {
  const { t } = useTranslation("app");
  const [expanded, setExpanded] = useState(false);
  const nodes = lineage ?? [];

  // Group nodes into tiers based on dependency depth
  const tiers = groupByTier(nodes, t);

  return (
    <Panel
      header={
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-success" />
            <span className="text-sm font-medium text-text-primary">
              {t("poseidon.lineage.title")}
            </span>
            {nodes.length > 0 && (
              <Badge variant="inactive">
                {t("poseidon.lineage.assetCount", { count: nodes.length })}
              </Badge>
            )}
          </div>
          {expanded ? (
            <ChevronUp size={16} className="text-text-muted" />
          ) : (
            <ChevronDown size={16} className="text-text-muted" />
          )}
        </button>
      }
    >
      {expanded && (
        <>
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-text-muted">
              <Loader2 size={14} className="animate-spin" />
              {t("poseidon.lineage.loading")}
            </div>
          ) : nodes.length === 0 ? (
            <EmptyState
              icon={<GitBranch size={28} />}
              title={t("poseidon.lineage.emptyTitle")}
              message={t("poseidon.lineage.emptyMessage")}
            />
          ) : (
            <div className="space-y-4">
              {tiers.map(({ label, items }, tierIdx) => (
                <div key={label}>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
                    {label}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((node) => (
                      <div
                        key={node.key}
                        className="rounded-md border border-border-default bg-surface-base px-3 py-1.5"
                      >
                        <div className="text-xs font-medium text-text-primary">
                          {node.key}
                        </div>
                        {node.dependencies.length > 0 && (
                          <div className="mt-0.5 text-[10px] text-text-muted">
                            {t("poseidon.lineage.dependsOn", {
                              dependencies: node.dependencies.join(", "),
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {tierIdx < tiers.length - 1 && (
                    <div className="mt-3 flex justify-center text-text-ghost">
                      <ChevronDown size={16} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/* ── Lineage tier grouping ───────────────────────────────────────────── */

interface Tier {
  label: string;
  items: PoseidonLineageNode[];
}

function groupByTier(
  nodes: PoseidonLineageNode[],
  t: ReturnType<typeof useTranslation<"app">>["t"],
): Tier[] {
  if (nodes.length === 0) return [];

  const depMap = new Map(nodes.map((n) => [n.key, n.dependencies]));

  // Compute depth for each node
  const depths = new Map<string, number>();
  function getDepth(key: string, visited: Set<string> = new Set()): number {
    if (depths.has(key)) return depths.get(key)!;
    if (visited.has(key)) return 0; // cycle guard
    visited.add(key);
    const deps = depMap.get(key) ?? [];
    const depth =
      deps.length === 0 ? 0 : Math.max(...deps.map((d) => getDepth(d, visited))) + 1;
    depths.set(key, depth);
    return depth;
  }

  for (const node of nodes) {
    getDepth(node.key);
  }

  const maxDepth = Math.max(...depths.values());
  const tiers: Tier[] = [];

  for (let d = 0; d <= maxDepth; d++) {
    const items = nodes.filter((n) => depths.get(n.key) === d);
    if (items.length > 0) {
      tiers.push({
        label: getPoseidonTierLabel(t, d),
        items,
      });
    }
  }

  return tiers;
}
