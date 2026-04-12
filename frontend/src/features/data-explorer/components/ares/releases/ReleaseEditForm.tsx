import { useState } from "react";
import type { SourceRelease, UpdateReleasePayload } from "../../../types/ares";

interface ReleaseEditFormProps {
  release: Pick<SourceRelease, 'release_name' | 'cdm_version' | 'vocabulary_version' | 'etl_version' | 'notes'>;
  onSave: (payload: UpdateReleasePayload) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function ReleaseEditForm({ release, onSave, onCancel, isSaving }: ReleaseEditFormProps) {
  const [form, setForm] = useState<UpdateReleasePayload>({
    release_name: release.release_name,
    cdm_version: release.cdm_version ?? "",
    vocabulary_version: release.vocabulary_version ?? "",
    etl_version: release.etl_version ?? "",
    notes: release.notes ?? "",
  });

  const handleSubmit = () => {
    // Only send fields that have actual values; empty strings become undefined
    const payload: UpdateReleasePayload = {
      release_name: form.release_name?.trim() || undefined,
      cdm_version: form.cdm_version?.trim() || undefined,
      vocabulary_version: form.vocabulary_version?.trim() || undefined,
      etl_version: form.etl_version?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    };
    onSave(payload);
  };

  const inputClass =
    "w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent focus:outline-none";

  return (
    <div className="mt-3 space-y-3 border-t border-border-subtle pt-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] uppercase text-text-muted">Release Name</label>
          <input
            type="text"
            value={form.release_name ?? ""}
            onChange={(e) => setForm({ ...form, release_name: e.target.value })}
            className={inputClass}
            placeholder="Release name"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase text-text-muted">CDM Version</label>
          <input
            type="text"
            value={form.cdm_version ?? ""}
            onChange={(e) => setForm({ ...form, cdm_version: e.target.value })}
            className={inputClass}
            placeholder="e.g. 5.4"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase text-text-muted">Vocabulary Version</label>
          <input
            type="text"
            value={form.vocabulary_version ?? ""}
            onChange={(e) => setForm({ ...form, vocabulary_version: e.target.value })}
            className={inputClass}
            placeholder="e.g. v5.0 20-JAN-2025"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase text-text-muted">ETL Version</label>
          <input
            type="text"
            value={form.etl_version ?? ""}
            onChange={(e) => setForm({ ...form, etl_version: e.target.value })}
            className={inputClass}
            placeholder="e.g. 2.1.0"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase text-text-muted">Notes</label>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          className={inputClass + " resize-none"}
          placeholder="Release notes..."
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface-base hover:bg-[#e0b82e] disabled:opacity-50 transition-colors"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
