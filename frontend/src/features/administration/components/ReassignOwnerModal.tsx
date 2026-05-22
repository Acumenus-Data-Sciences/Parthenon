import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useReassignAdminLibrary } from "../hooks/useAdminLibrary";
import type {
  AdminLibraryItemRef,
  AdminLibraryReassignResponse,
} from "../api/adminLibraryApi";

interface ReassignOwnerModalProps {
  open: boolean;
  onClose: () => void;
  items: AdminLibraryItemRef[];
}

const CONFIRM_TOKEN = "confirm";

/**
 * Phase D · §6.8 — bulk reassign-owner modal.
 *
 * Requires an explicit typed "confirm" token before submission to prevent
 * accidental mass reassignment. The backend rejects targets that lack the
 * relevant `.view` permission for each item's domain; those come back as a
 * blocked[] list which the modal renders with the required permission slug.
 */
export function ReassignOwnerModal({
  open,
  onClose,
  items,
}: ReassignOwnerModalProps) {
  const mutation = useReassignAdminLibrary();
  const [targetEmail, setTargetEmail] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<AdminLibraryReassignResponse | null>(
    null,
  );

  function handleClose() {
    setTargetEmail("");
    setConfirmText("");
    setResult(null);
    mutation.reset();
    onClose();
  }

  async function handleSubmit() {
    try {
      const resp = await mutation.mutateAsync({
        target_email: targetEmail.trim(),
        items,
      });
      setResult(resp);
      if (!resp.blocked?.length && !resp.errors?.length) {
        handleClose();
      }
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: AdminLibraryReassignResponse };
      };
      if (axiosErr.response?.status === 422 && axiosErr.response.data) {
        setResult(axiosErr.response.data);
      }
    }
  }

  const canSubmit =
    targetEmail.includes("@") &&
    confirmText === CONFIRM_TOKEN &&
    items.length > 0 &&
    !mutation.isPending;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Reassign ${items.length} library item${items.length === 1 ? "" : "s"}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {mutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Reassign"
              )}
            </Button>
          )}
        </>
      }
    >
      {!result && (
        <div className="space-y-4 text-sm">
          <div className="space-y-1">
            <label className="block text-text-secondary" htmlFor="target-email">
              Target user email
            </label>
            <input
              id="target-email"
              type="email"
              className="form-input w-full"
              placeholder="researcher@example.org"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-text-muted">
              The target must hold the relevant <code>.view</code> permission
              for each item's domain (concept-sets, cohorts, or analyses).
            </p>
          </div>
          <div className="space-y-1">
            <label className="block text-text-secondary" htmlFor="confirm-token">
              Type <span className="font-mono text-text-primary">confirm</span>{" "}
              to enable the reassign button
            </label>
            <input
              id="confirm-token"
              type="text"
              className="form-input w-full"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4 text-sm">
          {result.reassigned.length > 0 && (
            <p className="text-status-success">
              Reassigned {result.reassigned.length} item
              {result.reassigned.length === 1 ? "" : "s"} to {result.target.email}.
            </p>
          )}
          {result.blocked && result.blocked.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-status-warning">
                <AlertTriangle size={16} />
                <span className="font-medium">
                  {result.blocked.length} blocked — target missing permission
                </span>
              </div>
              <ul className="space-y-1 rounded-md border border-border-default bg-surface-2 p-3 text-xs font-mono">
                {result.blocked.map((b) => (
                  <li key={`${b.type}-${b.id}`}>
                    {b.type} #{b.id} — needs{" "}
                    <code>{b.required_permission ?? "—"}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.errors && result.errors.length > 0 && (
            <ul className="space-y-1 rounded-md border border-border-default bg-surface-2 p-3 text-xs font-mono text-status-critical">
              {result.errors.map((e) => (
                <li key={`${e.type}-${e.id}`}>
                  {e.type} #{e.id}: {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
