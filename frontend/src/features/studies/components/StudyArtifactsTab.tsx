import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, FileText, Trash2, File, FileCode, FileImage, Edit3, Save, X, Link } from "lucide-react";
import { formatDate, formatNumber } from "@/i18n/format";
import {
  useStudyArtifacts,
  useCreateStudyArtifact,
  useUpdateStudyArtifact,
  useDeleteStudyArtifact,
} from "../hooks/useStudies";
import type { StudyArtifact } from "../types/study";

const ARTIFACT_TYPES = [
  "protocol",
  "sap",
  "irb_submission",
  "cohort_json",
  "analysis_package_r",
  "analysis_package_python",
  "results_report",
  "manuscript_draft",
  "supplementary",
  "presentation",
  "data_dictionary",
  "study_package_zip",
  "other",
] as const;

const TYPE_ICONS: Record<string, typeof File> = {
  protocol: FileText,
  sap: FileCode,
  irb_submission: FileText,
  cohort_json: FileCode,
  analysis_package_r: FileCode,
  analysis_package_python: FileCode,
  results_report: FileText,
  manuscript_draft: FileText,
  supplementary: File,
  presentation: FileImage,
  data_dictionary: FileText,
  study_package_zip: File,
  other: File,
};

interface StudyArtifactsTabProps {
  slug: string;
}

