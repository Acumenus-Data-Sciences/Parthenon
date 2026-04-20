import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  X,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  AlertTriangle,
  ExternalLink,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useIngestionProject,
  useStageFiles,
  useRemoveProjectFile,
} from "../hooks/useIngestionProjects";
import { MultiFileUploadZone } from "../components/MultiFileUploadZone";
import { FileReviewList, deriveTableName } from "../components/FileReviewList";
import { StagingPreview } from "../components/StagingPreview";
import ConnectDatabaseColumn from "../components/ConnectDatabaseColumn";
import type { IngestionProject } from "../api/ingestionApi";
import type { IngestionJob } from "@/types/ingestion";

interface ProjectDetailViewProps {
  projectId: number;
  onBack: () => void;
}

const STATUS_STYLES: Record<IngestionProject["status"], { labelKey: string; classes: string }> = {
  draft: { labelKey: "ingestion.statuses.draft", classes: "bg-surface-accent text-text-muted" },
  profiling: { labelKey: "ingestion.statuses.profiling", classes: "bg-blue-900/30 text-blue-400 animate-pulse" },
  ready: { labelKey: "ingestion.statuses.ready", classes: "bg-teal-900/30 text-success" },
  mapping: { labelKey: "ingestion.statuses.mapping", classes: "bg-amber-900/30 text-accent" },
  completed: { labelKey: "ingestion.statuses.completed", classes: "bg-green-900/30 text-green-400" },
  failed: { labelKey: "ingestion.statuses.failed", classes: "bg-red-900/30 text-red-400" },
};

const JOB_STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <Check size={14} className="text-success" />,
  running: <Loader2 size={14} className="animate-spin text-blue-400" />,
  pending: <Loader2 size={14} className="text-text-muted" />,
  queued: <Loader2 size={14} className="text-text-muted" />,
  failed: <X size={14} className="text-critical" />,
  cancelled: <X size={14} className="text-text-ghost" />,
};

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function getJobTableName(job: IngestionJob): string | null {
  const stats = job.stats_json as Record<string, unknown> | null;
  if (stats && typeof stats["staging_table_name"] === "string") {
    return stats["staging_table_name"];
  }
  // Fallback: derive from profile file name
  const profile = job.profiles?.[0];
  if (profile) {
    return deriveTableName(profile.file_name);
  }
  return null;
}

function getJobRowCount(job: IngestionJob): number | null {
  const stats = job.stats_json as Record<string, unknown> | null;
  if (stats && typeof stats["row_count"] === "number") return stats["row_count"];
  return job.profiles?.[0]?.row_count ?? null;
}

function getJobColumnCount(job: IngestionJob): number | null {
  const stats = job.stats_json as Record<string, unknown> | null;
  if (stats && typeof stats["column_count"] === "number") return stats["column_count"];
  return job.profiles?.[0]?.column_count ?? null;
}

function getJobPiiFlag(job: IngestionJob): boolean | null {
  const stats = job.stats_json as Record<string, unknown> | null;
  if (stats && typeof stats["pii_detected"] === "boolean") return stats["pii_detected"];
  return null;
}

