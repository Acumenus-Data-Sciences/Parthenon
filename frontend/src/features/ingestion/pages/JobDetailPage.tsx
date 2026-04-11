import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  RotateCcw,
  FileText,
  Clock,
} from "lucide-react";
import { fetchJob, fetchProfile, retryJob } from "../api/ingestionApi";
import { PipelineStepper } from "../components/PipelineStepper";
import { ScanReport } from "../components/ScanReport";
import type { IngestionStep } from "@/types/ingestion";

const STEP_LABELS: Record<IngestionStep, string> = {
  profiling: "Profiling",
  schema_mapping: "Schema Mapping",
  concept_mapping: "Concept Mapping",
  review: "Review",
  cdm_writing: "CDM Writing",
  validation: "Validation",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const queryClient = useQueryClient();
  const id = Number(jobId);

  const {
    data: job,
    isLoading: jobLoading,
    error: jobError,
  } = useQuery({
    queryKey: ["ingestion-job", id],
    queryFn: () => fetchJob(id),
    enabled: !isNaN(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" || status === "queued" ? 2000 : false;
    },
  });

  const profilingDone =
    job &&
    (job.status === "completed" ||
      (job.current_step !== "profiling" && job.current_step !== null));

  const {
    data: profile,
    isLoading: profileLoading,
  } = useQuery({
    queryKey: ["ingestion-profile", id],
    queryFn: () => fetchProfile(id),
    enabled: !!profilingDone,
  });

  const retryMutation = useMutation({
    mutationFn: () => retryJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-job", id] });
    },
  });

  if (jobLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (jobError || !job) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle size={32} className="text-critical" />
        <p className="text-critical">Failed to load job details</p>
        <Link
          to="/ingestion"
          className="text-sm text-text-muted hover:text-text-primary underline"
        >
          Back to jobs
        </Link>
      </div>
    );
  }

  const fileName = job.profiles?.[0]?.file_name ?? `Job #${job.id}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/ingestion"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-accent" />
              <h1 className="text-xl font-bold text-text-primary">{fileName}</h1>
            </div>
            <div className="flex items-center gap-4 mt-1">
              {job.source && (
                <span className="text-sm text-text-muted">
                  Source:{" "}
                  <span className="text-text-secondary">
                    {job.source.source_name}
                  </span>
                </span>
              )}
              <span className="flex items-center gap-1 text-sm text-text-muted">
                <Clock size={12} />
                {formatDateTime(job.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Stepper */}
      <div className="rounded-lg border border-border-default bg-surface-raised" style={{ background: "rgba(255,255,255,0.03)" }}>
        <PipelineStepper currentStep={job.current_step} status={job.status} />
      </div>

      {/* Error Banner */}
      {job.status === "failed" && (
        <div className="flex items-center justify-between rounded-lg border border-critical/30 bg-critical/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-critical shrink-0" />
            <div>
              <p className="text-sm font-medium text-critical">
                Pipeline failed
              </p>
              {job.error_message && (
                <p className="mt-1 text-sm text-critical/80">
                  {job.error_message}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => retryMutation.mutate()}
            disabled={retryMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-primary hover:bg-primary-light transition-colors disabled:opacity-50"
          >
            {retryMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RotateCcw size={14} />
            )}
            Retry
          </button>
        </div>
      )}

      {/* Step Content */}
      <div className="space-y-4">
        {renderStepContent()}
      </div>
    </div>
  );

  function renderStepContent() {
    if (!job) return null;
    // If profiling is currently running
    if (job.current_step === "profiling" && job.status === "running") {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border-default bg-surface-raised py-16">
          <Loader2 size={32} className="animate-spin text-primary mb-4" />
          <p className="text-sm font-medium text-text-primary">
            Profiling in progress...
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Analyzing file structure and field characteristics
          </p>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-1.5 w-32 rounded-full bg-surface-elevated overflow-hidden">
              <div
                className="h-full rounded-full bg-primary animate-pulse transition-all duration-300"
                style={{ width: `${job.progress_percentage}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-text-muted">
              {job.progress_percentage}%
            </span>
          </div>
        </div>
      );
    }

    // If profiling is done, show scan report
    if (profilingDone) {
      const fields = profile?.fields ?? job.profiles?.[0]?.fields;

      if (profileLoading) {
        return (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        );
      }

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">
              Field Profiles
            </h2>
            {profile && (
              <div className="flex items-center gap-4 text-xs text-text-muted">
                {profile.row_count !== null && (
                  <span>
                    Rows:{" "}
                    <span className="text-text-secondary tabular-nums">
                      {profile.row_count.toLocaleString()}
                    </span>
                  </span>
                )}
                {profile.column_count !== null && (
                  <span>
                    Columns:{" "}
                    <span className="text-text-secondary tabular-nums">
                      {profile.column_count}
                    </span>
                  </span>
                )}
                <span>
                  Format:{" "}
                  <span className="text-text-secondary uppercase">
                    {profile.file_format}
                  </span>
                </span>
              </div>
            )}
          </div>

          {fields && fields.length > 0 ? (
            <ScanReport fields={fields} />
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-border-default bg-surface-raised py-12 text-sm text-text-muted">
              No field data available
            </div>
          )}

          {/* Placeholder for later steps */}
          {job.current_step &&
            job.current_step !== "profiling" &&
            job.status !== "completed" && (
              <StepPlaceholder step={job.current_step} />
            )}
        </div>
      );
    }

    // Pending / queued state
    if (job.status === "pending" || job.status === "queued") {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border-default bg-surface-raised py-16">
          <Clock size={32} className="text-text-muted mb-4" />
          <p className="text-sm font-medium text-text-primary">
            Waiting to start...
          </p>
          <p className="mt-1 text-xs text-text-muted">
            This job is queued and will begin shortly
          </p>
        </div>
      );
    }

    return null;
  }
}

function StepPlaceholder({ step }: { step: IngestionStep }) {
  const label = STEP_LABELS[step];

  return (
    <div
      className="rounded-lg border border-dashed border-surface-highlight bg-surface-raised px-6 py-10 text-center"
      style={{ background: "rgba(255,255,255,0.03)" }}
    >
      <p className="text-sm font-medium text-text-muted">
        {label} will be available in a future update
      </p>
    </div>
  );
}
