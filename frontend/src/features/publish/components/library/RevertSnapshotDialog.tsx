import { X } from "lucide-react";
import type { PublicationSnapshot } from "../../api/publishApi";
import { useRevertSnapshot } from "../../hooks/useSnapshots";

interface RevertSnapshotDialogProps {
  open: boolean;
  draftId: number;
  snapshot: PublicationSnapshot | null;
  onClose: () => void;
  onReverted: () => void;
}

export function RevertSnapshotDialog({ open, draftId, snapshot, onClose, onReverted }: RevertSnapshotDialogProps) {
  const revert = useRevertSnapshot(draftId);
  if (!open || !snapshot) return null;

  const handleRevert = async () => {
    await revert.mutateAsync(snapshot.id);
    onReverted();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border-default bg-surface-raised p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-text-primary">Revert to "{snapshot.label}"?</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-text-ghost hover:text-text-primary"><X size={18} /></button>
        </div>
        <p className="mt-2 text-sm text-text-primary/70">
          This will replace your current draft with the snapshot from {new Date(snapshot.created_at).toLocaleString()}. Your current state will be saved as a new snapshot labeled "Before revert (auto)".
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-text-primary/70 hover:text-text-primary">Cancel</button>
          <button type="button" onClick={handleRevert} disabled={revert.isPending} className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-surface-base hover:bg-amber-500/90 disabled:opacity-50">
            {revert.isPending ? "Reverting…" : "Revert"}
          </button>
        </div>
      </div>
    </div>
  );
}