export default function ProjectDetailView({ projectId, onBack }: ProjectDetailViewProps) {
  const { t } = useTranslation("app");
  const { data: project, isLoading, error } = useIngestionProject(projectId);
  const stageFilesMutation = useStageFiles(projectId);
  const removeFileMutation = useRemoveProjectFile(projectId);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [expandedPreview, setExpandedPreview] = useState<string | null>(null);
  const [uploadExpanded, setUploadExpanded] = useState(true);
  const [confirmDeleteJobId, setConfirmDeleteJobId] = useState<number | null>(null);

  // Collapse upload after staging succeeds
  const isDraft = project?.status === "draft";

  const handleFilesSelect = (files: File[]) => {
    setSelectedFiles((prev) => [...prev, ...files]);
    setTableNames((prev) => [...prev, ...files.map((f) => deriveTableName(f.name))]);
  };

  const handleTableNameChange = (index: number, name: string) => {
    setTableNames((prev) => {
      const next = [...prev];
      next[index] = name;
      return next;
    });
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setTableNames((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStageAll = () => {
    stageFilesMutation.mutate(
      { files: selectedFiles, tableNames },
      {
        onSuccess: () => {
          setSelectedFiles([]);
          setTableNames([]);
          setUploadExpanded(false);
        },
      },
    );
  };

  const handleDeleteJob = (jobId: number) => {
    removeFileMutation.mutate(jobId, {
      onSuccess: () => setConfirmDeleteJobId(null),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          {t("ingestion.actions.backToProjects")}
        </button>
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-critical">
            {t("ingestion.projectDetail.loadFailed")}
          </p>
        </div>
      </div>
    );
  }

  const jobs = project.jobs ?? [];
  const stagedJobs = jobs.filter((j) => getJobTableName(j) !== null);
  const statusStyle = STATUS_STYLES[project.status];

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          {t("ingestion.actions.backToProjects")}
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">{project.name}</h2>
            <span
              className={cn(
                "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                statusStyle.classes,
              )}
            >
              {t(statusStyle.labelKey)}
            </span>
          </div>
          <a
            href={
              project.status === "ready" || project.status === "mapping" || project.status === "completed"
                ? `/ingestion?tab=aqueduct&project=${project.id}`
                : undefined
            }
            aria-disabled={project.status !== "ready" && project.status !== "mapping" && project.status !== "completed"}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors",
              project.status === "ready" || project.status === "mapping" || project.status === "completed"
                ? "bg-success text-surface-base hover:bg-success-dark"
                : "bg-surface-overlay text-text-ghost border border-surface-highlight pointer-events-none",
            )}
          >
            {t("ingestion.actions.openInAqueduct")}
            <ExternalLink size={12} />
          </a>
        </div>

        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span>
            {t("ingestion.projectDetail.fileCount", {
              count: project.file_count,
            })}
          </span>
          <span className="w-px h-3 bg-surface-highlight" />
          <span>{formatBytes(project.total_size_bytes)}</span>
          {project.source && (
            <>
              <span className="w-px h-3 bg-surface-highlight" />
              <span>
                {t("ingestion.common.sourceColon")} {project.source.source_name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Ingestion: Connect to Database + Upload Files */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column: Connect to Database */}
        <div className="rounded-lg border border-border-default bg-surface-raised p-5">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-medium text-text-primary">
              {t("ingestion.actions.connectToDatabase")}
            </h3>
          </div>
          <ConnectDatabaseColumn project={project} />
        </div>

        {/* Right column: Upload Files */}
        <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
          <button
            type="button"
            onClick={() => setUploadExpanded((v) => !v)}
            className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-surface-overlay transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15">
                <Plus size={16} className="text-primary" />
              </div>
              <div>
                <span className="text-sm font-medium text-text-primary">
                  {isDraft
                    ? t("ingestion.projectDetail.uploadSourceFiles")
                    : t("ingestion.actions.addMoreFiles")}
                </span>
                <p className="text-xs text-text-muted">
                  {t("ingestion.projectDetail.uploadHelp")}
                </p>
              </div>
            </div>
            {uploadExpanded ? (
              <ChevronUp size={16} className="text-text-muted" />
            ) : (
              <ChevronDown size={16} className="text-text-muted" />
            )}
          </button>

          {uploadExpanded && (
            <div className="px-5 pb-5 pt-1 border-t border-border-subtle space-y-4">
              {selectedFiles.length === 0 ? (
                <MultiFileUploadZone onFilesSelect={handleFilesSelect} />
              ) : (
                <FileReviewList
                  files={selectedFiles}
                  tableNames={tableNames}
                  onTableNameChange={handleTableNameChange}
                  onRemove={handleRemoveFile}
                  onStageAll={handleStageAll}
                  isStaging={stageFilesMutation.isPending}
                />
              )}

              {stageFilesMutation.isError && (
                <div className="rounded-lg border border-critical/30 bg-critical/10 px-4 py-2.5">
                  <p className="text-sm text-critical">
                    {stageFilesMutation.error instanceof Error
                      ? stageFilesMutation.error.message
                      : t("ingestion.projectDetail.stagingFailed")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Staged Files Table */}
      {stagedJobs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">
            {t("ingestion.projectDetail.stagedFiles")}
          </h3>
          <div className="rounded-lg border border-border-default overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-raised border-b border-border-default">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {t("ingestion.common.tableName")}
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {t("ingestion.common.rows")}
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {t("ingestion.common.columns")}
                  </th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {t("ingestion.common.status")}
                  </th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    PII
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {t("ingestion.common.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stagedJobs.map((job) => {
                  const tableName = getJobTableName(job)!;
                  const rowCount = getJobRowCount(job);
                  const colCount = getJobColumnCount(job);
                  const pii = getJobPiiFlag(job);
                  const isPreviewOpen = expandedPreview === tableName;

                  return (
                    <StagedFileRow
                      key={job.id}
                      job={job}
                      tableName={tableName}
                      rowCount={rowCount}
                      colCount={colCount}
                      pii={pii}
                      isPreviewOpen={isPreviewOpen}
                      onTogglePreview={() =>
                        setExpandedPreview(isPreviewOpen ? null : tableName)
                      }
                      projectId={projectId}
                      confirmDeleteJobId={confirmDeleteJobId}
                      onConfirmDelete={setConfirmDeleteJobId}
                      onDelete={handleDeleteJob}
                      isDeleting={removeFileMutation.isPending}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state when no staged jobs */}
      {stagedJobs.length === 0 && !isDraft && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-12">
          <FileText size={24} className="text-text-muted mb-3" />
          <p className="text-sm text-text-muted">
            {t("ingestion.projectDetail.emptyStagedFiles")}
          </p>
        </div>
      )}

      {/* Add more files button */}
      {project.status === "ready" && !uploadExpanded && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setUploadExpanded(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-surface-highlight bg-surface-overlay px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-elevated"
          >
            <Plus size={14} />
            {t("ingestion.actions.addMoreFiles")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Staged File Row ──────────────────────────────────────────────── */

interface StagedFileRowProps {
  job: IngestionJob;
  tableName: string;
  rowCount: number | null;
  colCount: number | null;
  pii: boolean | null;
  isPreviewOpen: boolean;
  onTogglePreview: () => void;
  projectId: number;
  confirmDeleteJobId: number | null;
  onConfirmDelete: (id: number | null) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}

function StagedFileRow({
  job,
  tableName,
  rowCount,
  colCount,
  pii,
  isPreviewOpen,
  onTogglePreview,
  projectId,
  confirmDeleteJobId,
  onConfirmDelete,
  onDelete,
  isDeleting,
}: StagedFileRowProps) {
  const { t } = useTranslation("app");
  const statusIcon = JOB_STATUS_ICON[job.status] ?? null;
  const isConfirmingDelete = confirmDeleteJobId === job.id;

  return (
    <>
      <tr className="border-b border-border-default bg-surface-base hover:bg-surface-overlay transition-colors">
        {/* Table Name */}
        <td className="px-4 py-3 text-sm font-mono text-text-primary">
          {tableName}
        </td>

        {/* Rows */}
        <td className="px-4 py-3 text-right text-sm tabular-nums text-text-secondary">
          {rowCount !== null ? rowCount.toLocaleString() : "--"}
        </td>

        {/* Columns */}
        <td className="px-4 py-3 text-right text-sm tabular-nums text-text-secondary">
          {colCount !== null ? colCount.toLocaleString() : "--"}
        </td>

        {/* Status */}
        <td className="px-4 py-3 text-center">
          <div className="inline-flex items-center gap-1.5" title={job.error_message ?? job.status}>
            {statusIcon}
            <span className="text-xs text-text-muted capitalize">{job.status}</span>
          </div>
          {job.status === "failed" && job.error_message && (
            <div className="mt-1">
              <span
                className="text-[10px] text-critical cursor-help"
                title={job.error_message}
              >
                <AlertTriangle size={10} className="inline mr-0.5" />
                {t("ingestion.common.error")}
              </span>
            </div>
          )}
        </td>

        {/* PII */}
        <td className="px-4 py-3 text-center">
          {pii === null ? (
            <span className="text-xs text-text-ghost">--</span>
          ) : pii ? (
            <span
              className="inline-flex items-center gap-1 text-xs text-amber-400"
              title={t("ingestion.projectDetail.piiDetected")}
            >
              <AlertTriangle size={12} />
              {t("dataSources.common.yes")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <Check size={12} />
              {t("dataSources.common.no")}
            </span>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {/* Preview toggle */}
            <button
              type="button"
              onClick={onTogglePreview}
              className={cn(
                "inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors",
                isPreviewOpen
                  ? "text-accent bg-accent/10"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-elevated",
              )}
              title={
                isPreviewOpen
                  ? t("ingestion.projectDetail.hidePreview")
                  : t("ingestion.projectDetail.previewData")
              }
            >
              {isPreviewOpen ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>

            {/* Delete */}
            {isConfirmingDelete ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onDelete(job.id)}
                  disabled={isDeleting}
                  className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-900/20 transition-colors"
                >
                  {isDeleting ? "..." : t("ingestion.actions.confirmDelete")}
                </button>
                <button
                  type="button"
                  onClick={() => onConfirmDelete(null)}
                  className="rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-overlay transition-colors"
                >
                  {t("ingestion.actions.cancel")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onConfirmDelete(job.id)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-critical hover:bg-surface-elevated transition-colors"
                title={t("ingestion.actions.removeFile")}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Inline Preview */}
      {isPreviewOpen && (
        <tr>
          <td colSpan={6} className="p-0">
            <StagingPreview projectId={projectId} tableName={tableName} onClose={onTogglePreview} />
          </td>
        </tr>
      )}
    </>
  );
}
