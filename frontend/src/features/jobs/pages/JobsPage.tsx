import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  Globe,
  MapPin,
  Dna,
  AlertTriangle,
  HeartPulse,
  Database,
  Layers,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { FilterChip, Badge, Progress, EmptyState } from "@/components/ui";
import { useJobs, useRetryJob, useCancelJob } from "../hooks/useJobs";
import type { JobStatus, JobType, JobScope } from "../api/jobsApi";
import { JobDetailDrawer } from "../components/JobDetailDrawer";
import { cn } from "@/lib/utils";
import { HelpButton } from "@/features/help";

const statusFilters: Array<{ labelKey: string; value: JobStatus | "all" | "archived" }> = [
  { labelKey: "all", value: "all" },
  { labelKey: "running", value: "running" },
  { labelKey: "failed", value: "failed" },
  { labelKey: "completed", value: "completed" },
  { labelKey: "queued", value: "queued" },
  { labelKey: "archived", value: "archived" },
];

const typeIcons: Partial<Record<JobType, LucideIcon>> = {
  cohort_generation: UsersRound,
  achilles: BarChart2,
  dqd: ShieldCheck,
  characterization: FlaskConical,
  incidence_rate: FlaskConical,
  pathway: GitFork,
  estimation: FlaskConical,
  prediction: FlaskConical,
  sccs: FlaskConical,
  evidence_synthesis: BarChart2,
  ingestion: Upload,
  vocabulary_load: BookOpen,
  fhir_export: Globe,
  fhir_sync: Globe,
  gis_import: MapPin,
  gis_boundary: Layers,
  genomic_parse: Dna,
  heel: AlertTriangle,
  care_gap: HeartPulse,
  poseidon: Database,
  analysis: Wand2,
};

