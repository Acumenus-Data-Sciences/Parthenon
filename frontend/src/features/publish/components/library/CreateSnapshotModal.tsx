import { useState } from "react";
import { X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useCreateSnapshot } from "../../hooks/useSnapshots";

interface CreateSnapshotModalProps {
  open: boolean;
  draftId: number;
  defaultLabel: string;
  onClose: () => void;
}

export function CreateSnapshotModal({ open, draftId, defaultLabel, onClose }: CreateSnapshotModalProps) {
  const [label, setLabel] = useState(defaultLabel);
  const [comment, setComment] = useState("");
  const [idempotencyKey] = useState(() => uuidv4());
  const create = useCreateSnapshot(draftId);

  if (!open) return null;

  const handleCreate = async () => {
    if (!label.trim()) return;
    await create.mutateAsync({ label: label.trim(), comment: comment.trim() || undefined, idempotency_key: idempotencyKey });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border-default bg-surface-raised p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-text-primary">Create snapshot</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-text-ghost hover:text-text-primary"><X size={18} /></button>
        </div>
        <label className="mt-4 block text-xs font-medium text-text-primary/70">
          Label
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Pre-IRB submission"
            className="mt-1 w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-text-primary/70">
          Comment (optional)
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Sent to S. Udoshi for review"
            className="mt-1 w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </label>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-text-primary/70 hover:text-text-primary">Cancel</button>
          <button type="button" onClick={handleCreate} disabled={!label.trim() || create.isPending} className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-surface-base hover:bg-accent/90 disabled:opacity-50">
            {create.isPending ? "Creating…" : "Create snapshot"}
          </button>
        </div>
      </div>
    </div>
  );
}
