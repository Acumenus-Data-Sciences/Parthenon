import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SourceRelease, UpdateReleasePayload } from "../../../types/ares";

interface ReleaseEditFormProps {
  release: Pick<SourceRelease, 'release_name' | 'cdm_version' | 'vocabulary_version' | 'etl_version' | 'notes'>;
  onSave: (payload: UpdateReleasePayload) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function ReleaseEditForm({ release, onSave, onCancel, isSaving }: ReleaseEditFormProps) {
  const { t } = useTranslation("app");
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
    "w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none";

  return (
    <div className="mt-3 space-y-3 border-t border-border-subtle pt-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] uppercase text-text-muted">
            {t("dataExplorer.ares.releases.form.releaseName")}
          </label>
          <input
            type="text"
            value={form.release_name ?? ""}
            onChange={(e) => setForm({ ...form, release_name: e.target.value })}
            className={inputClass}
            placeholder={t("dataExplorer.ares.releases.form.releaseName")}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase text-text-muted">
            {t("dataExplorer.ares.releases.form.cdmVersion")}
          </label>
          <input
            type="text"
            value={form.cdm_version ?? ""}
            onChange={(e) => setForm({ ...form, cdm_version: e.target.value })}
            className={inputClass}
            placeholder={t("dataExplorer.ares.releases.form.cdmVersionPlaceholder")}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase text-text-muted">
            {t("dataExplorer.ares.releases.form.vocabularyVersion")}
          </label>
          <input
            type="text"
            value={form.vocabulary_version ?? ""}
            onChange={(e) => setForm({ ...form, vocabulary_version: e.target.value })}
            className={inputClass}
            placeholder={t("dataExplorer.ares.releases.form.vocabularyVersionPlaceholder")}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase text-text-muted">
            {t("dataExplorer.ares.releases.form.etlVersion")}
          </label>
          <input
            type="text"
            value={form.etl_version ?? ""}
            onChange={(e) => setForm({ ...form, etl_version: e.target.value })}
            className={inputClass}
            placeholder={t("dataExplorer.ares.releases.form.etlVersionPlaceholder")}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase text-text-muted">
          {t("dataExplorer.ares.releases.form.notes")}
        </label>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          className={inputClass + " resize-none"}
          placeholder={t("dataExplorer.ares.releases.form.notesPlaceholder")}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface-base hover:bg-accent-light disabled:opacity-50 transition-colors"
        >
          {isSaving
            ? t("dataExplorer.ares.releases.actions.saving")
            : t("dataExplorer.ares.releases.actions.save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          {t("dataExplorer.ares.releases.actions.cancel")}
        </button>
      </div>
    </div>
  );
}
