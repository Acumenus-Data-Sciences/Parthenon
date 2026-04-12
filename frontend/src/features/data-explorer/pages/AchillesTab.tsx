import { useState, useEffect, lazy, Suspense } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PlayCircle,
  Loader2,
  ShieldCheck,
  History,
  ChevronDown,
  Activity,
  CheckCircle2,
  AlertCircle,
  Zap,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAchillesRuns, useRunAchilles } from "../hooks/useAchillesRun";
import {
  useHeelResults,
  useHeelRuns,
  useHeelProgress,
} from "../hooks/useAchillesData";
import { runHeel } from "../api/achillesApi";
import type { HeelResult, HeelSeverity } from "../types/dataExplorer";


const AchillesRunModal = lazy(() => import("../components/AchillesRunModal"));

interface AchillesTabProps {
  sourceId: number;
}

// ── Heel components (extracted from old HeelTab) ─────────────────────────────

const SEVERITY_CONFIG: Record<
  HeelSeverity,
  { label: string; icon: typeof AlertCircle; rowClass: string; badgeClass: string; iconClass: string; barColor: string }
> = {
  error: {
    label: "Errors",
    icon: AlertCircle,
    rowClass: "border-critical/20 bg-critical/5",
    badgeClass: "bg-critical/15 text-critical border border-critical/30",
    iconClass: "text-critical",
    barColor: "var(--critical)",
  },
  warning: {
    label: "Warnings",
    icon: AlertCircle,
    rowClass: "border-accent/20 bg-accent/5",
    badgeClass: "bg-accent/15 text-accent border border-accent/30",
    iconClass: "text-accent",
    barColor: "var(--accent)",
  },
  notification: {
    label: "Notifications",
    icon: AlertCircle,
    rowClass: "border-info/20 bg-info/5",
    badgeClass: "bg-info/15 text-info border border-info/30",
    iconClass: "text-info",
    barColor: "var(--info)",
  },
};

function SeverityBadge({ severity }: { severity: HeelSeverity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cfg.badgeClass)}>
      {severity}
    </span>
  );
}

function SeverityRow({ severity, count }: { severity: HeelSeverity; count: number }) {
  const cfg = SEVERITY_CONFIG[severity];
  const Icon = cfg.icon;
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <Icon size={13} className={cfg.iconClass} />
      <span className="text-xs font-medium" style={{ color: cfg.barColor }}>{count}</span>
      <span className="text-xs text-text-ghost">{cfg.label.toLowerCase()}</span>
    </div>
  );
}

function HeelResultRow({ result }: { result: HeelResult }) {
  const cfg = SEVERITY_CONFIG[result.severity];
  const Icon = cfg.icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-3", cfg.rowClass)}>
      <Icon size={14} className={cn("mt-0.5 shrink-0", cfg.iconClass)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-text-primary">{result.rule_name}</span>
          <SeverityBadge severity={result.severity} />
        </div>
        {result.attribute_name && (
          <p className="mt-0.5 text-xs text-text-muted">
            <span className="text-text-secondary">{result.attribute_name}</span>
            {result.attribute_value != null && (
              <span className="ml-1">= {result.attribute_value}</span>
            )}
          </p>
        )}
      </div>
      <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-secondary shrink-0">
        {result.record_count.toLocaleString()}
      </span>
    </div>
  );
}

// ── Heel Panel (right column) ────────────────────────────────────────────────

