// frontend/src/components/workbench/primitives.tsx
//
// Shared layout primitives for Parthenon workbench-style pages (FinnGen
// Cohort Workbench, FinnGen Analysis Gallery, future Morpheus steps, etc.).
// Any page that displays labeled step panels with a header strip, labeled
// sections, panel-framed data tables, and run status strips should use
// these — the workbench feels consistent and future steps inherit polish
// for free.
//
// Note the naming overlap with @/components/ui/Panel (forwardRef, panel-*
// CSS classes) — these are deliberately separate. The ui/Panel primitive
// wraps arbitrary content with CSS-classed chrome; the workbench Panel
// here is a labeled section inside a Shell body, styled with Tailwind
// utilities. Import from this module with the Workbench prefix if you
// need both in one file.
//
// Vocabulary:
//   Shell       — outer card with a header strip (title + optional subtitle)
//                 and a body slot. Use one Shell per "panel" on screen.
//   Section     — labeled group inside a Shell body; for config forms.
//   Panel       — labeled group with its own border, inside a Shell body; for
//                 data displays (tables, charts) that deserve a bordered frame.
//   Divider     — subtle horizontal rule between Sections.
//   StatusStrip — status chip row with running/done/failed states.
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export function Shell({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-border-default bg-surface-raised">
      {(title !== undefined || subtitle !== undefined) && (
        <header className="border-b border-border-default px-4 py-2.5">
          {title !== undefined && (
            <h2 className="text-xs font-semibold text-text-primary">{title}</h2>
          )}
          {subtitle !== undefined && (
            <p className="text-[10px] text-text-ghost">{subtitle}</p>
          )}
        </header>
      )}
      {children}
    </div>
  );
}

export function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-text-ghost">
        {label}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Panel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-text-ghost">
        {label}
      </h3>
      <div className="rounded border border-border-default bg-surface-overlay/30 p-3">
        {children}
      </div>
    </section>
  );
}

export function Divider() {
  return <hr className="border-border-default/60" />;
}

export type RunStatus =
  | "queued"
  | "running"
  | "canceling"
  | "succeeded"
  | "failed"
  | "canceled"
  | string;

export function StatusStrip({
  status,
  runId,
  pollingHint = "polling every 2s",
  ariaLabel = "Run status",
}: {
  status: RunStatus;
  runId?: string;
  pollingHint?: string | null;
  ariaLabel?: string;
}) {
  const isRunning = status === "queued" || status === "running";
  const isDone = status === "succeeded";
  const isFailed = status === "failed" || status === "canceled";
  const tone = isFailed
    ? "text-error"
    : isDone
    ? "text-success"
    : isRunning
    ? "text-info"
    : "text-text-secondary";

  return (
    <div className="flex items-center gap-3 px-4 py-2 text-xs" aria-label={ariaLabel}>
      {isRunning && <Loader2 size={14} className="animate-spin text-info" />}
      {isDone && <CheckCircle2 size={14} className="text-success" />}
      {isFailed && <AlertCircle size={14} className="text-error" />}
      <span className={tone}>
        Status: <span className="font-mono">{status}</span>
      </span>
      {isRunning && pollingHint !== null && (
        <span className="text-text-ghost">{pollingHint}</span>
      )}
      {runId !== undefined && (
        <span className="ml-auto font-mono text-[10px] text-text-ghost" title={runId}>
          {runId.slice(0, 10)}
        </span>
      )}
    </div>
  );
}
