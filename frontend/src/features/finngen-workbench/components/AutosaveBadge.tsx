// frontend/src/features/finngen-workbench/components/AutosaveBadge.tsx
//
// Status badge for the workbench header. Reads AutosaveStatus and renders
// one of four states with a consistent icon + text treatment:
//   saving   — spinner, "Saving…"  (cyan)
//   pending  — clock, "Unsaved" (amber)
//   error    — alert, "Save failed" (red, mutation.error.message in title)
//   saved    — check, "Saved HH:MM:SS" (subtle green)
//   idle     — nothing shown until at least one save attempt fires
//
// The badge lives in the WorkbenchPage header so the researcher always
// knows whether their current work is persisted.
import { useEffect, useState } from "react";
import { Loader2, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import type { AutosaveStatus } from "../hooks/useWorkbenchSession";

interface AutosaveBadgeProps {
  status: AutosaveStatus;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function AutosaveBadge({ status }: AutosaveBadgeProps) {
  // Force a rerender every 30s so "Saved" text stays fresh relative to clock.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status.lastSavedAt === null) return;
    const h = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(h);
  }, [status.lastSavedAt]);

  if (status.saving) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded bg-info/10 px-2 py-0.5 text-[10px] font-medium text-info">
        <Loader2 size={10} className="animate-spin" /> Saving…
      </span>
    );
  }
  if (status.error !== null) {
    return (
      <span
        title={status.error.message}
        className="inline-flex items-center gap-1.5 rounded bg-error/10 px-2 py-0.5 text-[10px] font-medium text-error"
      >
        <AlertCircle size={10} /> Save failed
      </span>
    );
  }
  if (status.pending) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
        <Clock size={10} /> Unsaved
      </span>
    );
  }
  if (status.lastSavedAt !== null) {
    return (
      <span
        title={status.lastSavedAt.toLocaleString()}
        className="inline-flex items-center gap-1.5 rounded bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success"
      >
        <CheckCircle2 size={10} /> Saved {formatTime(status.lastSavedAt)}
      </span>
    );
  }
  return null;
}
