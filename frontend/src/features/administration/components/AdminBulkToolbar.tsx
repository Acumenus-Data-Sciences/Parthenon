import { Archive, RotateCcw, Trash2, UserCog, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface Props {
  count: number;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onReassign: () => void;
  onClear: () => void;
  isPending?: boolean;
  className?: string;
}

/**
 * Gold-standard sticky bulk-action bar for the super-admin Library surface.
 * Mirrors the library `BulkActionToolbar` styling but adds the admin-only
 * Delete (hard) and Reassign actions alongside the lifecycle Archive/Restore
 * transitions. Selection may be heterogeneous, so both Archive and Restore are
 * always offered; the backend no-ops transitions that don't apply.
 */
export function AdminBulkToolbar({
  count,
  onArchive,
  onRestore,
  onDelete,
  onReassign,
  onClear,
  isPending = false,
  className,
}: Props) {
  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className={cn(
        "sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg",
        "border border-accent/40 bg-surface-elevated/95 backdrop-blur",
        "px-4 py-2 shadow-sm",
        className,
      )}
    >
      <span className="text-sm font-medium text-text-primary">
        {count} selected
      </span>
      <span className="text-xs text-text-muted">·</span>
      <Button
        variant="danger"
        size="sm"
        onClick={onArchive}
        disabled={isPending}
      >
        <Archive size={14} aria-hidden="true" />
        Archive
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onRestore}
        disabled={isPending}
      >
        <RotateCcw size={14} aria-hidden="true" />
        Restore
      </Button>
      <span className="mx-1 h-5 w-px bg-border-default" aria-hidden="true" />
      <Button variant="danger" size="sm" onClick={onDelete} disabled={isPending}>
        <Trash2 size={14} aria-hidden="true" />
        Delete ({count})
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={onReassign}
        disabled={isPending}
      >
        <UserCog size={14} aria-hidden="true" />
        Reassign ({count})
      </Button>
      <span className="ml-auto" />
      <button
        type="button"
        onClick={onClear}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs",
          "text-text-muted hover:text-text-primary hover:bg-surface-overlay",
          "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        )}
        aria-label={`Clear ${count} from selection`}
      >
        <X size={12} aria-hidden="true" />
        Clear
      </button>
    </div>
  );
}
