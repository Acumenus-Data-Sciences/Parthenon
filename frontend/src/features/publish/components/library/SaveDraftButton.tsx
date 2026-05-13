import { Save } from "lucide-react";

interface SaveDraftButtonProps {
  hasDraftId: boolean;
  saving: boolean;
  onSave: () => void;
}

export function SaveDraftButton({ hasDraftId, saving, onSave }: SaveDraftButtonProps) {
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={saving}
      className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/15 disabled:opacity-50"
    >
      <Save size={12} />{saving ? "Saving…" : hasDraftId ? "Save Draft" : "Save as Draft"}
    </button>
  );
}
