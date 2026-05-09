import { AlertTriangle, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudyCompilerGuidance, StudyCompilerStageStatus } from "../../types/study";
import { tAuto } from "@/i18n/autoUserFacing";

export function StudyCompilerGuidancePanel({ guidance }: { guidance: StudyCompilerGuidance }) {
  const blockers = guidance.blockers.slice(0, 3);
  const warnings = guidance.warnings.slice(0, 2);

  return (
    <div className="rounded-lg border border-success/30 bg-success/5 p-4" role="region" aria-label={tAuto("abbyGuidance_aeb28be5")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-success" />
            <p className="text-sm font-semibold text-text-secondary">{tAuto("abbyGuidance_aeb28be5")}</p>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            {guidance.nextAction.label}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {guidance.nextAction.detail}
          </p>
          {(blockers.length > 0 || warnings.length > 0) && (
            <div className="mt-3 space-y-1">
              {blockers.map((blocker) => (
                <p key={`blocker-${blocker}`} className="flex gap-2 text-xs text-critical">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>{blocker}</span>
                </p>
              ))}
              {warnings.map((warning) => (
                <p key={`warning-${warning}`} className="flex gap-2 text-xs text-warning">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>{warning}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 text-[10px] sm:grid-cols-4 lg:min-w-[360px]">
          <GuidanceMetric label="Accepted" value={guidance.metrics.acceptedRecommendations} />
          <GuidanceMetric label="Concepts" value={guidance.metrics.materializedConceptSets} />
          <GuidanceMetric label="Cohorts" value={guidance.metrics.linkedCohorts} />
          <GuidanceMetric label="Analyses" value={guidance.metrics.materializedAnalyses} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {guidance.stages.map((stage) => (
          <div
            key={stage.id}
            className={cn(
              "rounded-md border px-2 py-2",
              stage.status === "complete" && "border-success/40 bg-success/10",
              stage.status === "active" && "border-info/40 bg-info/10",
              stage.status === "blocked" && "border-critical/40 bg-critical/10",
              stage.status === "pending" && "border-border-default bg-surface-base",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11px] font-semibold text-text-secondary">{stage.label}</p>
              <GuidanceStatusChip status={stage.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuidanceMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-default bg-surface-base px-2 py-1.5">
      <p className="text-sm font-semibold text-text-secondary">{value}</p>
      <p className="uppercase tracking-wider text-text-ghost">{label}</p>
    </div>
  );
}

function GuidanceStatusChip({ status }: { status: StudyCompilerStageStatus }) {
  const Icon = status === "complete"
    ? CheckCircle2
    : status === "blocked"
      ? AlertTriangle
      : status === "active"
        ? Sparkles
        : ChevronRight;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
        status === "complete" && "bg-success/10 text-success",
        status === "active" && "bg-info/10 text-info",
        status === "blocked" && "bg-critical/10 text-critical",
        status === "pending" && "bg-surface-overlay text-text-muted",
      )}
    >
      <Icon size={10} />
      {status}
    </span>
  );
}
