import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  Trash2,
  Loader2,
  FileText,
  Upload,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJobs, deleteJob, uploadFile } from "../api/ingestionApi";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { FileUploadZone } from "../components/FileUploadZone";
import type { ExecutionStatus, IngestionStep } from "@/types/ingestion";
import type { Source } from "@/types/models";

const STATUS_STYLES: Record<
  ExecutionStatus,
  { bg: string; text: string; dot?: string }
> = {
  pending: { bg: "#2A2A30", text: "#8A857D" },
  queued: { bg: "#2A2A30", text: "#8A857D" },
  running: { bg: "rgba(96,165,250,0.15)", text: "#60A5FA", dot: "#60A5FA" },
  completed: { bg: "rgba(45,212,191,0.15)", text: "#2DD4BF" },
  failed: { bg: "rgba(232,90,107,0.15)", text: "#E85A6B" },
  cancelled: { bg: "#2A2A30", text: "#5A5650" },
};

const STEP_LABELS: Record<IngestionStep, string> = {
  profiling: "Profiling",
  schema_mapping: "Schema Mapping",
  concept_mapping: "Concept Mapping",
  review: "Review",
  cdm_writing: "CDM Writing",
  validation: "Validation",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Upload section (merged from UploadPage)
// ---------------------------------------------------------------------------

function UploadSection() {
  const navigate = useNavigate();
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const queryClient = useQueryClient();

  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, sourceId }: { file: File; sourceId: number }) =>
      uploadFile(file, sourceId),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-jobs"] });
      navigate(`/ingestion/jobs/${job.id}`);
    },
  });

  const canUpload = selectedFile && selectedSource && !uploadMutation.isPending;

  const handleUpload = () => {
    if (!selectedFile || !selectedSource) return;
    uploadMutation.mutate({
      file: selectedFile,
      sourceId: selectedSource.id,
    });
  };

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-[#1C1C20] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#9B1B30]/15">
            <Upload size={16} className="text-[#9B1B30]" />
          </div>
          <div>
            <span className="text-sm font-medium text-[#F0EDE8]">Upload Source File</span>
            <p className="text-xs text-[#8A857D]">Select a data source and upload a CSV or Excel file</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-[#8A857D]" />
        ) : (
          <ChevronDown size={16} className="text-[#8A857D]" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-[#1C1C20]">
          <div className="flex gap-6 items-start">
            {/* Source selector */}
            <div className="w-64 shrink-0 space-y-2">
              <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
                Data Source
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  disabled={sourcesLoading}
                  className={cn(
                    "flex items-center justify-between w-full rounded-lg border bg-[#1C1C20] px-3 py-2 text-sm text-left transition-colors",
                    dropdownOpen ? "border-[#9B1B30]" : "border-[#2E2E35] hover:border-[#323238]",
                    sourcesLoading && "opacity-50",
                  )}
                >
                  <span className={selectedSource ? "text-[#F0EDE8]" : "text-[#5A5650]"}>
                    {sourcesLoading
                      ? "Loading..."
                      : selectedSource
                        ? selectedSource.source_name
                        : "Select source..."}
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn("text-[#8A857D] transition-transform", dropdownOpen && "rotate-180")}
                  />
                </button>

                {dropdownOpen && sources && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#232328] bg-[#1C1C20] shadow-lg overflow-hidden">
                    {sources.map((source) => (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => {
                          setSelectedSource(source);
                          setDropdownOpen(false);
                        }}
                        className={cn(
                          "flex flex-col w-full px-3 py-2 text-left text-sm hover:bg-[#232328] transition-colors",
                          selectedSource?.id === source.id && "bg-[#232328]",
                        )}
                      >
                        <span className="font-medium text-[#F0EDE8]">{source.source_name}</span>
                        <span className="text-[10px] text-[#8A857D] font-mono">{source.source_key}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* File upload zone */}
            <div className="flex-1 space-y-2">
              <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
                Source File
              </label>
              <FileUploadZone
                onFileSelect={setSelectedFile}
                selectedFile={selectedFile}
                onRemove={() => setSelectedFile(null)}
              />
            </div>
          </div>

          {/* Error */}
          {uploadMutation.isError && (
            <div className="mt-3 rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/10 px-4 py-2.5">
              <p className="text-sm text-[#E85A6B]">
                {uploadMutation.error instanceof Error
                  ? uploadMutation.error.message
                  : "Upload failed. Please try again."}
              </p>
            </div>
          )}

          {/* Upload button */}
          <div className="mt-4">
            <button
              type="button"
              onClick={handleUpload}
              disabled={!canUpload}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-colors",
                canUpload
                  ? "bg-[#9B1B30] text-[#F0EDE8] hover:bg-[#B82D42]"
                  : "bg-[#2A2A30] text-[#5A5650] cursor-not-allowed",
              )}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={15} />
                  Upload &amp; Profile
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Jobs table
// ---------------------------------------------------------------------------

function JobsTable() {
  const queryClient = useQueryClient();

  const {
    data: jobs,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["ingestion-jobs"],
    queryFn: () => fetchJobs(),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-jobs"] });
    },
  });

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this job?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={20} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-[#E85A6B] text-sm">Failed to load ingestion jobs</p>
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-12">
        <FileText size={24} className="text-[#8A857D] mb-3" />
        <p className="text-sm text-[#8A857D]">
          No ingestion jobs yet. Upload a file above to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[#8A857D] uppercase tracking-wider">
        Recent Jobs
      </h3>
      <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#1C1C20]">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                File
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Source
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Status
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Step
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Progress
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Created
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, i) => {
              const statusStyle = STATUS_STYLES[job.status];
              const fileName = job.profiles?.[0]?.file_name ?? `Job #${job.id}`;

              return (
                <tr
                  key={job.id}
                  className={cn(
                    "border-t border-[#1C1C20] transition-colors hover:bg-[#1C1C20]",
                    i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
                  )}
                >
                  <td className="px-4 py-3 text-sm font-medium text-[#F0EDE8]">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-[#8A857D] shrink-0" />
                      <span className="truncate max-w-[200px]">{fileName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#C5C0B8]">
                    {job.source?.source_name ?? "--"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
                        job.status === "running" && "animate-pulse",
                      )}
                      style={{
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.text,
                      }}
                    >
                      {statusStyle.dot && (
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: statusStyle.dot }}
                        />
                      )}
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#C5C0B8]">
                    {job.current_step ? STEP_LABELS[job.current_step] : "--"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[#232328] overflow-hidden max-w-[120px]">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${job.progress_percentage}%`,
                            backgroundColor:
                              job.status === "failed"
                                ? "#E85A6B"
                                : job.status === "completed"
                                  ? "#2DD4BF"
                                  : "#60A5FA",
                          }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-[#8A857D]">
                        {job.progress_percentage}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#8A857D]">
                    {formatDate(job.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={`/ingestion/jobs/${job.id}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors"
                        title="View details"
                      >
                        <Eye size={15} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(job.id)}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#8A857D] hover:text-[#E85A6B] hover:bg-[#232328] transition-colors disabled:opacity-50"
                        title="Delete job"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function IngestionDashboardPage() {
  return (
    <div className="space-y-6">
      <UploadSection />
      <JobsTable />
    </div>
  );
}
