import { useMemo } from "react";
import { RotateCcw, GitCompare, Clock } from "lucide-react";
import { CLINICAL_ANALYSIS_REGISTRY } from "../../clinicalRegistry";
import type { ClinicalAnalysisGroup, ClinicalAnalysisType, Investigation } from "../../types";

// ── Constants ──────────────────────────────────────────────────────────────

const GROUP_COLOR: Record<ClinicalAnalysisGroup, string> = {
  characterize: "var(--success)",
  compare: "var(--primary)",
  predict: "var(--accent)",
};

type QueuedStatus = "configured" | "queued" | "running" | "complete" | "failed";

const STATUS_CONFIG: Record<
  QueuedStatus,
  { label: string; dotClass: string; textClass: string; bgClass: string; borderClass: string }
> = {
  complete: {
    label: "Completed",
    dotClass: "bg-success",
    textClass: "text-success",
    bgClass: "bg-success/10",
    borderClass: "border-success/20",
  },
  running: {
    label: "Running",
    dotClass: "bg-warning animate-pulse",
    textClass: "text-warning",
    bgClass: "bg-warning/10",
    borderClass: "border-warning/20",
  },
  queued: {
    label: "Queued",
    dotClass: "bg-warning animate-pulse",
    textClass: "text-warning",
    bgClass: "bg-warning/10",
    borderClass: "border-warning/20",
  },
  configured: {
    label: "Pending",
    dotClass: "bg-surface-overlay",
    textClass: "text-text-muted",
    bgClass: "bg-surface-raised/10",
    borderClass: "border-border-default",
  },
  failed: {
    label: "Failed",
    dotClass: "bg-primary",
    textClass: "text-primary",
    bgClass: "bg-primary/10",
    borderClass: "border-primary/30",
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffSecs = Math.floor((now - then) / 1000);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;

  return new Date(isoString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

interface RunHistoryPanelProps {
  investigation: Investigation;
  onSelectExecution: (
    apiPrefix: string,
    analysisId: number,
    executionId: number,
    type: ClinicalAnalysisType,
  ) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function RunHistoryPanel({
  investigation,
  onSelectExecution,
}: RunHistoryPanelProps) {
  const { queued_analyses } = investigation.clinical_state;

  // Only show entries that have an execution_id; sort most recent first
  const rows = useMemo(() => {
    return [...queued_analyses]
      .filter((qa) => qa.execution_id !== null)
      .sort((a, b) => {
        // Sort by execution_id descending (higher id = more recent) as a stable proxy
        return (b.execution_id ?? 0) - (a.execution_id ?? 0);
      });
  }, [queued_analyses]);

  // Count completed executions per analysis_type for the Compare button
  const completedCountByType = useMemo(() => {
    const counts: Partial<Record<ClinicalAnalysisType, number>> = {};
    for (const qa of queued_analyses) {
      if (qa.status === "complete") {
        counts[qa.analysis_type] = (counts[qa.analysis_type] ?? 0) + 1;
      }
    }
    return counts;
  }, [queued_analyses]);

  // ── Empty state ─────────────────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-default bg-surface-base/30 px-6 py-14 text-center">
        <Clock className="h-8 w-8 text-text-ghost" />
        <p className="text-sm text-text-ghost">
          No analyses have been run yet. Select an analysis from the gallery to get started.
        </p>
      </div>
    );
  }

  // ── Row list ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2">
      {rows.map((qa) => {
        const executionId = qa.execution_id as number; // guaranteed non-null by filter above

        const descriptor = CLINICAL_ANALYSIS_REGISTRY.find((d) => d.type === qa.analysis_type);
        const analysisName = descriptor?.name ?? qa.analysis_type;
        const group = descriptor?.group ?? "characterize";
        const accent = GROUP_COLOR[group as ClinicalAnalysisGroup];

        const statusKey = qa.status as QueuedStatus;
        const sc = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.configured;

        const isComplete = qa.status === "complete";
        const showCompare = isComplete && (completedCountByType[qa.analysis_type] ?? 0) >= 2;

        // Derive a rough "created_at" from config if available, else omit timestamp
        const createdAt =
          typeof qa.config?.created_at === "string" ? qa.config.created_at : null;

        return (
          <div
            key={`${qa.analysis_id}-${executionId}`}
            className="group flex items-center gap-3 rounded-lg border border-border-default bg-surface-base/50 px-4 py-3 transition-colors hover:border-border-default"
          >
            {/* Group accent stripe */}
            <div
              className="h-8 w-0.5 shrink-0 rounded-full"
              style={{ backgroundColor: accent }}
            />

            {/* Type badge */}
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                color: accent,
                backgroundColor: `${accent}18`,
              }}
            >
              {group}
            </span>

            {/* Analysis name */}
            <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
              {analysisName}
            </span>

            {/* Timestamp */}
            {createdAt && (
              <span className="shrink-0 text-[11px] text-text-ghost">
                {formatRelativeTime(createdAt)}
              </span>
            )}

            {/* Status badge */}
            <span
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${sc.bgClass} ${sc.borderClass} ${sc.textClass}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${sc.dotClass}`} />
              {sc.label}
            </span>

            {/* Compare button (2+ completed of same type) */}
            {showCompare && (
              <button
                type="button"
                disabled
                title="Coming in Phase 4"
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-border-default bg-surface-raised px-2.5 py-1 text-[11px] text-text-ghost opacity-50 cursor-not-allowed"
              >
                <GitCompare className="h-3 w-3" />
                Compare
              </button>
            )}

            {/* Replay button (completed executions) */}
            {isComplete && (
              <button
                type="button"
                onClick={() =>
                  onSelectExecution(qa.api_prefix, qa.analysis_id, executionId, qa.analysis_type)
                }
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-border-default bg-surface-raised px-2.5 py-1 text-[11px] text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
                title="View or replay this execution"
              >
                <RotateCcw className="h-3 w-3" />
                Replay
              </button>
            )}

            {/* View button for non-completed executions with an execution_id */}
            {!isComplete && (
              <button
                type="button"
                onClick={() =>
                  onSelectExecution(qa.api_prefix, qa.analysis_id, executionId, qa.analysis_type)
                }
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-border-default bg-surface-raised px-2.5 py-1 text-[11px] text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
                title="View execution details"
              >
                View
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
