import type { FinnGenRunStatus } from "../types";

const CLASSNAMES: Record<FinnGenRunStatus, string> = {
  queued: "bg-slate-700/40 text-slate-200 border-slate-500/40",
  running: "bg-cyan-700/30 text-cyan-200 border-cyan-500/40",
  canceling: "bg-amber-700/30 text-amber-200 border-amber-500/40",
  succeeded: "bg-emerald-700/30 text-emerald-200 border-emerald-500/40",
  failed: "bg-rose-700/30 text-rose-200 border-rose-500/40",
  canceled: "bg-zinc-700/30 text-zinc-300 border-zinc-500/40",
};

const LABELS: Record<FinnGenRunStatus, string> = {
  queued: "Queued",
  running: "Running",
  canceling: "Canceling",
  succeeded: "Succeeded",
  failed: "Failed",
  canceled: "Canceled",
};

export type RunStatusBadgeProps = {
  status: FinnGenRunStatus;
  className?: string;
};

export function RunStatusBadge({ status, className = "" }: RunStatusBadgeProps) {
  const classes = CLASSNAMES[status];
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${classes} ${className}`}
      data-testid={`finngen-run-status-${status}`}
    >
      {LABELS[status]}
    </span>
  );
}
