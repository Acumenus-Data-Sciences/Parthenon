import { useState } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { useSnapshotsList } from "../../hooks/useSnapshots";
import { CreateSnapshotModal } from "./CreateSnapshotModal";
import { RevertSnapshotDialog } from "./RevertSnapshotDialog";
import type { PublicationSnapshot } from "../../api/publishApi";

interface SnapshotsPanelProps {
  draftId: number;
  defaultLabel: string;
  onReverted: () => void;
}

export function SnapshotsPanel({ draftId, defaultLabel, onReverted }: SnapshotsPanelProps) {
  const { data: snapshots, isLoading } = useSnapshotsList(draftId);
  const [createOpen, setCreateOpen] = useState(false);
  const [revertTarget, setRevertTarget] = useState<PublicationSnapshot | null>(null);

  return (
    <aside className="rounded-xl border border-border-default bg-surface-raised p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Snapshots</h3>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/15"
        >
          <Camera size={12} />New snapshot
        </button>
      </div>

      {isLoading && <div className="mt-3 text-xs text-text-primary/50">Loading…</div>}

      {snapshots && snapshots.length === 0 && (
        <p className="mt-3 text-xs text-text-primary/50">No snapshots yet. Create one to lock in a milestone version.</p>
      )}

      {snapshots && snapshots.length > 0 && (
        <ul className="mt-3 space-y-2">
          {snapshots.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-2 rounded-md bg-surface-base p-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">{s.label}</div>
                {s.comment && <div className="mt-0.5 text-xs text-text-primary/60 line-clamp-2">{s.comment}</div>}
                <div className="mt-1 text-xs text-text-ghost">{new Date(s.created_at).toLocaleString()}</div>
              </div>
              <button
                type="button"
                aria-label={`Revert to ${s.label}`}
                onClick={() => setRevertTarget(s)}
                className="text-text-ghost hover:text-amber-500"
              >
                <RotateCcw size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <CreateSnapshotModal open={createOpen} draftId={draftId} defaultLabel={defaultLabel} onClose={() => setCreateOpen(false)} />
      <RevertSnapshotDialog
        open={revertTarget !== null}
        draftId={draftId}
        snapshot={revertTarget}
        onClose={() => setRevertTarget(null)}
        onReverted={onReverted}
      />
    </aside>
  );
}
