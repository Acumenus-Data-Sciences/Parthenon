import type { StatusTab } from "./StatusTabs";

interface Props {
  statusContext: StatusTab;
  selectedIds: number[];
  onArchive: (ids: number[]) => void;
  onRestore: (ids: number[]) => void;
  onClear: () => void;
}

export function BulkActionToolbar({
  statusContext,
  selectedIds,
  onArchive,
  onRestore,
  onClear,
}: Props) {
  if (selectedIds.length === 0) return null;

  const archiveable =
    statusContext === "active" ||
    statusContext === "draft" ||
    statusContext === "all";
  const restorable = statusContext === "archived";

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 rounded-md bg-zinc-900 px-4 py-2 ring-1 ring-zinc-800">
      <span className="text-sm text-zinc-300">
        {selectedIds.length} selected
      </span>
      {archiveable && (
        <button
          type="button"
          onClick={() => onArchive(selectedIds)}
          className="rounded bg-zinc-800 px-3 py-1 text-sm text-zinc-100 hover:bg-zinc-700"
        >
          Archive {selectedIds.length}
        </button>
      )}
      {restorable && (
        <button
          type="button"
          onClick={() => onRestore(selectedIds)}
          className="rounded bg-zinc-800 px-3 py-1 text-sm text-zinc-100 hover:bg-zinc-700"
        >
          Restore {selectedIds.length}
        </button>
      )}
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-sm text-zinc-400 hover:text-zinc-200"
      >
        Clear
      </button>
    </div>
  );
}
