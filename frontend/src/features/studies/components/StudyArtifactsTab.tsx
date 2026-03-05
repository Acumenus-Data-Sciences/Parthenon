import { useState } from "react";
import { Loader2, Plus, FileText, Trash2, File, FileCode, FileImage, Edit3, Save, X, Link } from "lucide-react";
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
  "shiny_app_url",
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
  shiny_app_url: Link,
  other: File,
};

interface StudyArtifactsTabProps {
  slug: string;
}

export function StudyArtifactsTab({ slug }: StudyArtifactsTabProps) {
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

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#8A857D]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#C5C0B8]">Artifacts ({artifacts?.length ?? 0})</h3>
        <button type="button" onClick={() => setShowAdd(true)} disabled={showAdd} className="btn btn-primary btn-sm">
          <Plus size={14} /> Add Artifact
        </button>
      </div>

      {/* Add artifact form */}
      {showAdd && (
        <div className="panel space-y-3">
          <p className="text-xs font-medium text-[#C5C0B8] uppercase tracking-wider">Add Study Artifact</p>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1 block">Title *</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Study Protocol v2.1"
                className="form-input w-full"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1 block">Version</label>
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
              <label className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1 block">Type</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value)} className="form-input form-select w-full">
                {ARTIFACT_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1 block">URL (optional)</label>
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
            <label className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1 block">Description (optional)</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Brief description of this artifact..."
              className="form-input w-full resize-none"
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost btn-sm">Cancel</button>
            <button type="button" onClick={handleCreate} disabled={!newTitle.trim() || createMutation.isPending} className="btn btn-primary btn-sm">
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Create
            </button>
          </div>
        </div>
      )}

      {(!artifacts || artifacts.length === 0) ? (
        <div className="empty-state">
          <FileText size={24} className="text-[#323238] mb-2" />
          <h3 className="empty-title">No artifacts</h3>
          <p className="empty-message">Store protocols, analysis packages, and study documents</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {artifacts.map((a) => {
            const Icon = TYPE_ICONS[a.artifact_type] ?? File;
            const isEditing = editId === a.id;

            if (isEditing) {
              return (
                <div key={a.id} className="rounded-lg border border-[#2DD4BF]/30 bg-[#151518] p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editPayload.title ?? ""}
                      onChange={(e) => setEditPayload({ ...editPayload, title: e.target.value })}
                      placeholder="Title"
                      className="form-input py-1 text-sm"
                    />
                    <div className="flex gap-2">
                      <select
                        value={editPayload.artifact_type ?? ""}
                        onChange={(e) => setEditPayload({ ...editPayload, artifact_type: e.target.value })}
                        className="form-input form-select py-1 text-xs flex-1"
                      >
                        {ARTIFACT_TYPES.map((t) => (
                          <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editPayload.version ?? ""}
                        onChange={(e) => setEditPayload({ ...editPayload, version: e.target.value })}
                        placeholder="Version"
                        className="form-input py-1 text-xs w-16"
                      />
                    </div>
                  </div>
                  <textarea
                    value={editPayload.description ?? ""}
                    onChange={(e) => setEditPayload({ ...editPayload, description: e.target.value })}
                    placeholder="Description"
                    className="form-input py-1 text-xs w-full resize-none"
                    rows={2}
                  />
                  <input
                    type="url"
                    value={editPayload.url ?? ""}
                    onChange={(e) => setEditPayload({ ...editPayload, url: e.target.value })}
                    placeholder="URL (optional)"
                    className="form-input py-1 text-xs w-full"
                  />
                  <div className="flex gap-1 justify-end">
                    <button type="button" onClick={handleSave} className="p-1 text-[#2DD4BF]"><Save size={14} /></button>
                    <button type="button" onClick={() => setEditId(null)} className="p-1 text-[#5A5650] hover:text-[#C5C0B8]"><X size={14} /></button>
                  </div>
                </div>
              );
            }

            return (
              <div key={a.id} className="flex items-start gap-3 rounded-lg border border-[#232328] bg-[#151518] p-4">
                <div className="w-9 h-9 rounded-lg bg-[#2DD4BF]/10 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-[#2DD4BF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-[#F0EDE8] font-medium truncate">{a.title}</p>
                    {a.is_current && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#34D399]/10 text-[#34D399]">CURRENT</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#5A5650]">
                    <span className="capitalize">{a.artifact_type.replace(/_/g, " ")}</span>
                    <span>v{a.version}</span>
                    {a.file_size_bytes && <span>{(a.file_size_bytes / 1024).toFixed(0)} KB</span>}
                  </div>
                  {a.description && <p className="text-xs text-[#8A857D] mt-1 line-clamp-2">{a.description}</p>}
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2DD4BF] hover:underline mt-1 inline-flex items-center gap-1">
                      <Link size={10} /> Open link
                    </a>
                  )}
                  <p className="text-[10px] text-[#5A5650] mt-1">
                    {a.uploaded_by_user?.name ?? "Unknown"} · {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => startEdit(a)} className="p-1 text-[#5A5650] hover:text-[#C5C0B8]">
                    <Edit3 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (window.confirm("Delete this artifact?")) deleteMutation.mutate({ slug, artifactId: a.id }); }}
                    className="p-1 text-[#5A5650] hover:text-[#E85A6B] shrink-0"
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