export function StudyArtifactsTab({ slug }: StudyArtifactsTabProps) {
  const { t } = useTranslation("app");
  const { data: artifacts, isLoading } = useStudyArtifacts(slug);
  const createMutation = useCreateStudyArtifact();
  const updateMutation = useUpdateStudyArtifact();
  const deleteMutation = useDeleteStudyArtifact();

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<string>("protocol");
  const [newVersion, setNewVersion] = useState("1.0");
  const [newDescription, setNewDescription] = useState("");
  const [newUrl, setNewUrl] = useState("");

  // Edit state
  const [editId, setEditId] = useState<number | null>(null);
  const [editPayload, setEditPayload] = useState<Partial<StudyArtifact>>({});

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createMutation.mutate(
      {
        slug,
        payload: {
          title: newTitle.trim(),
          artifact_type: newType,
          version: newVersion || "1.0",
          description: newDescription || null,
          url: newUrl || null,
        },
      },
      {
        onSuccess: () => {
          setShowAdd(false);
          setNewTitle("");
          setNewType("protocol");
          setNewVersion("1.0");
          setNewDescription("");
          setNewUrl("");
        },
      },
    );
  };

  const startEdit = (a: StudyArtifact) => {
    setEditId(a.id);
    setEditPayload({
      title: a.title,
      artifact_type: a.artifact_type,
      version: a.version,
      description: a.description,
      url: a.url,
    });
  };

  const handleSave = () => {
    if (editId == null) return;
    updateMutation.mutate(
      { slug, artifactId: editId, payload: editPayload },
      { onSuccess: () => setEditId(null) },
    );
  };

  const artifactTypeLabel = (type: string) =>
    t(`studies.artifacts.types.${type}`, { defaultValue: type.replace(/_/g, " ") });

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-text-muted" /></div>;
  }

  const visibleArtifacts = artifacts?.filter((artifact) => artifact.artifact_type !== "shiny_app_url") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-secondary">
          {t("studies.artifacts.sections.artifacts", { count: visibleArtifacts.length })}
        </h3>
        <button type="button" onClick={() => setShowAdd(true)} disabled={showAdd} className="btn btn-primary btn-sm">
          <Plus size={14} /> {t("studies.artifacts.actions.addArtifact")}
        </button>
      </div>

      {/* Add artifact form */}
      {showAdd && (
        <div className="panel space-y-3">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            {t("studies.artifacts.form.addTitle")}
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] text-text-ghost uppercase tracking-wider mb-1 block">
                {t("studies.artifacts.form.titleRequired")}
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("studies.artifacts.form.titlePlaceholder")}
                className="form-input w-full"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] text-text-ghost uppercase tracking-wider mb-1 block">
                {t("studies.artifacts.form.version")}
              </label>
              <input
                type="text"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                placeholder="1.0"
                className="form-input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-text-ghost uppercase tracking-wider mb-1 block">
                {t("studies.artifacts.form.type")}
              </label>
              <select value={newType} onChange={(e) => setNewType(e.target.value)} className="form-input form-select w-full">
                {ARTIFACT_TYPES.map((t) => (
                  <option key={t} value={t}>{artifactTypeLabel(t)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-text-ghost uppercase tracking-wider mb-1 block">
                {t("studies.artifacts.form.urlOptional")}
              </label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://..."
                className="form-input w-full"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-text-ghost uppercase tracking-wider mb-1 block">
              {t("studies.artifacts.form.descriptionOptional")}
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={t("studies.artifacts.form.descriptionPlaceholder")}
              className="form-input w-full resize-none"
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost btn-sm">
              {t("studies.artifacts.actions.cancel")}
            </button>
            <button type="button" onClick={handleCreate} disabled={!newTitle.trim() || createMutation.isPending} className="btn btn-primary btn-sm">
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t("studies.artifacts.actions.create")}
            </button>
          </div>
        </div>
      )}

      {visibleArtifacts.length === 0 ? (
        <div className="empty-state">
          <FileText size={24} className="text-text-ghost mb-2" />
          <h3 className="empty-title">{t("studies.artifacts.empty.title")}</h3>
          <p className="empty-message">{t("studies.artifacts.empty.message")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleArtifacts.map((a) => {
            const Icon = TYPE_ICONS[a.artifact_type] ?? File;
            const isEditing = editId === a.id;

            if (isEditing) {
              return (
                <div key={a.id} className="rounded-lg border border-success/30 bg-surface-raised p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editPayload.title ?? ""}
                      onChange={(e) => setEditPayload({ ...editPayload, title: e.target.value })}
                      placeholder={t("studies.artifacts.form.title")}
                      className="form-input py-1 text-sm"
                    />
                    <div className="flex gap-2">
                      <select
                        value={editPayload.artifact_type ?? ""}
                        onChange={(e) => setEditPayload({ ...editPayload, artifact_type: e.target.value })}
                        className="form-input form-select py-1 text-xs flex-1"
                      >
                        {ARTIFACT_TYPES.map((t) => (
                          <option key={t} value={t}>{artifactTypeLabel(t)}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editPayload.version ?? ""}
                        onChange={(e) => setEditPayload({ ...editPayload, version: e.target.value })}
                        placeholder={t("studies.artifacts.form.version")}
                        className="form-input py-1 text-xs w-16"
                      />
                    </div>
                  </div>
                  <textarea
                    value={editPayload.description ?? ""}
                    onChange={(e) => setEditPayload({ ...editPayload, description: e.target.value })}
                    placeholder={t("studies.artifacts.form.description")}
                    className="form-input py-1 text-xs w-full resize-none"
                    rows={2}
                  />
                  <input
                    type="url"
                    value={editPayload.url ?? ""}
                    onChange={(e) => setEditPayload({ ...editPayload, url: e.target.value })}
                    placeholder={t("studies.artifacts.form.urlOptional")}
                    className="form-input py-1 text-xs w-full"
                  />
                  <div className="flex gap-1 justify-end">
                    <button type="button" onClick={handleSave} className="p-1 text-success" title={t("studies.artifacts.actions.save")}>
                      <Save size={14} />
                    </button>
                    <button type="button" onClick={() => setEditId(null)} className="p-1 text-text-ghost hover:text-text-secondary" title={t("studies.artifacts.actions.cancel")}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={a.id} className="flex items-start gap-3 rounded-lg border border-border-default bg-surface-raised p-4">
                <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-text-primary font-medium truncate">{a.title}</p>
                    {a.is_current && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-success/10 text-success">
                        {t("studies.artifacts.badges.current")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-ghost">
                    <span>{artifactTypeLabel(a.artifact_type)}</span>
                    <span>{t("studies.artifacts.labels.versionValue", { version: a.version })}</span>
                    {a.file_size_bytes && (
                      <span>
                        {t("studies.artifacts.labels.sizeKb", {
                          size: formatNumber(a.file_size_bytes / 1024, { maximumFractionDigits: 0 }),
                        })}
                      </span>
                    )}
                  </div>
                  {a.description && <p className="text-xs text-text-muted mt-1 line-clamp-2">{a.description}</p>}
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-success hover:underline mt-1 inline-flex items-center gap-1">
                      <Link size={10} /> {t("studies.artifacts.actions.openLink")}
                    </a>
                  )}
                  <p className="text-[10px] text-text-ghost mt-1">
                    {t("studies.artifacts.messages.uploadedBy", {
                      name: a.uploaded_by_user?.name ?? t("studies.artifacts.messages.unknown"),
                      date: formatDate(a.created_at),
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => startEdit(a)} className="p-1 text-text-ghost hover:text-text-secondary" title={t("studies.artifacts.actions.edit")}>
                    <Edit3 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (window.confirm(t("studies.artifacts.confirmDelete"))) deleteMutation.mutate({ slug, artifactId: a.id }); }}
                    className="p-1 text-text-ghost hover:text-critical shrink-0"
                    title={t("studies.artifacts.actions.delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
