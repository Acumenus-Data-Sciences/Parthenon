import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Play,
  Database,
  ChevronDown,
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
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-[#E85A6B]">Failed to load study</p>
          <button
            type="button"
            onClick={() => navigate("/studies")}
            className="mt-4 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/studies")}
            className="inline-flex items-center gap-1 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors mb-3"
          >
            <ArrowLeft size={14} />
            Studies
          </button>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">
            {study.name}
          </h1>
          {study.description && (
            <p className="mt-1 text-sm text-[#8A857D]">
              {study.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Execute All Controls */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Database
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
              />
              <select
                value={sourceId ?? ""}
                onChange={(e) =>
                  setSourceId(Number(e.target.value) || null)
                }
                disabled={loadingSources}
                className={cn(
                  "appearance-none rounded-lg border border-[#232328] bg-[#0E0E11] pl-8 pr-8 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                )}
              >
                <option value="">Source</option>
                {sources?.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.source_name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
              />
            </div>
            <button
              type="button"
              onClick={handleExecuteAll}
              disabled={
                !sourceId ||
                executeAllMutation.isPending ||
                isRunning
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A227] px-3 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#B89220] transition-colors disabled:opacity-50"
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#8A857D] hover:text-[#E85A6B] hover:border-[#E85A6B]/30 transition-colors disabled:opacity-50"
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
      <div className="flex items-center gap-1 border-b border-[#232328]">
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
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "text-[#2DD4BF]"
                : "text-[#8A857D] hover:text-[#C5C0B8]",
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2DD4BF]" />
            )}
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
