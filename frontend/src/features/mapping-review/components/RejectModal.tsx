import { useEffect, useRef, useState } from "react";

interface RejectModalProps {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export function RejectModal({ open, busy = false, onClose, onSubmit }: RejectModalProps) {
  const [reason, setReason] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      // Defer focus until after the dialog mounts.
      const t = window.setTimeout(() => ref.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  const tooShort = reason.trim().length < 3;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-[#0E0E11] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="reject-title" className="mb-3 text-lg font-semibold text-zinc-100">
          Reject mapping
        </h2>
        <p className="mb-4 text-sm text-zinc-400">
          Captures intent for the audit trail. The queue row stays in place and can be re-opened later.
        </p>
        <label
          htmlFor="reject-reason"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Rejection reason
        </label>
        <textarea
          id="reject-reason"
          ref={ref}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={2000}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#9B1B30] focus:outline-none focus:ring-2 focus:ring-[#9B1B30]/40"
          placeholder="None of the candidates clinically match the source code…"
          disabled={busy}
        />
        <div className="mt-1 text-right font-mono text-xs text-zinc-500">
          {reason.length}/2000
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(reason.trim())}
            disabled={tooShort || busy}
            className="rounded-lg bg-[#9B1B30] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#B71F38] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}
