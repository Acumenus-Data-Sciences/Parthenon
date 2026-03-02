import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Play,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { StudyDesigner } from "../components/StudyDesigner";
import { StudyDashboard } from "../components/StudyDashboard";
import {
  useStudy,
  useDeleteStudy,
  useStudyAnalyses,
  useStudyProgress,
  useExecuteAllStudyAnalyses,
} from "../hooks/useStudies";

type Tab = "design" | "progress";

export default function StudyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const studyId = id ? Number(id) : null;

  const {
    data: study,
    isLoading,
    error,
  } = useStudy(studyId);
  const deleteMutation = useDeleteStudy();
  const executeAllMutation = useExecuteAllStudyAnalyses();

  const { data: analyses } = useStudyAnalyses(studyId);
  const { data: progress } = useStudyProgress(studyId);

  const [activeTab, setActiveTab] = useState<Tab>("design");
  const [sourceId, setSourceId] = useState<number | null>(null);

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const handleDelete = () => {
    if (!studyId) return;
    if (
      window.confirm("Are you sure you want to delete this study?")
    ) {
      deleteMutation.mutate(studyId, {
        onSuccess: () => navigate("/studies"),
      });
    }
  };

  const handleExecuteAll = () => {
    if (!studyId || !sourceId) return;
    executeAllMutation.mutate(
      { studyId, sourceId },
      {
        onSuccess: () => {
          setActiveTab("progress");
        },
      },
    );
  };

  const isRunning =
    progress?.overall_status === "running" ||
    progress?.overall_status === "pending";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p style={{ color: "var(--critical)" }}>Failed to load study</p>
          <button
            type="button"
            onClick={() => navigate("/studies")}
            className="btn btn-ghost btn-sm mt-4"
          >
            Back to studies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/studies")}
            className="btn btn-ghost btn-sm mb-3"
          >
            <ArrowLeft size={14} />
            Studies
          </button>
          <h1 className="page-title">
            {study.name}
          </h1>
          {study.description && (
            <p className="page-subtitle">
              {study.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Database
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-ghost)" }}
              />
              <select
                value={sourceId ?? ""}
                onChange={(e) =>
                  setSourceId(Number(e.target.value) || null)
                }
                disabled={loadingSources}
                className="form-input form-select"
                style={{ paddingLeft: "2rem" }}
              >
                <option value="">Source</option>
                {sources?.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.source_name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleExecuteAll}
              disabled={
                !sourceId ||
                executeAllMutation.isPending ||
                isRunning
              }
              className="btn btn-primary btn-sm"
            >
              {executeAllMutation.isPending || isRunning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              Execute All
            </button>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="btn btn-danger btn-sm"
          >
            {deleteMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Delete
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="tab-bar">
        {(
          [
            { key: "design" as const, label: "Design" },
            { key: "progress" as const, label: "Progress" },
          ]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn("tab-item", activeTab === tab.key && "active")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "design" ? (
        <StudyDesigner study={study} />
      ) : (
        <StudyDashboard
          analyses={analyses}
          progress={progress}
        />
      )}
    </div>
  );
}
