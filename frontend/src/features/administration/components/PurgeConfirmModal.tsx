import { Loader2, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { adminItemTypeLabel } from "../lib/adminLibraryEntityMap";
import type { AdminLibraryItemRef } from "../api/adminLibraryApi";

interface Props {
  open: boolean;
  items: AdminLibraryItemRef[];
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Immediate force-delete confirmation for one or more trashed items. Replaces
 * the native `confirm()` so the trash surface matches the gold-standard modal
 * pattern used elsewhere in the admin library (HardDeleteModal /
 * ReassignOwnerModal).
 */
export function PurgeConfirmModal({
  open,
  items,
  isPending = false,
  onConfirm,
  onClose,
}: Props) {
  const count = items.length;
  const single = count === 1 ? items[0] : null;

  return (
    <Modal
      open={open}
      onClose={isPending ? () => undefined : onClose}
      title={count > 1 ? `Purge ${count} items` : "Purge immediately"}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Purging…
              </>
            ) : count > 1 ? (
              `Purge ${count}`
            ) : (
              "Purge now"
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-text-secondary">
        <div className="flex items-center gap-2 text-status-critical">
          <AlertTriangle size={16} aria-hidden="true" />
          <span className="font-medium">This cannot be undone.</span>
        </div>
        <p>
          {single ? (
            <>
              Force-delete{" "}
              <span className="font-medium text-text-primary">
                {adminItemTypeLabel(single.type)} #{single.id}
              </span>{" "}
              immediately, bypassing the 30-day grace window.
            </>
          ) : (
            <>
              Force-delete{" "}
              <span className="font-medium text-text-primary">
                {count} items
              </span>{" "}
              immediately, bypassing the 30-day grace window.
            </>
          )}{" "}
          A pre-purge snapshot is written to the audit log.
        </p>
      </div>
    </Modal>
  );
}
