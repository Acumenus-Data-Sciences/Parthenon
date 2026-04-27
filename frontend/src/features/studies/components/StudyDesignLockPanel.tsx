import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, Lock, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type {
  StudyDesignLockChecklistItem,
  StudyDesignLockReadiness,
  StudyDesignManifestPreview,
} from "../types/study";

interface StudyDesignLockPanelProps {
  readiness: StudyDesignLockReadiness | null;
  isLoading: boolean;
  isLocking: boolean;
  versionStatus: string;
  onLock: () => void;
}

export function StudyDesignLockPanel({
  readiness,
  isLoading,
  isLocking,
  versionStatus,
  onLock,
}: StudyDesignLockPanelProps) {
  const { t } = useTranslation("app");
  const blockers = readiness?.blockers ?? [];
  const warnings = readiness?.warnings ?? [];
  const blockerRows = lockIssueRows(blockers, readiness?.blocking_reasons);
  const warningRows = lockIssueRows(warnings);
  const checklist = lockChecklistGroups(readiness);
  const finalReview = readiness?.abby_final_review;
  const manifestPreview = readiness?.manifest_preview;
  const summary = readiness?.summary;
  const provenance = readiness?.provenance_summary;
  const packageArtifact = readiness?.package_artifact;
  const locked = readiness?.locked === true || versionStatus === "locked";
  const canLock = readiness?.can_lock === true && !locked;
  const lockGate = locked
    ? "This design package is already locked."
    : isLoading
      ? t("studies.workbench.messages.checkingPackageReadiness")
      : !canLock
        ? blockerRows[0] ?? finalReview?.recommendation ?? "Resolve package checklist blockers before locking."
        : null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-text-secondary">
            {t("studies.workbench.sections.packageLock")}
          </p>
          <p className="text-xs text-text-ghost">
            {t("studies.workbench.descriptions.packageLock")}
          </p>
        </div>
        <button
          type="button"
          onClick={onLock}
          disabled={!canLock || isLocking || isLoading}
          title={lockGate ?? undefined}
          className="btn btn-primary btn-sm w-full justify-center sm:w-auto sm:shrink-0"
        >
          {isLocking ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
          {locked ? t("studies.workbench.actions.locked") : t("studies.workbench.actions.lockPackage")}
        </button>
      </div>

      <LockActionGateHint message={!canLock ? lockGate : null} />

      <div className="grid gap-2 sm:grid-cols-5">
        <LockMetric label={t("studies.workbench.labels.conceptSetsMetric")} value={summary?.materialized_concept_sets ?? 0} tone={summary?.materialized_concept_sets ? "success" : "warning"} />
        <LockMetric label={t("studies.workbench.labels.cohortsMetric")} value={summary?.linked_cohorts ?? 0} tone={summary?.linked_cohorts ? "success" : "warning"} />
        <LockMetric label={t("studies.workbench.labels.feasibility")} value={summary?.feasibility_status ?? t("studies.workbench.messages.unknown")} tone={summary?.feasibility_status === "ready" ? "success" : "warning"} />
        <LockMetric label={t("studies.workbench.labels.analysesMetric")} value={summary?.materialized_analysis_plans ?? 0} tone={summary?.materialized_analysis_plans ? "success" : "warning"} />
        <LockMetric label={t("studies.workbench.labels.packagesMetric")} value={summary?.package_assets ?? 0} tone={locked ? "success" : "warning"} />
      </div>

      {isLoading && (
        <p className="text-xs text-text-ghost">{t("studies.workbench.messages.checkingPackageReadiness")}</p>
      )}

      {!isLoading && finalReview && (
        <div className={cn(
          "rounded-md border px-3 py-2",
          finalReview.status === "ready" ? "border-success/30 bg-success/5" : "border-warning/40 bg-warning/10",
        )}
        >
          <p className="text-xs font-semibold text-text-secondary">Abby final package review</p>
          {finalReview.summary && <p className="mt-1 text-xs text-text-muted">{finalReview.summary}</p>}
          {finalReview.recommendation && <p className="mt-1 text-[11px] text-text-ghost">{finalReview.recommendation}</p>}
        </div>
      )}

      {!isLoading && checklist.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {checklist.map((item) => (
            <div key={item.id ?? item.label} className="rounded-md border border-border-default bg-surface-base px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-text-secondary">{item.label}</p>
                <LockStatusChip status={item.status} />
              </div>
              {item.message && <p className="mt-1 text-[11px] text-text-muted">{item.message}</p>}
              {arrayValue(item.blockers).slice(0, 2).map((issue, index) => (
                <p key={`${item.id}-blocker-${index}`} className="mt-1 text-[11px] text-critical">{issueMessage(issue)}</p>
              ))}
              {arrayValue(item.warnings).slice(0, 2).map((issue, index) => (
                <p key={`${item.id}-warning-${index}`} className="mt-1 text-[11px] text-warning">{issueMessage(issue)}</p>
              ))}
            </div>
          ))}
        </div>
      )}

      {!isLoading && blockerRows.length > 0 && (
        <div className="space-y-2">
          {blockerRows.map((blocker, index) => (
            <p key={`package-blocker-${index}-${blocker}`} className="text-xs text-critical">{blocker}</p>
          ))}
        </div>
      )}

      {!isLoading && blockerRows.length === 0 && warningRows.length > 0 && (
        <div className="space-y-2">
          {warningRows.map((warning, index) => (
            <p key={`package-warning-${index}-${warning}`} className="text-xs text-warning">{warning}</p>
          ))}
        </div>
      )}

      {!isLoading && readiness?.status === "ready" && (
        <p className="text-xs text-success">{t("studies.workbench.messages.readyToLock")}</p>
      )}

      {!isLoading && manifestPreview && (
        <div className="rounded-md border border-border-default bg-surface-base px-3 py-2">
          <p className="text-xs font-semibold text-text-secondary">Package manifest preview</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {lockManifestMetrics(manifestPreview).map((metric) => (
              <LockMetric key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />
            ))}
          </div>
          {isRecord(manifestPreview.artifact) && typeof manifestPreview.artifact.url === "string" && (
            <a href={manifestPreview.artifact.url} className="btn btn-ghost btn-sm mt-2 inline-flex">
              {t("studies.workbench.actions.downloadPackageSummary")}
            </a>
          )}
        </div>
      )}

      {!isLoading && locked && (
        <div className="space-y-2">
          <p className="text-xs text-success">{t("studies.workbench.messages.lockedPackageAvailable")}</p>
          {packageArtifact?.url && (
            <a href={packageArtifact.url} className="btn btn-ghost btn-sm inline-flex">
              {t("studies.workbench.actions.downloadPackageSummary")}
            </a>
          )}
        </div>
      )}

      {provenance && (
        <div className="grid gap-2 sm:grid-cols-4">
          <LockMetric label={t("studies.workbench.labels.aiEvents")} value={provenance.ai_events ?? 0} tone="neutral" />
          <LockMetric label={t("studies.workbench.labels.reviewed")} value={provenance.reviewed_assets ?? 0} tone="neutral" />
          <LockMetric label={t("studies.workbench.labels.verified")} value={provenance.verified_assets ?? 0} tone="success" />
          <LockMetric label={t("studies.workbench.labels.manifest")} value={provenance.package_manifest_sha256 ? t("studies.workbench.messages.signed") : t("studies.workbench.messages.pending")} tone={provenance.package_manifest_sha256 ? "success" : "neutral"} />
        </div>
      )}
    </div>
  );
}

