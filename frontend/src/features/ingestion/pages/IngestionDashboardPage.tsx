import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Plus,
  Eye,
  Trash2,
  Loader2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJobs, deleteJob } from "../api/ingestionApi";
import type { ExecutionStatus, IngestionStep } from "@/types/ingestion";

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

export default function IngestionDashboardPage() {
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
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#E85A6B]">Failed to load ingestion jobs</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">Data Ingestion</h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Upload, profile, and map source data to the OMOP CDM
          </p>
        </div>
        <Link
          to="/ingestion/upload"
          className="inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-4 py-2.5 text-sm font-medium text-[#F0EDE8] hover:bg-[#B82D42] transition-colors"
        >
          <Plus size={16} />
          New Upload
        </Link>
      </div>

      {/* Jobs Table */}
      {jobs && jobs.length > 0 ? (
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
                const fileName =
                  job.profiles?.[0]?.file_name ?? `Job #${job.id}`;

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
                      {job.current_step
                        ? STEP_LABELS[job.current_step]
                        : "--"}
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
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#1C1C20] mb-4">
            <FileText size={24} className="text-[#8A857D]" />
          </div>
          <h3 className="text-lg font-semibold text-[#F0EDE8]">
            No ingestion jobs
          </h3>
          <p className="mt-2 text-sm text-[#8A857D]">
            Upload a source file to start your first ingestion pipeline.
          </p>
          <Link
            to="/ingestion/upload"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-4 py-2.5 text-sm font-medium text-[#F0EDE8] hover:bg-[#B82D42] transition-colors"
          >
            <Plus size={16} />
            New Upload
          </Link>
        </div>
      )}
    </div>
  );
}
