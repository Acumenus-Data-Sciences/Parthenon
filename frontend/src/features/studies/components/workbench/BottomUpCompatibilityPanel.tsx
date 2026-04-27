import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudyDesignAsset } from "../../types/study";
import { ActionGateHint } from "./shared/ActionGateHint";
import { EvidenceMetric } from "./shared/EvidenceMetric";
import { VerificationBadge } from "./shared/VerificationBadge";
import {
  buildCompatibilityAssistance,
  type CompatibilityAssistance,
  type CompatibilityGroup,
} from "../studyDesignCompatibilityAssistance";

export function BottomUpCompatibilityPanel({
  assets,
  isImporting,
  isCritiquing,
  canCritique,
  onImport,
  onCritique,
}: {
  assets: StudyDesignAsset[];
  isImporting: boolean;
  isCritiquing: boolean;
  canCritique: boolean;
  onImport: () => void;
  onCritique: () => void;
}) {
  const { t } = useTranslation("app");
  const compatibility = useMemo(
    () => buildCompatibilityAssistance(assets),
    [assets],
  );
  const visibleGroups = compatibility.groups.filter(
    (group) => group.status !== "empty" || group.id === "feasibility" || group.id === "package",
  );
  const critiqueGate = !canCritique
    ? "Locked design versions cannot be critiqued. Start a new design session to continue."
    : null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">
            {t("studies.workbench.sections.currentAssets")}
          </p>
          <p className="text-xs text-text-ghost">
            {t("studies.workbench.descriptions.currentAssets")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onImport}
            disabled={isImporting}
            className="btn btn-ghost btn-sm"
          >
            {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {t("studies.workbench.actions.importCurrent")}
          </button>
          <button
            type="button"
            onClick={onCritique}
            disabled={isCritiquing || !canCritique}
            title={critiqueGate ?? undefined}
            className="btn btn-primary btn-sm"
          >
            {isCritiquing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {t("studies.workbench.actions.critique")}
          </button>
        </div>
      </div>

      <ActionGateHint message={critiqueGate} />

      <div className="grid gap-2 sm:grid-cols-3">
        <EvidenceMetric label={t("studies.workbench.labels.imported")} value={compatibility.metrics.imported} tone={compatibility.metrics.imported > 0 ? "success" : "neutral"} />
        <EvidenceMetric label={t("studies.workbench.labels.critiques")} value={compatibility.metrics.critiques} tone={compatibility.metrics.critiques > 0 ? "warning" : "neutral"} />
        <EvidenceMetric label={t("studies.workbench.labels.blocked")} value={compatibility.metrics.blocking} tone={compatibility.metrics.blocking > 0 ? "critical" : "neutral"} />
      </div>

      <CompatibilityOverview compatibility={compatibility} />

      {visibleGroups.length > 0 && (
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleGroups.map((group) => (
            <CompatibilityGroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompatibilityOverview({ compatibility }: { compatibility: CompatibilityAssistance }) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        compatibility.status === "blocked" && "border-critical/40 bg-critical/10",
        compatibility.status === "review" && "border-warning/40 bg-warning/10",
        compatibility.status === "ready" && "border-success/30 bg-success/5",
        compatibility.status === "empty" && "border-border-default bg-surface-base",
      )}
    >
      <div className="flex items-start gap-2">
        {compatibility.status === "blocked"
          ? <AlertTriangle size={15} className="mt-0.5 shrink-0 text-critical" />
          : compatibility.status === "ready"
            ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
            : <Sparkles size={15} className="mt-0.5 shrink-0 text-warning" />}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-secondary">Abby compatibility tasks</p>
          <p className="mt-1 text-xs text-text-muted">{compatibility.summary}</p>
          <p className="mt-1 text-[11px] text-text-ghost">{compatibility.policy}</p>
        </div>
      </div>
    </div>
  );
}

function CompatibilityGroupCard({ group }: { group: CompatibilityGroup }) {
  const hasContent = group.importedAssets.length > 0 || group.tasks.length > 0;

  return (
    <div className="rounded-md border border-border-default bg-surface-base px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-secondary">{group.label}</p>
            <CompatibilityStatusBadge status={group.status} />
          </div>
          <p className="mt-1 text-xs text-text-muted">{group.nextAction}</p>
        </div>
        <div className="shrink-0 text-right text-[10px] uppercase tracking-wider text-text-ghost">
          <div>{group.importedAssets.length} imported</div>
          <div>{group.tasks.length} tasks</div>
        </div>
      </div>

      {!hasContent && (
        <p className="mt-3 text-xs text-text-ghost">No imported assets or critique tasks in this stage yet.</p>
      )}

      {group.tasks.length > 0 && (
        <div className="mt-3 space-y-2">
          {group.tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "rounded-md border px-3 py-2",
                task.severity === "blocking"
                  ? "border-critical/40 bg-critical/10"
                  : "border-warning/40 bg-warning/10",
              )}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={14}
                  className={cn(
                    "mt-0.5 shrink-0",
                    task.severity === "blocking" ? "text-critical" : "text-warning",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-secondary">{task.actionLabel}</p>
                  <p className="mt-1 text-xs text-text-muted">{task.message}</p>
                  <p className="mt-1 text-[11px] text-text-ghost">{task.actionTarget}</p>
                  {task.nativeLink && (
                    <a href={task.nativeLink} className="mt-2 inline-flex text-xs text-accent hover:text-accent-hover">
                      Open native record
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {group.importedAssets.length > 0 && (
        <div className="mt-3 divide-y divide-border-default overflow-hidden rounded-md border border-border-default">
          {group.importedAssets.slice(0, 4).map((asset) => (
            <div key={asset.id} className="flex flex-col gap-2 bg-surface-raised px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-xs font-medium text-text-secondary">{asset.label}</p>
                  {asset.role && <span className="text-[10px] text-text-ghost">{asset.role}</span>}
                  <VerificationBadge status={asset.verificationStatus} />
                </div>
                {asset.detail && <p className="mt-1 line-clamp-1 text-[11px] text-text-muted">{asset.detail}</p>}
                {asset.blocker && <p className="mt-1 text-[11px] text-critical">{asset.blocker}</p>}
                {!asset.blocker && asset.warning && <p className="mt-1 text-[11px] text-warning">{asset.warning}</p>}
              </div>
              {asset.nativeLink && asset.nativeLabel && (
                <a href={asset.nativeLink} className="btn btn-ghost btn-sm shrink-0">
                  {asset.nativeLabel}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompatibilityStatusBadge({ status }: { status: CompatibilityGroup["status"] }) {
  const label = status === "blocked"
    ? "Blocked"
    : status === "review"
      ? "Review"
      : status === "ready"
        ? "Ready"
        : "Empty";

  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
        status === "blocked" && "border-critical/40 text-critical",
        status === "review" && "border-warning/50 text-warning",
        status === "ready" && "border-success/40 text-success",
        status === "empty" && "border-border-default text-text-ghost",
      )}
    >
      {label}
    </span>
  );
}
