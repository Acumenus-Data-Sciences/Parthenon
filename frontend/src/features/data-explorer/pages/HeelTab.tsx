import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  PlayCircle,
  ShieldCheck,
  History,
  ChevronDown,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useHeelResults,
  useHeelRuns,
  useHeelProgress,
} from "../hooks/useAchillesData";
import { runHeel } from "../api/achillesApi";
import type { HeelProgress } from "../api/achillesApi";
import type { HeelResult, HeelSeverity } from "../types/dataExplorer";

interface HeelTabProps {
  sourceId: number;
}

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
    icon: AlertTriangle,
    rowClass: "border-[#C9A227]/20 bg-[#C9A227]/5",
    badgeClass: "bg-[#C9A227]/15 text-[#C9A227] border border-[#C9A227]/30",
    iconClass: "text-[#C9A227]",
    barColor: "#C9A227",
  },
  notification: {
    label: "Notifications",
    icon: Info,
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

function HeelResultRow({ result }: { result: HeelResult }) {
  const cfg = SEVERITY_CONFIG[result.severity];
  const Icon = cfg.icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-4", cfg.rowClass)}>
      <Icon size={16} className={cn("mt-0.5 shrink-0", cfg.iconClass)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[#F0EDE8]">{result.rule_name}</span>
          <SeverityBadge severity={result.severity} />
        </div>
        {result.attribute_name && (
          <p className="mt-1 text-xs text-[#8A857D]">
            <span className="text-[#C5C0B8]">{result.attribute_name}</span>
            {result.attribute_value != null && (
              <span className="ml-1 text-[#8A857D]">= {result.attribute_value}</span>
            )}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span className="font-['IBM_Plex_Mono',monospace] text-sm text-[#C5C0B8]">
          {result.record_count.toLocaleString()}
        </span>
        <p className="text-xs text-[#5A5650]">records</p>
      </div>
    </div>
  );
}

function SeveritySection({
  severity,
  results,
}: {
  severity: HeelSeverity;
  results: HeelResult[];
}) {
  const cfg = SEVERITY_CONFIG[severity];
  const Icon = cfg.icon;

  if (results.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon size={15} className={cfg.iconClass} />
        <h3 className="text-sm font-semibold text-[#C5C0B8] uppercase tracking-wide">
          {cfg.label}
        </h3>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cfg.badgeClass)}>
          {results.length}
        </span>
      </div>
      <div className="space-y-2">
        {results.map((r) => (
          <HeelResultRow key={r.id} result={r} />
        ))}
      </div>
    </div>
  );
}

function HeelProgressPanel({ progress }: { progress: HeelProgress }) {
  const pct = progress.percentage;

  return (
    <div className="space-y-4">
      {/* Overall progress */}
      <div className="rounded-xl border border-[#232328] bg-[#151518] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity size={18} className="text-[#C9A227] animate-pulse" />
            <div>
              <h3 className="text-sm font-medium text-[#F0EDE8]">
                Heel Checks Running
              </h3>
              <p className="text-xs text-[#5A5650] mt-0.5">
                {progress.rules_completed} of {progress.total_rules} rules completed
              </p>
            </div>
          </div>
          <span className="text-2xl font-semibold font-['IBM_Plex_Mono',monospace] text-[#C9A227]">
            {pct.toFixed(1)}%
          </span>
        </div>

        {/* Main progress bar */}
        <div className="h-3 w-full overflow-hidden rounded-full bg-[#1A1A1E]">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, #C9A227 0%, #2DD4BF 100%)",
            }}
          />
        </div>

        {/* Result counts by severity */}
        <div className="flex items-center gap-6 mt-3">
          {progress.by_severity.map((sev) => {
            const cfg = SEVERITY_CONFIG[sev.severity as HeelSeverity];
            if (!cfg || sev.count === 0) return null;
            const Icon = cfg.icon;
            return (
              <div key={sev.severity} className="flex items-center gap-1.5">
                <Icon size={12} className={cfg.iconClass} />
                <span
                  className="text-xs font-['IBM_Plex_Mono',monospace]"
                  style={{ color: cfg.barColor }}
                >
                  {sev.count}
                </span>
                <span className="text-xs text-[#5A5650]">{cfg.label.toLowerCase()}</span>
              </div>
            );
          })}
          {progress.total_results === 0 && (
            <span className="text-xs text-[#5A5650]">Analyzing Achilles results...</span>
          )}
        </div>
      </div>

      {/* Per-severity breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {(["error", "warning", "notification"] as const).map((sev) => {
          const cfg = SEVERITY_CONFIG[sev];
          const sevData = progress.by_severity.find((s) => s.severity === sev);
          const count = sevData?.count ?? 0;
          const rules = sevData?.rules ?? 0;

          return (
            <div
              key={sev}
              className="rounded-xl border border-[#232328] bg-[#151518] p-4"
              style={{ borderColor: count > 0 ? cfg.barColor + "33" : undefined }}
            >
              <div className="flex items-center gap-2 mb-2">
                <cfg.icon size={14} className={cfg.iconClass} />
                <span className="text-sm font-medium" style={{ color: cfg.barColor }}>
                  {cfg.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-xl font-semibold font-['IBM_Plex_Mono',monospace]"
                  style={{ color: count > 0 ? cfg.barColor : "#5A5650" }}
                >
                  {count}
                </span>
                <span className="text-xs text-[#5A5650]">
                  issues from {rules} rule{rules !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Latest rule indicator */}
      {progress.latest_rule && (
        <div className="flex items-center gap-2 rounded-lg border border-[#232328] bg-[#0E0E11] px-4 py-2.5">
          <Loader2 size={12} className="animate-spin text-[#C9A227]" />
          <span className="text-xs text-[#5A5650]">Last completed:</span>
          <span className="text-xs font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
            {progress.latest_rule.rule_name}
          </span>
          <SeverityBadge severity={progress.latest_rule.severity as HeelSeverity} />
        </div>
      )}
    </div>
  );
}

export default function HeelTab({ sourceId }: HeelTabProps) {
  const queryClient = useQueryClient();
  const [activeRunIdLive, setActiveRunIdLive] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showRunSelector, setShowRunSelector] = useState(false);

  // Fetch runs and results
  const heelRuns = useHeelRuns(sourceId);
  const activeRunId = selectedRunId ?? heelRuns.data?.[0]?.run_id ?? null;

  // Auto-detect in-progress run on mount
  const detectRunId = activeRunIdLive === null ? (heelRuns.data?.[0]?.run_id ?? null) : null;
  const detectProgress = useHeelProgress(sourceId, detectRunId);

  useEffect(() => {
    if (
      activeRunIdLive === null &&
      detectProgress.data &&
      (detectProgress.data.status === "running" || detectProgress.data.status === "pending")
    ) {
      setActiveRunIdLive(detectProgress.data.run_id);
    }
  }, [activeRunIdLive, detectProgress.data]);

  // Fetch results for completed run (pass run_id to get specific run)
  const { data, isLoading } = useHeelResults(activeRunIdLive ? 0 : sourceId);

  // Live progress polling
  const progressQuery = useHeelProgress(sourceId, activeRunIdLive);

  // When progress completes, stop polling and refresh
  useEffect(() => {
    if (progressQuery.data?.status === "completed" && activeRunIdLive) {
      setActiveRunIdLive(null);
      queryClient.invalidateQueries({ queryKey: ["achilles", "heel", sourceId] });
      queryClient.invalidateQueries({ queryKey: ["heel", "runs", sourceId] });
    }
  }, [progressQuery.data?.status, activeRunIdLive, sourceId, queryClient]);

  // Dispatch mutation
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
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending || isRunning}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-4 py-2.5 text-sm font-medium text-[#F0EDE8]",
            "hover:bg-[#B82D42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {runMutation.isPending || isRunning ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <PlayCircle size={14} />
          )}
          {isRunning ? "Running..." : "Run Heel Checks"}
        </button>

        {/* Run history selector */}
        {heelRuns.data && heelRuns.data.length > 0 && !isRunning && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowRunSelector(!showRunSelector)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#C5C0B8] hover:bg-[#1A1A1E] transition-colors"
            >
              <History size={14} className="text-[#8A857D]" />
              {activeRunId
                ? `Run ${activeRunId.slice(0, 8)}...`
                : "Select run"}
              <ChevronDown size={12} className="text-[#8A857D]" />
            </button>
            {showRunSelector && (
              <div className="absolute top-full left-0 z-10 mt-1 w-64 rounded-lg border border-[#232328] bg-[#1A1A1E] shadow-xl">
                {heelRuns.data.map((run) => (
                  <button
                    key={run.run_id}
                    type="button"
                    onClick={() => {
                      setSelectedRunId(run.run_id);
                      setShowRunSelector(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-[#232328] transition-colors",
                      run.run_id === activeRunId
                        ? "text-[#C9A227]"
                        : "text-[#C5C0B8]",
                    )}
                  >
                    <span className="font-['IBM_Plex_Mono',monospace] text-xs">
                      {run.run_id.slice(0, 12)}
                    </span>
                    <span className="text-xs text-[#5A5650]">
                      {new Date(run.started_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {runMutation.isError && (
          <span className="text-xs text-[#E85A6B]">Failed to dispatch heel checks</span>
        )}
      </div>

      {/* Live progress panel */}
      {isRunning && progressQuery.data && (
        <HeelProgressPanel progress={progressQuery.data} />
      )}

      {/* Loading state for completed results */}
      {!isRunning && isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-[#8A857D]" />
        </div>
      )}

      {/* No results yet */}
      {!isRunning && !isLoading && !hasResults && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#151518] py-16">
          <ShieldCheck size={32} className="mb-3 text-[#5A5650]" />
          <p className="text-sm text-[#8A857D]">No heel checks run yet</p>
          <p className="mt-1 text-xs text-[#5A5650]">
            Click "Run Heel Checks" to validate your data against OHDSI quality rules
          </p>
        </div>
      )}

      {/* Summary banner */}
      {hasResults && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3",
            totalErrors > 0
              ? "border-[#E85A6B]/20 bg-[#E85A6B]/5"
              : totalWarnings > 0
                ? "border-[#C9A227]/20 bg-[#C9A227]/5"
                : "border-[#2DD4BF]/20 bg-[#2DD4BF]/5",
          )}
        >
          {totalErrors > 0 ? (
            <AlertCircle size={16} className="shrink-0 text-[#E85A6B]" />
          ) : totalWarnings > 0 ? (
            <AlertTriangle size={16} className="shrink-0 text-[#C9A227]" />
          ) : (
            <CheckCircle2 size={16} className="shrink-0 text-[#2DD4BF]" />
          )}
          <p className="text-sm text-[#C5C0B8]">
            {totalIssues === 0
              ? "All Achilles Heel checks passed — no data quality issues detected."
              : `${totalIssues} issue${totalIssues !== 1 ? "s" : ""} found: ${totalErrors} error${totalErrors !== 1 ? "s" : ""}, ${totalWarnings} warning${totalWarnings !== 1 ? "s" : ""}, ${totalNotifications} notification${totalNotifications !== 1 ? "s" : ""}.`}
          </p>
        </div>
      )}

      {/* Results by severity */}
      {hasResults && totalIssues > 0 && (
        <div className="space-y-6">
          <SeveritySection severity="error" results={data.error} />
          <SeveritySection severity="warning" results={data.warning} />
          <SeveritySection severity="notification" results={data.notification} />
        </div>
      )}
    </div>
  );
}