function HeelPanel({ sourceId }: { sourceId: number }) {
  const queryClient = useQueryClient();
  const [activeRunIdLive, setActiveRunIdLive] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showRunSelector, setShowRunSelector] = useState(false);

  const heelRuns = useHeelRuns(sourceId);
  const activeRunId = selectedRunId ?? heelRuns.data?.[0]?.run_id ?? null;
  const detectRunId = activeRunIdLive === null ? (heelRuns.data?.[0]?.run_id ?? null) : null;
  const detectProgress = useHeelProgress(sourceId, detectRunId);

  useEffect(() => {
    if (activeRunIdLive === null && detectProgress.data &&
        (detectProgress.data.status === "running" || detectProgress.data.status === "pending")) {
      setActiveRunIdLive(detectProgress.data.run_id);
    }
  }, [activeRunIdLive, detectProgress.data]);

  const { data, isLoading } = useHeelResults(activeRunIdLive ? 0 : sourceId);
  const progressQuery = useHeelProgress(sourceId, activeRunIdLive);

  useEffect(() => {
    if (progressQuery.data?.status === "completed" && activeRunIdLive) {
      setActiveRunIdLive(null);
      queryClient.invalidateQueries({ queryKey: ["achilles", "heel", sourceId] });
      queryClient.invalidateQueries({ queryKey: ["heel", "runs", sourceId] });
    }
  }, [progressQuery.data?.status, activeRunIdLive, sourceId, queryClient]);

  // Inline mutation (not useRunHeel) because we need onSuccess to capture run_id for live progress
  const runMutation = useMutation({
    mutationFn: () => runHeel(sourceId),
    onSuccess: (result) => {
      setActiveRunIdLive(result.run_id);
      queryClient.invalidateQueries({ queryKey: ["heel", "runs", sourceId] });
    },
  });

  const isRunning = activeRunIdLive != null;
  const totalErrors = data?.error.length ?? 0;
  const totalWarnings = data?.warning.length ?? 0;
  const totalNotifications = data?.notification.length ?? 0;
  const totalIssues = totalErrors + totalWarnings + totalNotifications;
  const hasResults = data != null && !isRunning;

  return (
    <div className="space-y-4">
      {/* Header + button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide flex items-center gap-2">
          <ShieldCheck size={15} className="text-success" />
          Heel Checks
        </h3>
        <button
          type="button"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending || isRunning}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-text-primary",
            "hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {runMutation.isPending || isRunning ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <PlayCircle size={12} />
          )}
          {isRunning ? "Running..." : "Run Heel Checks"}
        </button>
      </div>

      {/* Run history selector */}
      {heelRuns.data && heelRuns.data.length > 0 && !isRunning && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRunSelector(!showRunSelector)}
            className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-overlay transition-colors w-full"
          >
            <History size={12} className="text-text-muted" />
            {activeRunId ? `Run ${activeRunId.slice(0, 8)}...` : "Select run"}
            <ChevronDown size={10} className="text-text-muted ml-auto" />
          </button>
          {showRunSelector && (
            <div className="absolute top-full left-0 z-10 mt-1 w-full rounded-lg border border-border-default bg-surface-overlay shadow-xl">
              {heelRuns.data.map((run) => (
                <button
                  key={run.run_id}
                  type="button"
                  onClick={() => { setSelectedRunId(run.run_id); setShowRunSelector(false); }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-surface-elevated transition-colors",
                    run.run_id === activeRunId ? "text-accent" : "text-text-secondary",
                  )}
                >
                  <span className="font-['IBM_Plex_Mono',monospace]">{run.run_id.slice(0, 12)}</span>
                  <span className="text-text-ghost">{new Date(run.started_at).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {runMutation.isError && (
        <span className="text-xs text-critical">Failed to dispatch heel checks</span>
      )}

      {/* Live progress */}
      {isRunning && progressQuery.data && (
        <div className="rounded-xl border border-border-default bg-surface-raised p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-accent animate-pulse" />
            <span className="text-xs text-text-primary">Running heel checks...</span>
            <span className="ml-auto font-['IBM_Plex_Mono',monospace] text-sm text-accent">
              {progressQuery.data.percentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-overlay">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progressQuery.data.percentage}%`, background: "linear-gradient(90deg, #C9A227, #2DD4BF)" }}
            />
          </div>
          <div className="flex gap-4">
            {progressQuery.data.by_severity.map((sev) => (
              <SeverityRow key={sev.severity} severity={sev.severity as HeelSeverity} count={sev.count} />
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {!isRunning && isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin text-text-muted" />
        </div>
      )}

      {/* No results */}
      {!isRunning && !isLoading && !hasResults && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-highlight bg-surface-raised py-8">
          <ShieldCheck size={24} className="mb-2 text-text-ghost" />
          <p className="text-xs text-text-muted">No heel checks run yet</p>
        </div>
      )}

      {/* Summary banner */}
      {hasResults && (
        <div className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2",
          totalErrors > 0 ? "border-critical/20 bg-critical/5"
            : totalWarnings > 0 ? "border-accent/20 bg-accent/5"
            : "border-success/20 bg-success/5",
        )}>
          {totalErrors > 0 ? <AlertCircle size={14} className="shrink-0 text-critical" />
            : totalWarnings > 0 ? <AlertCircle size={14} className="shrink-0 text-accent" />
            : <CheckCircle2 size={14} className="shrink-0 text-success" />}
          <p className="text-xs text-text-secondary">
            {totalIssues === 0
              ? "All checks passed"
              : `${totalIssues} issue${totalIssues !== 1 ? "s" : ""}: ${totalErrors}E / ${totalWarnings}W / ${totalNotifications}N`}
          </p>
        </div>
      )}

      {/* Results */}
      {hasResults && totalIssues > 0 && (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {(["error", "warning", "notification"] as const).map((sev) => {
            const results = data[sev];
            if (results.length === 0) return null;
            return results.map((r) => <HeelResultRow key={r.id} result={r} />);
          })}
        </div>
      )}
    </div>
  );
}

// ── Achilles Panel (left column) ─────────────────────────────────────────────

function AchillesPanel({ sourceId }: { sourceId: number }) {
  const [showModal, setShowModal] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [totalAnalyses, setTotalAnalyses] = useState(0);
  const [selectedHistoryRun, setSelectedHistoryRun] = useState<string | null>(null);
  const [showRunSelector, setShowRunSelector] = useState(false);

  const achillesRuns = useAchillesRuns(sourceId);
  const runMutation = useRunAchilles(sourceId);

  const displayRunId = selectedHistoryRun ?? achillesRuns.data?.[0]?.run_id ?? null;
  const displayRun = achillesRuns.data?.find((r) => r.run_id === displayRunId);

  const handleRun = () => {
    runMutation.mutate(undefined, {
      onSuccess: (result) => {
        setActiveRunId(result.run_id);
        setTotalAnalyses(result.total_analyses);
        setShowModal(true);
      },
    });
  };

  const handleModalClose = () => {
    setShowModal(false);
    setActiveRunId(null);
    // Refresh run history
    achillesRuns.refetch();
  };

  return (
    <div className="space-y-4">
      {/* Header + button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide flex items-center gap-2">
          <Zap size={15} className="text-accent" />
          Achilles Characterization
        </h3>
        <button
          type="button"
          onClick={handleRun}
          disabled={runMutation.isPending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-text-primary",
            "hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {runMutation.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <PlayCircle size={12} />
          )}
          Run Achilles
        </button>
      </div>

      {runMutation.isError && (
        <span className="text-xs text-critical">Failed to dispatch Achilles run</span>
      )}

      {/* Run history dropdown */}
      {achillesRuns.data && achillesRuns.data.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRunSelector(!showRunSelector)}
            className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-overlay transition-colors w-full"
          >
            <History size={12} className="text-text-muted" />
            {displayRun
              ? `${displayRun.started_at ? new Date(displayRun.started_at).toLocaleString() : displayRunId?.slice(0, 8)}`
              : "Select run"}
            <ChevronDown size={10} className="text-text-muted ml-auto" />
          </button>
          {showRunSelector && (
            <div className="absolute top-full left-0 z-10 mt-1 w-full rounded-lg border border-border-default bg-surface-overlay shadow-xl max-h-48 overflow-y-auto">
              {achillesRuns.data.map((run) => (
                <button
                  key={run.run_id}
                  type="button"
                  onClick={() => { setSelectedHistoryRun(run.run_id); setShowRunSelector(false); }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-surface-elevated transition-colors",
                    run.run_id === displayRunId ? "text-accent" : "text-text-secondary",
                  )}
                >
                  <span className="font-['IBM_Plex_Mono',monospace]">
                    {run.started_at ? new Date(run.started_at).toLocaleString() : run.run_id.slice(0, 12)}
                  </span>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    run.status === "completed" ? "text-success bg-success/10"
                      : run.status === "failed" ? "text-critical bg-critical/10"
                      : run.status === "running" ? "text-accent bg-accent/10"
                      : "text-text-ghost",
                  )}>
                    {run.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected run summary */}
      {displayRun && (
        <div className="rounded-xl border border-border-default bg-surface-raised p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Status</span>
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              displayRun.status === "completed" ? "text-success bg-success/10"
                : displayRun.status === "failed" ? "text-critical bg-critical/10"
                : displayRun.status === "running" ? "text-accent bg-accent/10"
                : "text-text-ghost bg-text-ghost/10",
            )}>
              {displayRun.status}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="font-['IBM_Plex_Mono',monospace] text-lg text-text-primary">
                {displayRun.total_analyses}
              </div>
              <div className="text-xs text-text-ghost">total</div>
            </div>
            <div className="text-center">
              <div className="font-['IBM_Plex_Mono',monospace] text-lg text-success">
                {displayRun.completed_analyses}
              </div>
              <div className="text-xs text-text-ghost">passed</div>
            </div>
            <div className="text-center">
              <div className="font-['IBM_Plex_Mono',monospace] text-lg text-critical">
                {displayRun.failed_analyses}
              </div>
              <div className="text-xs text-text-ghost">failed</div>
            </div>
          </div>
          {displayRun.started_at && displayRun.completed_at && (
            <div className="flex items-center gap-1.5 text-xs text-text-ghost">
              <Clock size={11} />
              Duration: {((new Date(displayRun.completed_at).getTime() - new Date(displayRun.started_at).getTime()) / 1000).toFixed(1)}s
            </div>
          )}
          <button
            type="button"
            onClick={() => { setActiveRunId(displayRun.run_id); setTotalAnalyses(displayRun.total_analyses); setShowModal(true); }}
            className={cn(
              "w-full rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              displayRun.status === "running"
                ? "bg-accent/10 text-accent hover:bg-accent/20"
                : "bg-surface-elevated text-text-secondary hover:bg-surface-accent",
            )}
          >
            {displayRun.status === "running" ? "View Live Progress" : "View Details"}
          </button>
        </div>
      )}

      {/* No runs yet */}
      {(!achillesRuns.data || achillesRuns.data.length === 0) && !achillesRuns.isLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-highlight bg-surface-raised py-8">
          <Zap size={24} className="mb-2 text-text-ghost" />
          <p className="text-xs text-text-muted">No Achilles runs yet</p>
          <p className="mt-0.5 text-xs text-text-ghost">Click "Run Achilles" to characterize your data</p>
        </div>
      )}

      {/* Modal */}
      {showModal && activeRunId && (
        <Suspense fallback={null}>
          <AchillesRunModal
            sourceId={sourceId}
            runId={activeRunId}
            totalAnalyses={totalAnalyses}
            onClose={handleModalClose}
          />
        </Suspense>
      )}
    </div>
  );
}

// ── Main Tab ─────────────────────────────────────────────────────────────────

export default function AchillesTab({ sourceId }: AchillesTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <AchillesPanel sourceId={sourceId} />
      <HeelPanel sourceId={sourceId} />
    </div>
  );
}
