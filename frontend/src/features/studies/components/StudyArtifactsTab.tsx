import { Loader2, Plus, FileText, Trash2, File, FileCode, FileImage } from "lucide-react";
import {
  useStudyArtifacts,
  useCreateStudyArtifact,
  useDeleteStudyArtifact,
} from "../hooks/useStudies";

const TYPE_ICONS: Record<string, typeof File> = {
  protocol: FileText,
  sap: FileCode,
  report: FileText,
  figure: FileImage,
  data: File,
  presentation: File,
  other: File,
};

interface StudyArtifactsTabProps {
  slug: string;
}

export function StudyArtifactsTab({ slug }: StudyArtifactsTabProps) {
  const { data: artifacts, isLoading } = useStudyArtifacts(slug);
  const createMutation = useCreateStudyArtifact();
  const deleteMutation = useDeleteStudyArtifact();

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#8A857D]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#C5C0B8]">Artifacts ({artifacts?.length ?? 0})</h3>
        <button
          type="button"
          onClick={() => createMutation.mutate({
            slug,
            payload: {
              title: "New Document",
              artifact_type: "other",
              version: "1.0",
            },
          })}
          disabled={createMutation.isPending}
          className="btn btn-primary btn-sm"
        >
          {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add Artifact
        </button>
      </div>

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
                    <span className="capitalize">{a.artifact_type}</span>
                    <span>v{a.version}</span>
                    {a.file_size_bytes && <span>{(a.file_size_bytes / 1024).toFixed(0)} KB</span>}
                  </div>
                  {a.description && <p className="text-xs text-[#8A857D] mt-1 line-clamp-2">{a.description}</p>}
                  <p className="text-[10px] text-[#5A5650] mt-1">
                    {a.uploaded_by_user?.name ?? "Unknown"} · {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { if (window.confirm("Delete this artifact?")) deleteMutation.mutate({ slug, artifactId: a.id }); }}
                  className="p-1 text-[#5A5650] hover:text-[#E85A6B] shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
