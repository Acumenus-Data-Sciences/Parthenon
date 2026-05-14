import type { PublicationDraftVisibility } from "../../types/publish";

interface ShareDropdownProps {
  visibility: PublicationDraftVisibility;
  studyLinked: boolean;
  studyName?: string;
  disabled?: boolean;
  onChange: (v: PublicationDraftVisibility) => void;
}

export function ShareDropdown({ visibility, studyLinked, studyName, disabled, onChange }: ShareDropdownProps) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-text-primary/70">
      <span className="sr-only">Visibility</span>
      <select
        aria-label="Visibility"
        value={visibility}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as PublicationDraftVisibility)}
        className="rounded-md border border-border-default bg-surface-raised px-2 py-1 text-xs text-text-primary disabled:opacity-50"
        title={!studyLinked ? "Link to a study to share" : undefined}
      >
        <option value="private">🔒 Private</option>
        <option value="study" disabled={!studyLinked}>
          👥 Study collaborators{studyName ? ` (${studyName})` : ""}
        </option>
      </select>
    </label>
  );
}
