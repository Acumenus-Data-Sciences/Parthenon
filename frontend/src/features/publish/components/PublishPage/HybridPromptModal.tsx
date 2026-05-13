import { useState } from "react";
import { X } from "lucide-react";

interface HybridPromptModalProps {
  open: boolean;
  defaultTitle: string;
  onSave: (title: string) => Promise<void>;
  onContinueWithoutSaving: () => void;
}

export function HybridPromptModal({ open, defaultTitle, onSave, onContinueWithoutSaving }: HybridPromptModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSave(title.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border-default bg-surface-raised p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Save as draft?</h2>
            <p className="mt-1 text-sm text-text-primary/60">
              Saving lets you return to this manuscript later. You can also continue without saving — work persists for this session only.
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onContinueWithoutSaving} className="text-text-ghost hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <label className="mt-4 block text-xs font-medium text-text-primary/70">
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled manuscript"
            className="mt-1 w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </label>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onContinueWithoutSaving}
            className="rounded-md px-3 py-1.5 text-sm text-text-primary/70 hover:text-text-primary"
          >
            Continue without saving
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || submitting}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-surface-base hover:bg-accent/90 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save as draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
