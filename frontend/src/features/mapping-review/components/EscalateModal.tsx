import { useEffect, useRef, useState } from "react";

interface EscalateModalProps {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
}

export function EscalateModal({ open, busy = false, onClose, onSubmit }: EscalateModalProps) {
  const [note, setNote] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setNote("");
      const t = window.setTimeout(() => ref.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  const tooShort = note.trim().length < 3;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="escalate-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-[#0E0E11] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="escalate-title" className="mb-3 text-lg font-semibold text-zinc-100">
          Escalate to senior reviewer
        </h2>
        <p className="mb-4 text-sm text-zinc-400">
          Captures uncertainty without forcing a decision. Provide context for the
          senior reviewer (typically: ambiguous source text, multiple equally plausible
          candidates, suspected new vocabulary).
        </p>
        <label
          htmlFor="escalate-note"
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Note
        </label>
        <textarea
          id="escalate-note"
          ref={ref}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={2000}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#C9A227] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
          placeholder="Two LOINC candidates equally plausible; need clinical input…"
          disabled={busy}
        />
        <div className="mt-1 text-right font-mono text-xs text-zinc-500">
          {note.length}/2000
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
            onClick={() => onSubmit(note.trim())}
            disabled={tooShort || busy}
            className="rounded-lg bg-[#C9A227] px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-[#E0B632] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Escalating…" : "Escalate"}
          </button>
        </div>
      </div>
    </div>
  );
}
