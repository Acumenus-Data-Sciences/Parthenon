import { Archive, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type { StatusTab } from "./StatusTabs";

interface Props {
  statusContext: StatusTab;
  selectedIds: number[];
  onArchive: (ids: number[]) => void;
  onRestore: (ids: number[]) => void;
  onClear: () => void;
  itemNoun?: string;
  isPending?: boolean;
  className?: string;
}

export function BulkActionToolbar({
  statusContext,
  selectedIds,
  onArchive,
  onRestore,
  onClear,
  itemNoun = "items",
  isPending = false,
  className,
}: Props) {
  if (selectedIds.length === 0) return null;

  const archiveable =
    statusContext === "active" ||
    statusContext === "draft" ||
    statusContext === "all";
  const restorable = statusContext === "archived";

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className={cn(
        "sticky top-0 z-10 flex items-center gap-3 rounded-lg",
        "border border-accent/40 bg-surface-elevated/95 backdrop-blur",
        "px-4 py-2 shadow-sm",
        className,
      )}
    >
      <span className="text-sm font-medium text-text-primary">
        {selectedIds.length} selected
      </span>
      <span className="text-xs text-text-muted">·</span>
      {archiveable && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => onArchive(selectedIds)}
          disabled={isPending}
        >
          <Archive size={14} aria-hidden="true" />
          Archive {selectedIds.length}
        </Button>
      )}
      {restorable && (
        <Button
          variant="primary"
          size="sm"
          onClick={() => onRestore(selectedIds)}
          disabled={isPending}
        >
          <RotateCcw size={14} aria-hidden="true" />
          Restore {selectedIds.length}
        </Button>
      )}
      <span className="ml-auto" />
      <button
        type="button"
        onClick={onClear}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs",
          "text-text-muted hover:text-text-primary hover:bg-surface-overlay",
          "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        )}
        aria-label={`Clear ${selectedIds.length} ${itemNoun} from selection`}
      >
        <X size={12} aria-hidden="true" />
        Clear
      </button>
    </div>
  );
}
