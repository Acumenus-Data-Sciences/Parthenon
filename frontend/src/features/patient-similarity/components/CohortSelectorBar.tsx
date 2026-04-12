import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCohortDefinitions } from "@/features/cohort-definitions/hooks/useCohortDefinitions";
import { useSources } from "@/features/data-sources/hooks/useSources";
import { useCohortProfile } from "../hooks/usePatientSimilarity";
import { GenerationStatusBanner } from "./GenerationStatusBanner";
import type { PipelineMode } from "../types/pipeline";

export interface CohortSelectorBarProps {
  mode: PipelineMode;
  sourceId: number | null;
  targetCohortId: number | null;
  comparatorCohortId: number | null;
  onModeChange: (mode: PipelineMode) => void;
  onSourceChange: (sourceId: number) => void;
  onTargetChange: (cohortId: number | null) => void;
  onComparatorChange: (cohortId: number | null) => void;
  onCompare: () => void;
  onOpenSettings: () => void;
  isRunning?: boolean;
}

export function CohortSelectorBar({
  mode,
  sourceId,
  targetCohortId,
  comparatorCohortId,
  onModeChange,
  onSourceChange,
  onTargetChange,
  onComparatorChange,
  onCompare,
  onOpenSettings,
  isRunning = false,
}: CohortSelectorBarProps) {
  const { data: sourcesData } = useSources();
  const sources = sourcesData ?? [];

  const { data: cohortsData } = useCohortDefinitions({ limit: 500 });
  const cohorts = cohortsData?.items ?? [];

  const { data: targetProfile, isLoading: targetProfileLoading } =
    useCohortProfile(
      targetCohortId != null && targetCohortId > 0 ? targetCohortId : undefined,
      sourceId ?? 0,
    );

  const { data: comparatorProfile, isLoading: comparatorProfileLoading } =
    useCohortProfile(
      comparatorCohortId != null && comparatorCohortId > 0 ? comparatorCohortId : undefined,
      sourceId ?? 0,
    );

  const isCompareMode = mode === "compare";
  const actionDisabled =
    isRunning ||
    sourceId == null ||
    targetCohortId == null ||
    (isCompareMode && comparatorCohortId == null);

  const handleTargetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onTargetChange(val ? Number(val) : null);
  };

  const handleComparatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onComparatorChange(val ? Number(val) : null);
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val) onSourceChange(Number(val));
  };

  const showTargetBanner =
    sourceId != null && targetCohortId != null && targetCohortId > 0;
  const showComparatorBanner =
    isCompareMode &&
    sourceId != null &&
    comparatorCohortId != null &&
    comparatorCohortId > 0;

  return (
    <div className="sticky top-0 z-10 bg-surface-base border-b border-border-default px-4 py-3 space-y-2">
      {/* Controls row — single-line items align to the dropdown top, banners stack beneath */}
      <div className="flex items-start gap-3 flex-wrap">
        {/* Data source dropdown */}
        <select
          value={sourceId ?? ""}
          onChange={handleSourceChange}
          className={cn(
            "rounded-md bg-surface-overlay border border-border-default px-3 py-1.5 text-sm text-text-secondary",
            "focus:outline-none focus:ring-1 focus:ring-accent/50",
            "min-w-[140px]",
          )}
          aria-label="Data source"
        >
          <option value="">Source…</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.source_name}
            </option>
          ))}
        </select>

        {/* Mode toggle */}
        <div className="flex rounded-md overflow-hidden border border-border-default">
          <button
            type="button"
            onClick={() => onModeChange("compare")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              isCompareMode
                ? "bg-primary text-primary-foreground"
                : "bg-surface-overlay text-text-muted hover:text-text-secondary",
            )}
          >
            Compare Cohorts
          </button>
          <button
            type="button"
            onClick={() => onModeChange("expand")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              !isCompareMode
                ? "bg-success text-surface-base"
                : "bg-surface-overlay text-text-muted hover:text-text-secondary",
            )}
          >
            Expand Cohort
          </button>
        </div>

        {/* Target cohort — dropdown + status banner stacked, aligned under select */}
        <div className="flex-1 min-w-[160px] flex flex-col gap-1">
          <select
            value={targetCohortId ?? ""}
            onChange={handleTargetChange}
            className={cn(
              "w-full rounded-md bg-surface-overlay border border-primary/40 px-3 py-1.5 text-sm text-text-secondary",
              "focus:outline-none focus:ring-1 focus:ring-primary/50",
            )}
            aria-label="Target cohort"
          >
            <option value="">
              {isCompareMode ? "Target cohort…" : "Seed cohort…"}
            </option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {showTargetBanner && (
            <div className="flex items-baseline gap-1.5 pl-0.5">
              <span className="text-[11px] font-medium text-primary">
                {isCompareMode ? "Target:" : "Seed:"}
              </span>
              <GenerationStatusBanner
                cohortDefinitionId={targetCohortId!}
                sourceId={sourceId!}
                profile={targetProfile}
                isLoading={targetProfileLoading}
              />
            </div>
          )}
        </div>

        {/* Comparator cohort — dropdown + status banner stacked, hidden in expand mode */}
        {isCompareMode && (
          <div className="flex-1 min-w-[160px] flex flex-col gap-1">
            <select
              value={comparatorCohortId ?? ""}
              onChange={handleComparatorChange}
              className={cn(
                "w-full rounded-md bg-surface-overlay border border-success/40 px-3 py-1.5 text-sm text-text-secondary",
                "focus:outline-none focus:ring-1 focus:ring-success/50",
              )}
              aria-label="Comparator cohort"
            >
              <option value="">Comparator cohort…</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {showComparatorBanner && (
              <div className="flex items-baseline gap-1.5 pl-0.5">
                <span className="text-[11px] font-medium text-success">
                  Comparator:
                </span>
                <GenerationStatusBanner
                  cohortDefinitionId={comparatorCohortId!}
                  sourceId={sourceId!}
                  profile={comparatorProfile}
                  isLoading={comparatorProfileLoading}
                />
              </div>
            )}
          </div>
        )}

        {/* Action button */}
        <button
          type="button"
          onClick={onCompare}
          disabled={actionDisabled}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-colors shrink-0",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            isCompareMode
              ? "bg-primary text-primary-foreground hover:bg-primary-dark"
              : "bg-success text-surface-base hover:bg-success-dark",
          )}
        >
          {isCompareMode ? "Compare" : "Find Similar"}
        </button>

        {/* Settings gear */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Analysis settings"
          className={cn(
            "p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-accent transition-colors shrink-0",
          )}
        >
          <Settings size={16} />
        </button>
      </div>

    </div>
  );
}
