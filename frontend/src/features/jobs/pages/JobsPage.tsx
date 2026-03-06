import { useState, useCallback } from "react";
import {
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  BarChart2,
  ShieldCheck,
  UsersRound,
  FlaskConical,
  Upload,
  BookOpen,
  GitFork,
  Wand2,
} from "lucide-react";
import { FilterChip, Badge, StatusDot, Progress, EmptyState, Drawer, CodeBlock } from "@/components/ui";
import { useJobs, useJob, useRetryJob, useCancelJob } from "../hooks/useJobs";
import type { Job, JobStatus, JobType } from "../api/jobsApi";
import { cn } from "@/lib/utils";
import { HelpButton } from "@/features/help";

const statusFilters: Array<{ label: string; value: JobStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Running", value: "running" },
  { label: "Failed", value: "failed" },
  { label: "Completed", value: "completed" },
  { label: "Queued", value: "queued" },
];

const typeIcons: Partial<Record<JobType, React.ElementType>> = {
  cohort_generation: UsersRound,
  achilles: BarChart2,
  dqd: ShieldCheck,
  characterization: FlaskConical,
  incidence_rate: FlaskConical,
  pathway: GitFork,
  estimation: FlaskConical,
  prediction: FlaskConical,
  ingestion: Upload,
  vocabulary_load: BookOpen,
};

const statusIcons: Record<JobStatus, React.ElementType> = {
  pending: Clock,
  queued: Clock,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: Ban,
};

function formatDuration(started: string | null, completed: string | null): string {
  if (!started) return "—";
  const start = new Date(started).getTime();
  const end = completed ? new Date(completed).getTime() : Date.now();
  const ms = end - start;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function JobsPage() {
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const { data, isLoading } = useJobs(
    statusFilter === "all" ? undefined : { status: statusFilter },
  );
  const { data: selectedJob } = useJob(selectedJobId);
  const retryMutation = useRetryJob();
  const cancelMutation = useCancelJob();

  const jobs = data?.data ?? [];

  const handleRetry = useCallback(
    (id: number) => retryMutation.mutate(id),
    [retryMutation],
  );

  const handleCancel = useCallback(
    (id: number) => cancelMutation.mutate(id),
    [cancelMutation],
  );

  return (
    <div>
      {/* Page header */}
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">Jobs</h1>
          <p className="page-subtitle">Monitor background jobs and queue status</p>
        </div>
        <HelpButton helpKey="jobs" />
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        {statusFilters.map((f) => (
          <FilterChip
            key={f.value}
            label={f.label}
            active={statusFilter === f.value}
            onToggle={() => setStatusFilter(f.value)}
          />
        ))}
      </div>

      {/* Jobs table */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: "var(--space-12)", textAlign: "center" }}>
            <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)", margin: "0 auto" }} />
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<Clock size={40} />}
            title="No jobs found"
            message={statusFilter !== "all" ? `No ${statusFilter} jobs. Try a different filter.` : "Background jobs will appear here when analyses run."}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Type</th>
                <th>Source</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Status</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const TypeIcon = typeIcons[job.type] ?? Wand2;
                const StatusIcon = statusIcons[job.status];
                return (
                  <tr
                    key={job.id}
                    className="clickable"
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {job.name}
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
                        <TypeIcon size={14} />
                        <span>{job.type.replace(/_/g, " ")}</span>
                      </span>
                    </td>
                    <td>{job.source_name ?? "—"}</td>
                    <td>{job.started_at ? formatRelativeTime(job.started_at) : "—"}</td>
                    <td className="mono">{formatDuration(job.started_at, job.completed_at)}</td>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        {job.status === "running" ? (
                          <>
                            <StatusDot status="running" />
                            <Progress value={job.progress} variant="info" className="flex-1" style={{ maxWidth: 80 }} />
                          </>
                        ) : (
                          <>
                            <StatusIcon
                              size={14}
                              className={cn(
                                job.status === "completed" && "text-success",
                                job.status === "failed" && "text-critical",
                              )}
                              style={{
                                color: job.status === "completed" ? "var(--success)" :
                                       job.status === "failed" ? "var(--critical)" :
                                       job.status === "running" ? "var(--info)" :
                                       "var(--text-muted)",
                                ...(job.status === "running" ? { animation: "spin 1s linear infinite" } : {}),
                              }}
                            />
                            <Badge
                              variant={
                                job.status === "completed" ? "success" :
                                job.status === "failed" ? "critical" :
                                job.status === "running" ? "info" :
                                "default"
                              }
                            >
                              {job.status}
                            </Badge>
                          </>
                        )}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "var(--space-1)" }} onClick={(e) => e.stopPropagation()}>
                        {job.status === "failed" && (
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => handleRetry(job.id)}
                            title="Retry"
                            aria-label="Retry job"
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}
                        {(job.status === "running" || job.status === "queued") && (
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => handleCancel(job.id)}
                            title="Cancel"
                            aria-label="Cancel job"
                          >
                            <Ban size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Job detail drawer */}
      <Drawer
        open={selectedJobId != null}
        onClose={() => setSelectedJobId(null)}
        title={selectedJob?.name ?? "Job Details"}
        size="lg"
      >
        {selectedJob && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {/* Status */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <StatusDot status={selectedJob.status as "running" | "success" | "fail"} />
              <Badge
                variant={
                  selectedJob.status === "completed" ? "success" :
                  selectedJob.status === "failed" ? "critical" :
                  selectedJob.status === "running" ? "info" :
                  "default"
                }
              >
                {selectedJob.status}
              </Badge>
              {selectedJob.status === "running" && (
                <Progress value={selectedJob.progress} variant="info" className="flex-1" />
              )}
            </div>

            {/* Metadata grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <div>
                <div className="text-label">Type</div>
                <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{selectedJob.type.replace(/_/g, " ")}</div>
              </div>
              <div>
                <div className="text-label">Source</div>
                <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{selectedJob.source_name ?? "—"}</div>
              </div>
              <div>
                <div className="text-label">Triggered By</div>
                <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{selectedJob.triggered_by ?? "—"}</div>
              </div>
              <div>
                <div className="text-label">Duration</div>
                <div className="text-mono" style={{ color: "var(--text-secondary)" }}>
                  {formatDuration(selectedJob.started_at, selectedJob.completed_at)}
                </div>
              </div>
            </div>

            {/* Error message */}
            {selectedJob.error_message && (
              <div className="alert-card alert-critical">
                <XCircle size={16} className="alert-icon" />
                <div className="alert-content">
                  <div className="alert-title">Error</div>
                  <div className="alert-message">{selectedJob.error_message}</div>
                </div>
              </div>
            )}

            {/* Log output */}
            {selectedJob.log_output && (
              <div>
                <div className="text-label" style={{ marginBottom: "var(--space-2)" }}>Log Output</div>
                <CodeBlock code={selectedJob.log_output} language="log" />
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--border-default)" }}>
              {selectedJob.status === "failed" && (
                <button className="btn btn-primary btn-sm" onClick={() => handleRetry(selectedJob.id)}>
                  <RefreshCw size={14} /> Retry
                </button>
              )}
              {(selectedJob.status === "running" || selectedJob.status === "queued") && (
                <button className="btn btn-danger btn-sm" onClick={() => handleCancel(selectedJob.id)}>
                  <Ban size={14} /> Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
