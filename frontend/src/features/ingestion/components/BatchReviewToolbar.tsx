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
        "border-[#232328] bg-[#151518]",
      )}
    >
      {/* Select all checkbox */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={isAllSelected ? onDeselectAll : onSelectAll}
          className="h-4 w-4 rounded border-[#323238] bg-[#0E0E11] text-[#9B1B30] focus:ring-[#9B1B30] focus:ring-offset-0 accent-[#9B1B30]"
        />
        <span className="text-xs font-medium text-[#C5C0B8]">
          Select All in View
        </span>
      </label>

      {/* Divider */}
      <div className="h-5 w-px bg-[#232328]" />

      {/* Selected count */}
      <span className="text-xs text-[#8A857D]">
        <span className="font-medium text-[#F0EDE8] tabular-nums font-['IBM_Plex_Mono',monospace]">
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
          "bg-[#2DD4BF]/15 text-[#2DD4BF] hover:bg-[#2DD4BF]/25",
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
          "bg-[#E85A6B]/15 text-[#E85A6B] hover:bg-[#E85A6B]/25",
          "disabled:opacity-40 disabled:cursor-not-allowed",
        )}
      >
        <XCircle size={14} />
        Reject All Selected
      </button>
    </div>
  );
}
