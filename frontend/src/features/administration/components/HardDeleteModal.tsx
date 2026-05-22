import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useBulkDeleteAdminLibrary } from "../hooks/useAdminLibrary";
import type {
  AdminLibraryBulkDeleteResponse,
  AdminLibraryItemRef,
} from "../api/adminLibraryApi";

interface HardDeleteModalProps {
  open: boolean;
  onClose: () => void;
  items: AdminLibraryItemRef[];
  onDeleted?: (ids: number[]) => void;
}

/**
 * Phase D · §6.7 — bulk hard-delete confirmation modal.
 *
 * No separate preflight endpoint — submits to /bulk-delete which returns
 * blocked items as HTTP 422 with `attached_to` Study references. UI then
 * renders the blocked list as deep links and disables retry until the
 * user resolves them (or closes the modal).
 */
export function HardDeleteModal({
  open,
  onClose,
  items,
  onDeleted,
}: HardDeleteModalProps) {
  const mutation = useBulkDeleteAdminLibrary();
  const [result, setResult] = useState<AdminLibraryBulkDeleteResponse | null>(
    null,
  );

  function handleClose() {
    setResult(null);
    mutation.reset();
    onClose();
  }

  async function handleConfirm() {
    try {
      const resp = await mutation.mutateAsync(items);
      setResult(resp);
      if (resp.deleted.length > 0) onDeleted?.(resp.deleted);
      if (!resp.blocked?.length && !resp.errors?.length) {
        handleClose();
      }
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: AdminLibraryBulkDeleteResponse };
      };
      if (axiosErr.response?.status === 422 && axiosErr.response.data) {
        setResult(axiosErr.response.data);
      }
    }
  }

  const blocked = result?.blocked ?? [];
  const errors = result?.errors ?? [];
  const deleted = result?.deleted ?? [];
  const hasBlockers = blocked.length > 0 || errors.length > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Delete ${items.length} library item${items.length === 1 ? "" : "s"}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              variant="danger"
              onClick={handleConfirm}
              disabled={mutation.isPending || items.length === 0}
            >
              {mutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                `Delete ${items.length}`
              )}
            </Button>
          )}
        </>
      }
    >
      {!result && (
        <div className="space-y-3 text-sm text-text-secondary">
          <p>
            Soft-deleted items enter a 30-day grace window. After that they are
            force-deleted by the nightly purge job.
          </p>
          <p className="text-xs text-text-muted">
            Items still attached to a Study are blocked and listed below.
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-4 text-sm">
          {deleted.length > 0 && (
            <p className="text-status-success">
              Deleted {deleted.length} item{deleted.length === 1 ? "" : "s"}.
            </p>
          )}
          {blocked.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-status-warning">
                <AlertTriangle size={16} />
                <span className="font-medium">
                  {blocked.length} blocked — attached to Studies
                </span>
              </div>
              <ul className="space-y-2 rounded-md border border-border-default bg-surface-2 p-3 text-xs">
                {blocked.map((b) => (
                  <li key={`${b.type}-${b.id}`} className="space-y-1">
                    <div className="font-mono text-text-primary">
                      {b.type} #{b.id}
                    </div>
                    <ul className="ml-4 space-y-1">
                      {b.attached_to.map((s) => (
                        <li key={s.study_id}>
                          <a
                            className="text-accent-1 hover:underline"
                            href={`/studies/${s.study_id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {s.study_title} (#{s.study_id})
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-text-muted">
                Remove these items from their Studies first, then retry the
                delete.
              </p>
            </div>
          )}
          {errors.length > 0 && (
            <div className="space-y-2">
              <div className="text-status-critical font-medium">
                {errors.length} error{errors.length === 1 ? "" : "s"}
              </div>
              <ul className="space-y-1 rounded-md border border-border-default bg-surface-2 p-3 text-xs font-mono">
                {errors.map((e) => (
                  <li key={`${e.type}-${e.id}`}>
                    {e.type} #{e.id}: {e.error}
                    {e.status ? ` (status=${e.status})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!hasBlockers && deleted.length === 0 && (
            <p className="text-text-muted">No items processed.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
