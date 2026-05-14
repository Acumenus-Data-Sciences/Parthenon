import { Check, AlertCircle, Loader2, CircleDashed } from "lucide-react";
import type { SaveStatus } from "../../hooks/useAutosave";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSavedAt: string | null;
  onRetry: () => void;
}

function relative(iso: string | null): string {
  if (!iso) return "";
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function SaveStatusIndicator({ status, lastSavedAt, onRetry }: SaveStatusIndicatorProps) {
  switch (status) {
    case "saving":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-text-primary/60" aria-live="polite">
          <Loader2 size={12} className="animate-spin" />Saving…
        </span>
      );
    case "saved":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-success" aria-live="polite">
          <Check size={12} />Saved {relative(lastSavedAt)}
        </span>
      );
    case "unsaved":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-500" aria-live="polite">
          <CircleDashed size={12} />Unsaved changes
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-danger" aria-live="polite">
          <AlertCircle size={12} />Save failed
          <button type="button" onClick={onRetry} className="underline hover:no-underline">Retry</button>
        </span>
      );
    default:
      return null;
  }
}
