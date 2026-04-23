import type { FinnGenRunStatus } from "../types";

// Phase 15 (Plan 15-06): widen the badge's accepted status to include
// 'superseded' — a tracking-row-only terminal state set when a GWAS run is
// overwritten per 15-CONTEXT D-10. The raw `finngen.runs.status` enum (the
// `FinnGenRunStatus` union) does NOT include this state; it is emitted only by
// the Phase 15 `finngen.endpoint_gwas_runs` tracking table. Keeping the union
// widened locally (rather than editing `types.ts`) isolates the change to the
// one component that needs it.
export type RunStatusBadgeStatus = FinnGenRunStatus | "superseded";

const CLASSNAMES: Record<RunStatusBadgeStatus, string> = {
  queued: "bg-slate-700/40 text-slate-200 border-slate-500/40",
  running: "bg-cyan-700/30 text-cyan-200 border-cyan-500/40",
  canceling: "bg-amber-700/30 text-amber-200 border-amber-500/40",
  succeeded: "bg-emerald-700/30 text-emerald-200 border-emerald-500/40",
  failed: "bg-rose-700/30 text-rose-200 border-rose-500/40",
  canceled: "bg-zinc-700/30 text-zinc-300 border-zinc-500/40",
  superseded: "border-zinc-700/40 bg-zinc-900/40 text-zinc-500",
};

const LABELS: Record<RunStatusBadgeStatus, string> = {
  queued: "Queued",
  running: "Running",
  canceling: "Canceling",
  succeeded: "Succeeded",
  failed: "Failed",
  canceled: "Canceled",
  superseded: "Superseded",
};

// Phase 260423-qvz: animated dot indicator. 'running' pulses via animate-ping
// (ripple), 'queued' fades via animate-pulse; terminal states show a static
// dot colored to match the pill's semantic tone.
const DOT_CLASSNAMES: Record<RunStatusBadgeStatus, string> = {
  queued: "h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse",
  running: "h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse",
  canceling: "h-1.5 w-1.5 rounded-full bg-amber-300",
  succeeded: "h-1.5 w-1.5 rounded-full bg-emerald-300",
  failed: "h-1.5 w-1.5 rounded-full bg-rose-300",
  canceled: "h-1.5 w-1.5 rounded-full bg-zinc-400",
  superseded: "h-1.5 w-1.5 rounded-full bg-zinc-600",
};

export type RunStatusBadgeProps = {
  status: RunStatusBadgeStatus;
  className?: string;
};

export function RunStatusBadge({ status, className = "" }: RunStatusBadgeProps) {
  const classes = CLASSNAMES[status];
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${classes} ${className}`}
      data-testid={`finngen-run-status-${status}`}
    >
      <span
        aria-hidden="true"
        className={`mr-1.5 inline-block ${DOT_CLASSNAMES[status]}`}
      />
      {LABELS[status]}
    </span>
  );
}