const statusIcons: Record<JobStatus, LucideIcon> = {
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
  if (ms < 0) return "—";
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

/** Live elapsed timer that ticks every second for running jobs */
function LiveTimer({ startedAt }: { startedAt: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{formatDuration(startedAt, null)}</>;
}

function formatRelativeTime(dateStr: string, language: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const formatter = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  if (mins < 1) return formatter.format(0, "minute");
  if (mins < 60) return formatter.format(-mins, "minute");
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return formatter.format(-hrs, "hour");
  return formatter.format(-Math.floor(hrs / 24), "day");
}

const jobTypeLabelKeys: Partial<Record<JobType | "all", string>> = {
  all: "all",
  characterization: "characterization",
  incidence_rate: "incidenceRate",
  estimation: "estimation",
  prediction: "prediction",
  pathway: "pathway",
  sccs: "sccs",
  evidence_synthesis: "evidenceSynthesis",
  cohort_generation: "cohortGeneration",
  care_gap: "careGaps",
  achilles: "achilles",
  dqd: "dataQuality",
  heel: "heelChecks",
  ingestion: "ingestion",
  vocabulary_load: "vocabulary",
  genomic_parse: "genomicParse",
  poseidon: "poseidon",
  fhir_export: "fhirExport",
  fhir_sync: "fhirSync",
  gis_import: "gisImport",
  gis_boundary: "gisBoundaries",
  analysis: "analysis",
};

const typeFilters: Array<{ value: JobType | "all" }> = [
  { value: "all" },
  // ─── Research & Analysis ───
  { value: "characterization" },
  { value: "incidence_rate" },
  { value: "estimation" },
  { value: "prediction" },
  { value: "pathway" },
  { value: "sccs" },
  { value: "evidence_synthesis" },
  { value: "cohort_generation" },
  { value: "care_gap" },
  // Data Quality
  { value: "achilles" },
  { value: "dqd" },
  { value: "heel" },
  // ─── Data Pipeline ───
  { value: "ingestion" },
  { value: "vocabulary_load" },
  { value: "genomic_parse" },
  { value: "poseidon" },
  // ─── Integrations ───
  { value: "fhir_export" },
  { value: "fhir_sync" },
  // ─── GIS ───
  { value: "gis_import" },
  { value: "gis_boundary" },
];

export default function JobsPage() {
  const { i18n, t } = useTranslation("app");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all" | "archived">("all");
  const [typeFilter, setTypeFilter] = useState<JobType | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<{ id: number; type: JobType } | null>(null);

  // Map the combined status/scope filter to API params
  const isArchived = statusFilter === "archived";
  const scope: JobScope = isArchived ? "archived" : "recent";
  const statusParam = isArchived ? undefined : (statusFilter !== "all" ? statusFilter as JobStatus : undefined);

  const { data, isLoading } = useJobs({
    scope,
    page,
    ...(statusParam ? { status: statusParam } : {}),
    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
  });
  const retryMutation = useRetryJob();
  const cancelMutation = useCancelJob();

  const jobs = data?.data ?? [];
  const meta = data?.meta;

  const handleRetry = useCallback(
    (job: { id: number; type: JobType }) => retryMutation.mutate(job),
    [retryMutation],
  );

  const handleCancel = useCallback(
    (job: { id: number; type: JobType }) => cancelMutation.mutate(job),
    [cancelMutation],
  );

  const jobTypeLabel = (type: JobType | "all" | string | null | undefined) => {
    if (!type) return t("jobs.filters.types.analysis");
    const labelKey = jobTypeLabelKeys[type as JobType | "all"];
    return labelKey
      ? t(`jobs.filters.types.${labelKey}`)
      : String(type).replace(/_/g, " ");
  };

  const statusLabel = (status: JobStatus | "all" | "archived" | string) =>
    t(`jobs.filters.statuses.${status}`, {
      defaultValue: String(status).replace(/_/g, " "),
    });

  const changeStatusFilter = (value: JobStatus | "all" | "archived") => {
    setStatusFilter(value);
    setPage(1);
  };

  const changeTypeFilter = (value: JobType | "all") => {
    setTypeFilter(value);
    setPage(1);
  };

  return (
    <div>
      {/* Page header */}
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">{t("jobs.page.title")}</h1>
          <p className="page-subtitle">{t("jobs.page.subtitle")}</p>
        </div>
        <HelpButton helpKey="jobs" />
      </div>

      {/* Status filter chips */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
        {statusFilters.map((f) => (
          <FilterChip
            key={f.value}
            label={t(`jobs.filters.statuses.${f.labelKey}`)}
            active={statusFilter === f.value}
            onToggle={() => changeStatusFilter(f.value)}
          />
        ))}
      </div>

      {/* Type filter chips */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        {typeFilters.map((f) => (
          <FilterChip
            key={f.value}
            label={jobTypeLabel(f.value)}
            active={typeFilter === f.value}
            onToggle={() => changeTypeFilter(f.value)}
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
            title={t("jobs.page.empty.title")}
            message={
              isArchived ? t("jobs.page.empty.archived") :
              statusFilter !== "all" ? t("jobs.page.empty.filtered", {
                status: statusLabel(statusFilter).toLocaleLowerCase(),
              }) :
              t("jobs.page.empty.recent")
            }
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("jobs.page.table.job")}</th>
                <th>{t("jobs.page.table.type")}</th>
                <th>{t("jobs.page.table.source")}</th>
                <th>{t("jobs.page.table.started")}</th>
                <th>{t("jobs.page.table.duration")}</th>
                <th>{t("jobs.page.table.status")}</th>
                <th style={{ width: 100 }}>{t("jobs.page.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const TypeIcon = typeIcons[job.type] ?? Wand2;
                const StatusIcon = statusIcons[job.status] ?? Clock;
                return (
                  <tr
                    key={job.id}
                    className="clickable"
                    onClick={() => setSelectedJob({ id: job.id, type: job.type })}
                  >
                    <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {job.name}
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
                        <TypeIcon size={14} />
                        <span>{jobTypeLabel(job.type)}</span>
                      </span>
                    </td>
                    <td>{job.source_name ?? "—"}</td>
                    <td>{job.started_at ? formatRelativeTime(job.started_at, i18n.language) : "—"}</td>
                    <td className="mono">
                      {job.status === "running" && job.started_at ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ color: "var(--info)" }}>
                            <LiveTimer startedAt={job.started_at} />
                          </span>
                          {job.progress > 0 && job.progress < 100 && (
                            <Progress value={job.progress} variant="info" className="max-w-[80px]" />
                          )}
                        </div>
                      ) : (
                        formatDuration(job.started_at, job.completed_at)
                      )}
                    </td>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <StatusIcon
                          size={14}
                          className={cn(
                            job.status === "completed" && "text-success",
                            job.status === "failed" && "text-critical",
                          )}
                          style={{
                            ...(job.status === "running" ? { animation: "spin 1s linear infinite", color: "var(--info)" } :
                            { color: job.status === "completed" ? "var(--success)" :
                                     job.status === "failed" ? "var(--critical)" :
                                     "var(--text-muted)" }),
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
                          {statusLabel(job.status)}
                        </Badge>
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "var(--space-1)" }} onClick={(e) => e.stopPropagation()}>
                        {job.actions.retry && (
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => handleRetry({ id: job.id, type: job.type })}
                            title={t("jobs.actions.retry")}
                            aria-label={t("jobs.actions.retryJob")}
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}
                        {job.actions.cancel && (
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => handleCancel({ id: job.id, type: job.type })}
                            title={t("jobs.actions.cancel")}
                            aria-label={t("jobs.actions.cancelJob")}
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

      {!!meta && meta.last_page > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "var(--space-3)" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
            {t("jobs.page.pagination", {
              current: meta.current_page,
              last: meta.last_page,
              total: meta.total,
            })}
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.current_page <= 1}
            >
              <ChevronLeft size={14} /> {t("jobs.actions.previous")}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              disabled={meta.current_page >= meta.last_page}
            >
              {t("jobs.actions.next")} <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Job detail drawer */}
      <JobDetailDrawer
        jobId={selectedJob?.id ?? null}
        jobType={selectedJob?.type ?? null}
        onClose={() => setSelectedJob(null)}
        onRetry={handleRetry}
        onCancel={handleCancel}
      />
    </div>
  );
}
