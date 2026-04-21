import { useMemo } from "react";
import { RotateCcw, GitCompare, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CLINICAL_ANALYSIS_REGISTRY } from "../../clinicalRegistry";
import type { ClinicalAnalysisGroup, ClinicalAnalysisType, Investigation } from "../../types";
import {
  formatInvestigationRelativeTime,
  getClinicalAnalysisLabel,
} from "../../lib/i18n";

// ── Constants ──────────────────────────────────────────────────────────────

const GROUP_COLOR: Record<ClinicalAnalysisGroup, string> = {
  characterize: "var(--success)",
  compare: "var(--primary)",
  predict: "var(--accent)",
};

type QueuedStatus = "configured" | "queued" | "running" | "complete" | "failed";

const STATUS_CONFIG: Record<
  QueuedStatus,
  { label: string; dotClass: string; textClass: string; bgClass: string; borderClass: string }
> = {
  complete: {
    label: "investigation.common.status.completed",
    dotClass: "bg-success",
    textClass: "text-success",
    bgClass: "bg-success/10",
    borderClass: "border-success/20",
  },
  running: {
    label: "investigation.common.status.running",
    dotClass: "bg-warning animate-pulse",
    textClass: "text-warning",
    bgClass: "bg-warning/10",
    borderClass: "border-warning/20",
  },
  queued: {
    label: "investigation.common.status.queued",
    dotClass: "bg-warning animate-pulse",
    textClass: "text-warning",
    bgClass: "bg-warning/10",
    borderClass: "border-warning/20",
  },
  configured: {
    label: "investigation.common.status.pending",
    dotClass: "bg-surface-overlay",
    textClass: "text-text-muted",
    bgClass: "bg-surface-raised/10",
    borderClass: "border-border-default",
  },
  failed: {
    label: "investigation.common.status.failed",
    dotClass: "bg-primary",
    textClass: "text-primary",
    bgClass: "bg-primary/10",
    borderClass: "border-primary/30",
  },
};

// ── Types ────────────────────────────────────────────────────────────────────

interface RunHistoryPanelProps {
  investigation: Investigation;
  onSelectExecution: (
    apiPrefix: string,
    analysisId: number,
    executionId: number,
    type: ClinicalAnalysisType,
  ) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function RunHistoryPanel({
  investigation,
  onSelectExecution,
}: RunHistoryPanelProps) {
  const { t, i18n } = useTranslation("app");
  const { queued_analyses } = investigation.clinical_state;

  // Only show entries that have an execution_id; sort most recent first
  const rows = useMemo(() => {
    return [...queued_analyses]
      .filter((qa) => qa.execution_id !== null)
      .sort((a, b) => {
        // Sort by execution_id descending (higher id = more recent) as a stable proxy
        return (b.execution_id ?? 0) - (a.execution_id ?? 0);
      });
  }, [queued_analyses]);

  // Count completed executions per analysis_type for the Compare button
  const completedCountByType = useMemo(() => {
    const counts: Partial<Record<ClinicalAnalysisType, number>> = {};
    for (const qa of queued_analyses) {
      if (qa.status === "complete") {
        counts[qa.analysis_type] = (counts[qa.analysis_type] ?? 0) + 1;
      }
    }
    return counts;
  }, [queued_analyses]);

  // ── Empty state ─────────────────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-default bg-surface-base/30 px-6 py-14 text-center">
        <Clock className="h-8 w-8 text-text-ghost" />
        <p className="text-sm text-text-ghost">
          {t("investigation.common.empty.noAnalysesRunYet")}
        </p>
      </div>
    );
  }

  // ── Row list ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2">
      {rows.map((qa) => {
        const executionId = qa.execution_id as number; // guaranteed non-null by filter above

        const descriptor = CLINICAL_ANALYSIS_REGISTRY.find((d) => d.type === qa.analysis_type);
        const analysisName = descriptor
          ? getClinicalAnalysisLabel(t, descriptor.type)
          : qa.analysis_type;
        const group = descriptor?.group ?? "characterize";
        const accent = GROUP_COLOR[group as ClinicalAnalysisGroup];

        const statusKey = qa.status as QueuedStatus;
        const sc = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.configured;

        const isComplete = qa.status === "complete";
        const showCompare = isComplete && (completedCountByType[qa.analysis_type] ?? 0) >= 2;

        // Derive a rough "created_at" from config if available, else omit timestamp
        const createdAt =
          typeof qa.config?.created_at === "string" ? qa.config.created_at : null;

        return (
          <div
            key={`${qa.analysis_id}-${executionId}`}
            className="group flex items-center gap-3 rounded-lg border border-border-default bg-surface-base/50 px-4 py-3 transition-colors hover:border-border-default"
          >
            {/* Group accent stripe */}
            <div
              className="h-8 w-0.5 shrink-0 rounded-full"
              style={{ backgroundColor: accent }}
            />

            {/* Type badge */}
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                color: accent,
                backgroundColor: `${accent}18`,
              }}
            >
              {group}
            </span>

            {/* Analysis name */}
            <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
              {analysisName}
            </span>

            {/* Timestamp */}
            {createdAt && (
              <span className="shrink-0 text-[11px] text-text-ghost">
                {formatInvestigationRelativeTime(
                  t,
                  i18n.resolvedLanguage,
                  createdAt,
                )}
              </span>
            )}

            {/* Status badge */}
            <span
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${sc.bgClass} ${sc.borderClass} ${sc.textClass}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${sc.dotClass}`} />
              {t(sc.label)}
            </span>

            {/* Compare button (2+ completed of same type) */}
            {showCompare && (
              <button
                type="button"
                disabled
                title={t("investigation.common.messages.compareComingPhase4")}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-border-default bg-surface-raised px-2.5 py-1 text-[11px] text-text-ghost opacity-50 cursor-not-allowed"
              >
                <GitCompare className="h-3 w-3" />
                {t("investigation.common.actions.compare")}
              </button>
            )}

            {/* Replay button (completed executions) */}
            {isComplete && (
              <button
                type="button"
                onClick={() =>
                  onSelectExecution(qa.api_prefix, qa.analysis_id, executionId, qa.analysis_type)
                }
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-border-default bg-surface-raised px-2.5 py-1 text-[11px] text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
                title={t("investigation.clinical.runHistory.replayTitle")}
              >
                <RotateCcw className="h-3 w-3" />
                {t("investigation.common.actions.replay")}
              </button>
            )}

            {/* View button for non-completed executions with an execution_id */}
            {!isComplete && (
              <button
                type="button"
                onClick={() =>
                  onSelectExecution(qa.api_prefix, qa.analysis_id, executionId, qa.analysis_type)
                }
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-border-default bg-surface-raised px-2.5 py-1 text-[11px] text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
                title={t("investigation.clinical.runHistory.viewTitle")}
              >
                {t("investigation.common.actions.view")}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
