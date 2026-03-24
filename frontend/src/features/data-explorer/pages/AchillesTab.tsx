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
import type { AchillesRunSummary } from "../api/achillesRunApi";

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
    rowClass: "border-[#E85A6B]/20 bg-[#E85A6B]/5",
    badgeClass: "bg-[#E85A6B]/15 text-[#E85A6B] border border-[#E85A6B]/30",
    iconClass: "text-[#E85A6B]",
    barColor: "#E85A6B",
  },
  warning: {
    label: "Warnings",
    icon: AlertCircle,
    rowClass: "border-[#C9A227]/20 bg-[#C9A227]/5",
    badgeClass: "bg-[#C9A227]/15 text-[#C9A227] border border-[#C9A227]/30",
    iconClass: "text-[#C9A227]",
    barColor: "#C9A227",
  },
  notification: {
    label: "Notifications",
    icon: AlertCircle,
    rowClass: "border-[#3B82F6]/20 bg-[#3B82F6]/5",
    badgeClass: "bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30",
    iconClass: "text-[#3B82F6]",
    barColor: "#3B82F6",
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
      <span className="text-xs text-[#5A5650]">{cfg.label.toLowerCase()}</span>
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
          <span className="text-xs font-medium text-[#F0EDE8]">{result.rule_name}</span>
          <SeverityBadge severity={result.severity} />
        </div>
        {result.attribute_name && (
          <p className="mt-0.5 text-xs text-[#8A857D]">
            <span className="text-[#C5C0B8]">{result.attribute_name}</span>
            {result.attribute_value != null && (
              <span className="ml-1">= {result.attribute_value}</span>
            )}
          </p>
        )}
      </div>
      <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8] shrink-0">
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
        <h3 className="text-sm font-semibold text-[#F0EDE8] uppercase tracking-wide flex items-center gap-2">
          <ShieldCheck size={15} className="text-[#2DD4BF]" />
          Heel Checks
        </h3>
        <button
          type="button"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending || isRunning}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg bg-[#9B1B30] px-3 py-1.5 text-xs font-medium text-[#F0EDE8]",
            "hover:bg-[#B82D42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
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
            className="inline-flex items-center gap-2 rounded-lg border border-[#232328] bg-[#151518] px-3 py-1.5 text-xs text-[#C5C0B8] hover:bg-[#1A1A1E] transition-colors w-full"
          >
            <History size={12} className="text-[#8A857D]" />
            {activeRunId ? `Run ${activeRunId.slice(0, 8)}...` : "Select run"}
            <ChevronDown size={10} className="text-[#8A857D] ml-auto" />
          </button>
          {showRunSelector && (
            <div className="absolute top-full left-0 z-10 mt-1 w-full rounded-lg border border-[#232328] bg-[#1A1A1E] shadow-xl">
              {heelRuns.data.map((run) => (
                <button
                  key={run.run_id}
                  type="button"
                  onClick={() => { setSelectedRunId(run.run_id); setShowRunSelector(false); }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-[#232328] transition-colors",
                    run.run_id === activeRunId ? "text-[#C9A227]" : "text-[#C5C0B8]",
                  )}
                >
                  <span className="font-['IBM_Plex_Mono',monospace]">{run.run_id.slice(0, 12)}</span>
                  <span className="text-[#5A5650]">{new Date(run.started_at).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {runMutation.isError && (
        <span className="text-xs text-[#E85A6B]">Failed to dispatch heel checks</span>
      )}

      {/* Live progress */}
      {isRunning && progressQuery.data && (
        <div className="rounded-xl border border-[#232328] bg-[#151518] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[#C9A227] animate-pulse" />
            <span className="text-xs text-[#F0EDE8]">Running heel checks...</span>
            <span className="ml-auto font-['IBM_Plex_Mono',monospace] text-sm text-[#C9A227]">
              {progressQuery.data.percentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#1A1A1E]">
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
          <Loader2 size={16} className="animate-spin text-[#8A857D]" />
        </div>
      )}

      {/* No results */}
      {!isRunning && !isLoading && !hasResults && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#151518] py-8">
          <ShieldCheck size={24} className="mb-2 text-[#5A5650]" />
          <p className="text-xs text-[#8A857D]">No heel checks run yet</p>
        </div>
      )}

      {/* Summary banner */}
      {hasResults && (
        <div className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2",
          totalErrors > 0 ? "border-[#E85A6B]/20 bg-[#E85A6B]/5"
            : totalWarnings > 0 ? "border-[#C9A227]/20 bg-[#C9A227]/5"
            : "border-[#2DD4BF]/20 bg-[#2DD4BF]/5",
        )}>
          {totalErrors > 0 ? <AlertCircle size={14} className="shrink-0 text-[#E85A6B]" />
            : totalWarnings > 0 ? <AlertCircle size={14} className="shrink-0 text-[#C9A227]" />
            : <CheckCircle2 size={14} className="shrink-0 text-[#2DD4BF]" />}
          <p className="text-xs text-[#C5C0B8]">
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
        <h3 className="text-sm font-semibold text-[#F0EDE8] uppercase tracking-wide flex items-center gap-2">
          <Zap size={15} className="text-[#C9A227]" />
          Achilles Characterization
        </h3>
        <button
          type="button"
          onClick={handleRun}
          disabled={runMutation.isPending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg bg-[#9B1B30] px-3 py-1.5 text-xs font-medium text-[#F0EDE8]",
            "hover:bg-[#B82D42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
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
        <span className="text-xs text-[#E85A6B]">Failed to dispatch Achilles run</span>
      )}

      {/* Run history dropdown */}
      {achillesRuns.data && achillesRuns.data.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRunSelector(!showRunSelector)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#232328] bg-[#151518] px-3 py-1.5 text-xs text-[#C5C0B8] hover:bg-[#1A1A1E] transition-colors w-full"
          >
            <History size={12} className="text-[#8A857D]" />
            {displayRun
              ? `${displayRun.started_at ? new Date(displayRun.started_at).toLocaleString() : displayRunId?.slice(0, 8)}`
              : "Select run"}
            <ChevronDown size={10} className="text-[#8A857D] ml-auto" />
          </button>
          {showRunSelector && (
            <div className="absolute top-full left-0 z-10 mt-1 w-full rounded-lg border border-[#232328] bg-[#1A1A1E] shadow-xl max-h-48 overflow-y-auto">
              {achillesRuns.data.map((run) => (
                <button
                  key={run.run_id}
                  type="button"
                  onClick={() => { setSelectedHistoryRun(run.run_id); setShowRunSelector(false); }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-[#232328] transition-colors",
                    run.run_id === displayRunId ? "text-[#C9A227]" : "text-[#C5C0B8]",
                  )}
                >
                  <span className="font-['IBM_Plex_Mono',monospace]">
                    {run.started_at ? new Date(run.started_at).toLocaleString() : run.run_id.slice(0, 12)}
                  </span>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    run.status === "completed" ? "text-[#2DD4BF] bg-[#2DD4BF]/10"
                      : run.status === "failed" ? "text-[#E85A6B] bg-[#E85A6B]/10"
                      : run.status === "running" ? "text-[#C9A227] bg-[#C9A227]/10"
                      : "text-[#5A5650]",
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
        <div className="rounded-xl border border-[#232328] bg-[#151518] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A857D]">Status</span>
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              displayRun.status === "completed" ? "text-[#2DD4BF] bg-[#2DD4BF]/10"
                : displayRun.status === "failed" ? "text-[#E85A6B] bg-[#E85A6B]/10"
                : displayRun.status === "running" ? "text-[#C9A227] bg-[#C9A227]/10"
                : "text-[#5A5650] bg-[#5A5650]/10",
            )}>
              {displayRun.status}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="font-['IBM_Plex_Mono',monospace] text-lg text-[#F0EDE8]">
                {displayRun.total_analyses}
              </div>
              <div className="text-xs text-[#5A5650]">total</div>
            </div>
            <div className="text-center">
              <div className="font-['IBM_Plex_Mono',monospace] text-lg text-[#2DD4BF]">
                {displayRun.completed_analyses}
              </div>
              <div className="text-xs text-[#5A5650]">passed</div>
            </div>
            <div className="text-center">
              <div className="font-['IBM_Plex_Mono',monospace] text-lg text-[#E85A6B]">
                {displayRun.failed_analyses}
              </div>
              <div className="text-xs text-[#5A5650]">failed</div>
            </div>
          </div>
          {displayRun.started_at && displayRun.completed_at && (
            <div className="flex items-center gap-1.5 text-xs text-[#5A5650]">
              <Clock size={11} />
              Duration: {((new Date(displayRun.completed_at).getTime() - new Date(displayRun.started_at).getTime()) / 1000).toFixed(1)}s
            </div>
          )}
          {displayRun.status === "running" && (
            <button
              type="button"
              onClick={() => { setActiveRunId(displayRun.run_id); setTotalAnalyses(displayRun.total_analyses); setShowModal(true); }}
              className="w-full rounded-lg bg-[#C9A227]/10 px-3 py-1.5 text-xs font-medium text-[#C9A227] hover:bg-[#C9A227]/20 transition-colors"
            >
              View Live Progress
            </button>
          )}
        </div>
      )}

      {/* No runs yet */}
      {(!achillesRuns.data || achillesRuns.data.length === 0) && !achillesRuns.isLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#151518] py-8">
          <Zap size={24} className="mb-2 text-[#5A5650]" />
          <p className="text-xs text-[#8A857D]">No Achilles runs yet</p>
          <p className="mt-0.5 text-xs text-[#5A5650]">Click "Run Achilles" to characterize your data</p>
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
