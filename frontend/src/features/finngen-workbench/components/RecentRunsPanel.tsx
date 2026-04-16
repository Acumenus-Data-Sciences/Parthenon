// frontend/src/features/finngen-workbench/components/RecentRunsPanel.tsx
//
// Shows the match + materialize runs that were dispatched from this session.
// Run ids are persisted in session_state.recent_run_ids so they survive
// reload. Each row polls /api/v1/finngen/runs/{id} via useFinnGenRun to
// reflect current status. Caps displayed rows to the latest 10.
import { useFinnGenRun } from "@/features/_finngen-foundation";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  CircleDashed,
  MoveLeft,
  Scale,
  Database,
} from "lucide-react";
import type { ReactNode } from "react";

interface RecentRunsPanelProps {
  runIds: string[];
  activeRunId?: string | null;
  onSelect?: (runId: string, analysisType: string) => void;
}

const MAX_ROWS = 10;

export function RecentRunsPanel({ runIds, activeRunId, onSelect }: RecentRunsPanelProps) {
  if (runIds.length === 0) return null;
  // Newest first — the caller appends in chronological order.
  const recent = runIds.slice(-MAX_ROWS).reverse();
  return (
    <section className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-2">
      <header className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-ghost">
          Recent runs in this session
        </h3>
        <span className="text-[10px] text-text-ghost">
          {Math.min(runIds.length, MAX_ROWS)} of {runIds.length}
        </span>
      </header>
      <ul className="divide-y divide-border-default/40">
        {recent.map((id) => (
          <RunRow
            key={id}
            runId={id}
            highlighted={id === activeRunId}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </section>
  );
}

function RunRow({
  runId,
  highlighted,
  onSelect,
}: {
  runId: string;
  highlighted: boolean;
  onSelect?: (runId: string, analysisType: string) => void;
}) {
  const { data: run, isPending } = useFinnGenRun(runId);
  const analysisType = run?.analysis_type ?? "?";
  const status = run?.status ?? (isPending ? "loading" : "unknown");

  return (
    <li>
      <button
        type="button"
        disabled={run === undefined || onSelect === undefined}
        onClick={() => {
          if (run !== undefined && onSelect !== undefined) onSelect(runId, analysisType);
        }}
        className={[
          "flex w-full items-center gap-3 px-2 py-2 text-left text-xs transition-colors",
          highlighted ? "bg-success/10" : "hover:bg-surface-overlay",
          run === undefined ? "opacity-70" : "",
        ].join(" ")}
      >
        <AnalysisIcon type={analysisType} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-text-secondary">{shortLabel(analysisType)}</span>
            <span className="font-mono text-[10px] text-text-ghost">#{runId.slice(0, 8)}</span>
          </span>
          {run?.created_at !== undefined && (
            <span className="mt-0.5 block text-[10px] text-text-ghost">
              {new Date(run.created_at).toLocaleString()}
            </span>
          )}
        </span>
        <StatusChip status={status} />
      </button>
    </li>
  );
}

function AnalysisIcon({ type }: { type: string }): ReactNode {
  if (type === "cohort.match")
    return <Scale size={14} className="shrink-0 text-info" />;
  if (type === "cohort.materialize")
    return <Database size={14} className="shrink-0 text-success" />;
  return <MoveLeft size={14} className="shrink-0 text-text-ghost" />;
}

function shortLabel(type: string): string {
  if (type === "cohort.match") return "Match";
  if (type === "cohort.materialize") return "Materialize";
  if (type.startsWith("co2.")) return type.slice(4);
  return type;
}

function StatusChip({ status }: { status: string }) {
  const isRunning = status === "queued" || status === "running" || status === "loading";
  const isDone = status === "succeeded";
  const isFailed = status === "failed" || status === "canceled" || status === "canceling";

  const tone = isDone
    ? "text-success"
    : isFailed
    ? "text-error"
    : isRunning
    ? "text-info"
    : "text-text-ghost";
  const icon = isRunning ? (
    <Loader2 size={10} className="animate-spin" />
  ) : isDone ? (
    <CheckCircle2 size={10} />
  ) : isFailed ? (
    <AlertCircle size={10} />
  ) : (
    <CircleDashed size={10} />
  );
  return (
    <span className={["flex shrink-0 items-center gap-1 text-[10px] font-medium", tone].join(" ")}>
      {icon}
      <span className="capitalize">{status}</span>
    </span>
  );
}
