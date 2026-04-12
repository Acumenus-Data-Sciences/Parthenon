import { useEffect, useState } from "react";
import type { LucideProps } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useExecution } from "../../hooks/useClinicalAnalysis";
import type { ClinicalAnalysisType } from "../../types";
import { ResultCards } from "./ResultCards";

type IconComponent = React.ComponentType<LucideProps>;

// Icon map keyed by analysis type
const TYPE_ICON: Record<ClinicalAnalysisType, string> = {
  characterization: "Users",
  incidence_rate: "TrendingUp",
  estimation: "Scale",
  prediction: "Brain",
  sccs: "Repeat",
  evidence_synthesis: "Layers",
  pathway: "GitBranch",
};

function getIcon(name: string): IconComponent {
  const icons = LucideIcons as unknown as Record<string, IconComponent>;
  return icons[name] ?? LucideIcons.Box;
}

interface PinFinding {
  domain: string;
  section: string;
  finding_type: string;
  finding_payload: Record<string, unknown>;
}

interface ExecutionTrackerProps {
  apiPrefix: string;
  analysisId: number;
  executionId: number;
  analysisType: ClinicalAnalysisType;
  onComplete: (execution: Record<string, unknown>) => void;
  onPinFinding: (finding: PinFinding) => void;
}

const TERMINAL_STATUSES = ["completed", "failed", "cancelled"];

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function ExecutionTracker({
  apiPrefix,
  analysisId,
  executionId,
  analysisType,
  onComplete,
  onPinFinding,
}: ExecutionTrackerProps) {
  const { data: rawExecution } = useExecution(apiPrefix, analysisId, executionId);
  const execution = rawExecution as Record<string, unknown> | undefined;
  const [elapsed, setElapsed] = useState(0);

  const status = (execution?.status as string | undefined) ?? "queued";
  const isTerminal = TERMINAL_STATUSES.includes(status);

  // Elapsed time counter: compare to created_at, runs until terminal
  useEffect(() => {
    if (isTerminal) return;

    const createdAt = execution?.created_at as string | undefined;
    const startTime = createdAt ? new Date(createdAt).getTime() : Date.now();

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isTerminal, execution?.created_at]);

  // Fire onComplete once when status transitions to completed
  useEffect(() => {
    if (status === "completed" && execution) {
      onComplete(execution as Record<string, unknown>);
    }
  }, [status, execution, onComplete]);

  const Icon = getIcon(TYPE_ICON[analysisType]);

  // ── Queued / Pending ──────────────────────────────────────────────────────
  if (status === "queued" || status === "pending") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-base/60 px-4 py-3">
        {/* Pulsing dot */}
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-surface-overlay opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-surface-overlay" />
        </span>
        <span className="text-sm text-text-muted">Waiting in queue...</span>
      </div>
    );
  }

  // ── Running ───────────────────────────────────────────────────────────────
  if (status === "running") {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-border-default bg-surface-base/60 px-4 py-3">
        {/* Animated icon */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10">
          <Icon className="h-4 w-4 animate-pulse text-success" />
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-text-primary">Running...</span>
          <span className="font-mono text-xs text-text-ghost">
            {formatElapsed(elapsed)}
          </span>
        </div>

        {/* Spinning indicator */}
        <div className="ml-auto">
          <svg
            className="h-4 w-4 animate-spin text-success"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      </div>
    );
  }

  // ── Completed ─────────────────────────────────────────────────────────────
  if (status === "completed" && execution) {
    const resultJson = (execution.result_json ?? execution.results ?? {}) as Record<string, unknown>;

    return (
      <div className="flex flex-col gap-3">
        {/* Header bar */}
        <div className="flex items-center gap-2 rounded-t-lg border border-border-default bg-surface-base/60 px-4 py-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-success/10">
            <Icon className="h-3 w-3 text-success" />
          </div>
          <span className="text-xs font-medium text-text-secondary">Results</span>
          <span className="ml-auto font-mono text-[10px] text-text-ghost">
            {formatElapsed(elapsed)}
          </span>
        </div>

        <ResultCards
          analysisType={analysisType}
          result={resultJson}
          onPinFinding={onPinFinding}
        />
      </div>
    );
  }

  // ── Failed ────────────────────────────────────────────────────────────────
  if (status === "failed" || status === "cancelled") {
    const failMessage =
      (execution?.fail_message as string | undefined) ??
      (execution?.error as string | undefined) ??
      "Analysis failed. Check logs for details.";

    return (
      <div className="flex items-start gap-3 rounded-lg border border-primary/50 bg-primary/10 px-4 py-3">
        <LucideIcons.AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-primary">
            {status === "cancelled" ? "Analysis cancelled" : "Analysis failed"}
          </span>
          <span className="text-xs text-text-muted">{failMessage}</span>
        </div>
      </div>
    );
  }

  // Fallback: unknown status — treat as queued
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-base/60 px-4 py-3">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-surface-overlay opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-surface-overlay" />
      </span>
      <span className="text-sm text-text-muted">Initializing...</span>
    </div>
  );
}
