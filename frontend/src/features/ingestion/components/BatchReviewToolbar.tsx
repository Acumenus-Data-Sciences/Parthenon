import { CheckCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface BatchReviewToolbarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchAccept: () => void;
  onBatchReject: () => void;
  isAllSelected: boolean;
}

export function BatchReviewToolbar({
  selectedCount,
  onSelectAll,
  onDeselectAll,
  onBatchAccept,
  onBatchReject,
  isAllSelected,
}: BatchReviewToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border px-4 py-2.5",
        "border-border-default bg-surface-raised",
      )}
    >
      {/* Select all checkbox */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={isAllSelected ? onDeselectAll : onSelectAll}
          className="h-4 w-4 rounded border-surface-highlight bg-surface-base text-primary focus:ring-primary focus:ring-offset-0 accent-primary"
        />
        <span className="text-xs font-medium text-text-secondary">
          Select All in View
        </span>
      </label>

      {/* Divider */}
      <div className="h-5 w-px bg-surface-elevated" />

      {/* Selected count */}
      <span className="text-xs text-text-muted">
        <span className="font-medium text-text-primary tabular-nums font-['IBM_Plex_Mono',monospace]">
          {selectedCount}
        </span>{" "}
        selected
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Batch actions */}
      <button
        type="button"
        onClick={onBatchAccept}
        disabled={selectedCount === 0}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
          "bg-success/15 text-success hover:bg-success/25",
          "disabled:opacity-40 disabled:cursor-not-allowed",
        )}
      >
        <CheckCheck size={14} />
        Accept All Selected
      </button>

      <button
        type="button"
        onClick={onBatchReject}
        disabled={selectedCount === 0}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
          "bg-critical/15 text-critical hover:bg-critical/25",
          "disabled:opacity-40 disabled:cursor-not-allowed",
        )}
      >
        <XCircle size={14} />
        Reject All Selected
      </button>
    </div>
  );
}
