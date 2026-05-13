import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, X } from "lucide-react";
import { useCreateDraft } from "../../hooks/useDrafts";
import type { DocumentJson } from "../../types/publish";

const SESSION_KEY = "parthenon:publish-wizard";
const DISMISS_KEY = "parthenon:publish-wizard-migration-dismissed";

interface OrphanedState {
  title?: string;
  authors?: string[];
  template?: string;
  step?: number;
  selectedExecutions?: unknown[];
  sections?: unknown[];
}

function loadOrphan(): OrphanedState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrphanedState;
    const sectionCount = (parsed.sections ?? []).length;
    const execCount = (parsed.selectedExecutions ?? []).length;
    if (sectionCount === 0 && execCount === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function SessionStorageMigrationBanner() {
  const [orphan, setOrphan] = useState<OrphanedState | null>(() => {
    if (typeof window === "undefined") return null;
    if (sessionStorage.getItem(DISMISS_KEY)) return null;
    return loadOrphan();
  });
  const createDraft = useCreateDraft();
  const navigate = useNavigate();

  if (!orphan) return null;

  const handleSave = () => {
    const document_json: DocumentJson = {
      version: 1,
      title: orphan.title ?? "Recovered Draft",
      authors: orphan.authors ?? [],
      template: orphan.template ?? "generic-ohdsi",
      step: ([1, 2, 3, 4] as const).includes(orphan.step as 1 | 2 | 3 | 4) ? (orphan.step as 1 | 2 | 3 | 4) : 1,
      selectedExecutions: (orphan.selectedExecutions ?? []) as DocumentJson["selectedExecutions"],
      sections: (orphan.sections ?? []) as DocumentJson["sections"],
    };
    createDraft.mutate(
      { title: document_json.title, template: document_json.template, document_json },
      {
        onSuccess: (draft) => {
          sessionStorage.removeItem(SESSION_KEY);
          sessionStorage.setItem(DISMISS_KEY, "1");
          navigate(`/publish/library/${draft.id}`);
        },
      },
    );
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOrphan(null);
  };

  return (
    <div className="rounded-md border border-accent/40 bg-accent/5 px-4 py-3 flex items-center justify-between">
      <div className="text-sm text-text-primary">
        We found unsaved work from a previous session ({(orphan.sections ?? []).length} sections, {(orphan.selectedExecutions ?? []).length} analyses).
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={createDraft.isPending}
          className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1 text-xs font-medium text-surface-base hover:bg-accent/90 disabled:opacity-50"
        >
          <Save size={12} />Save to library
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-text-ghost hover:text-text-primary"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