function LockActionGateHint({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function LockStatusChip({ status }: { status?: string }) {
  const normalized = status ?? "pending";
  const Icon = normalized === "complete"
    ? CheckCircle2
    : normalized === "blocked" || normalized === "warning"
      ? AlertTriangle
      : normalized === "ready"
        ? Sparkles
        : ChevronRight;

  return (
    <span className={cn(
      "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
      normalized === "complete" && "bg-success/10 text-success",
      normalized === "blocked" && "bg-critical/10 text-critical",
      normalized === "warning" && "bg-warning/10 text-warning",
      normalized === "ready" && "bg-info/10 text-info",
      normalized === "pending" && "bg-surface-overlay text-text-muted",
    )}
    >
      <Icon size={10} />
      {normalized}
    </span>
  );
}

function LockMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "success" | "warning" | "critical" | "neutral";
}) {
  return (
    <div className={cn(
      "rounded-md border px-3 py-2",
      tone === "success" && "border-success/30 bg-success/5",
      tone === "warning" && "border-warning/40 bg-warning/10",
      tone === "critical" && "border-critical/40 bg-critical/10",
      tone === "neutral" && "border-border-default bg-surface-base",
    )}
    >
      <p className="text-[10px] uppercase tracking-wider text-text-ghost">{label}</p>
      <p className="mt-1 text-sm font-semibold text-text-secondary">{value}</p>
    </div>
  );
}

function lockIssueRows(issues: unknown, fallback?: unknown): string[] {
  const rows = arrayValue(issues).map(issueMessage).filter((message) => message !== "");
  if (rows.length > 0) return rows;

  return arrayValue(fallback).filter((message): message is string => typeof message === "string" && message.trim() !== "");
}

function lockChecklistGroups(readiness: StudyDesignLockReadiness | null): StudyDesignLockChecklistItem[] {
  if (Array.isArray(readiness?.checklist)) return readiness.checklist;

  return [];
}

function lockManifestMetrics(manifestPreview: StudyDesignManifestPreview): Array<{ label: string; value: string | number; tone: "success" | "warning" | "neutral" }> {
  const contents = isRecord(manifestPreview.contents) ? manifestPreview.contents : {};
  const artifact = isRecord(manifestPreview.artifact) ? manifestPreview.artifact : null;

  return [
    { label: "Concept sets", value: numericMetric(contents.concept_sets), tone: numericMetric(contents.concept_sets) > 0 ? "success" : "warning" },
    { label: "Cohorts", value: numericMetric(contents.cohorts), tone: numericMetric(contents.cohorts) > 0 ? "success" : "warning" },
    { label: "Feasibility", value: typeof contents.feasibility === "string" ? contents.feasibility : "pending", tone: contents.feasibility === "ready" ? "success" : "warning" },
    { label: "Analyses", value: numericMetric(contents.analysis_plans), tone: numericMetric(contents.analysis_plans) > 0 ? "success" : "warning" },
    { label: "Artifact", value: artifact?.url ? "ready" : "pending", tone: artifact?.url ? "success" : "neutral" },
    { label: "SHA-256", value: typeof artifact?.sha256 === "string" && artifact.sha256 !== "" ? "signed" : "pending", tone: typeof artifact?.sha256 === "string" && artifact.sha256 !== "" ? "success" : "neutral" },
  ];
}

function numericMetric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function issueMessage(issue: unknown): string {
  if (typeof issue === "string") return issue;
  if (isRecord(issue) && typeof issue.message === "string") return issue.message;
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function arrayValue<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}
