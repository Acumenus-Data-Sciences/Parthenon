import { useState, useEffect } from "react";
import { GitCompareArrows, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSourceStore } from "@/stores/sourceStore";
import { useCohortDefinitions } from "@/features/cohort-definitions/hooks/useCohortDefinitions";
import { useCohortProfile } from "../hooks/usePatientSimilarity";
import { GenerationStatusBanner } from "./GenerationStatusBanner";
import type { CohortComparisonParams, CrossCohortSearchParams } from "../types/patientSimilarity";

interface CohortCompareFormProps {
  onCompare: (params: CohortComparisonParams) => void;
  onCrossSearch: (params: CrossCohortSearchParams) => void;
  isComparing: boolean;
  isSearching: boolean;
  hasComparisonResult: boolean;
  sourceId: number;
  onSourceChange: (sourceId: number) => void;
}

export function CohortCompareForm({
  onCompare,
  onCrossSearch,
  isComparing,
  isSearching,
  hasComparisonResult,
  sourceId,
  onSourceChange,
}: CohortCompareFormProps) {
  const { sources } = useSourceStore();
  const [sourceCohortId, setSourceCohortId] = useState<number>(0);
  const [targetCohortId, setTargetCohortId] = useState<number>(0);
  const [comparedSelectionKey, setComparedSelectionKey] = useState<string | null>(null);

  const { data: cohortsData, isLoading: cohortsLoading } =
    useCohortDefinitions({ limit: 500 });
  const cohorts = cohortsData?.items ?? [];

  const { data: sourceProfile, isLoading: sourceProfileLoading } =
    useCohortProfile(
      sourceCohortId > 0 ? sourceCohortId : undefined,
      sourceId,
    );
  const { data: targetProfile, isLoading: targetProfileLoading } =
    useCohortProfile(
      targetCohortId > 0 ? targetCohortId : undefined,
      sourceId,
    );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSourceCohortId(0);
    setTargetCohortId(0);
    setComparedSelectionKey(null);
  }, [sourceId]);

  const currentSelectionKey =
    sourceId > 0 && sourceCohortId > 0 && targetCohortId > 0
      ? `${sourceId}:${sourceCohortId}:${targetCohortId}`
      : null;

  useEffect(() => {
    if (comparedSelectionKey !== null && comparedSelectionKey !== currentSelectionKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setComparedSelectionKey(null);
    }
  }, [comparedSelectionKey, currentSelectionKey]);

  const bothGenerated =
    sourceProfile?.generated === true && targetProfile?.generated === true;

  const handleCompare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bothGenerated || sourceId <= 0 || currentSelectionKey === null) return;

    setComparedSelectionKey(currentSelectionKey);

    onCompare({
      source_cohort_id: sourceCohortId,
      target_cohort_id: targetCohortId,
      source_id: sourceId,
    });
  };

  const handleCrossSearch = () => {
    if (!bothGenerated || sourceId <= 0) return;

    onCrossSearch({
      source_cohort_id: sourceCohortId,
      target_cohort_id: targetCohortId,
      source_id: sourceId,
    });
  };

  return (
    <form onSubmit={handleCompare} className="space-y-5">
      {/* Source Selector */}
      <div>
        <label className="block text-[10px] text-text-ghost uppercase tracking-wider mb-1.5">
          Data Source
        </label>
        <select
          value={sourceId}
          onChange={(e) => onSourceChange(parseInt(e.target.value, 10))}
          className={cn(
            "w-full rounded-lg px-3 py-2 text-sm",
            "bg-surface-base border border-border-default",
            "text-text-primary",
            "focus:outline-none focus:border-success focus:ring-1 focus:ring-success/40",
          )}
        >
          <option value={0}>Select source...</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.source_name}
            </option>
          ))}
        </select>
      </div>

      {/* Source Cohort */}
      <div>
        <label className="block text-[10px] text-text-ghost uppercase tracking-wider mb-1.5">
          Source Cohort
        </label>
        {cohortsLoading ? (
          <div className="flex items-center gap-2 text-xs text-text-ghost py-2">
            <Loader2 size={12} className="animate-spin" />
            Loading...
          </div>
        ) : (
          <select
            value={sourceCohortId}
            onChange={(e) =>
              setSourceCohortId(parseInt(e.target.value, 10))
            }
            className={cn(
              "w-full rounded-lg px-3 py-2 text-sm",
              "bg-surface-base border border-border-default",
              "text-text-primary",
              "focus:outline-none focus:border-success focus:ring-1 focus:ring-success/40",
            )}
          >
            <option value={0}>Select source cohort...</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {sourceCohortId > 0 && sourceId > 0 && (
          <GenerationStatusBanner
            profile={sourceProfile}
            isLoading={sourceProfileLoading}
            cohortDefinitionId={sourceCohortId}
            sourceId={sourceId}
          />
        )}
      </div>

      {/* Target Cohort */}
      <div>
        <label className="block text-[10px] text-text-ghost uppercase tracking-wider mb-1.5">
          Target Cohort
        </label>
        {cohortsLoading ? (
          <div className="flex items-center gap-2 text-xs text-text-ghost py-2">
            <Loader2 size={12} className="animate-spin" />
            Loading...
          </div>
        ) : (
          <select
            value={targetCohortId}
            onChange={(e) =>
              setTargetCohortId(parseInt(e.target.value, 10))
            }
            className={cn(
              "w-full rounded-lg px-3 py-2 text-sm",
              "bg-surface-base border border-border-default",
              "text-text-primary",
              "focus:outline-none focus:border-success focus:ring-1 focus:ring-success/40",
            )}
          >
            <option value={0}>Select target cohort...</option>
            {cohorts
              .filter((c) => c.id !== sourceCohortId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        )}
        {targetCohortId > 0 && sourceId > 0 && (
          <GenerationStatusBanner
            profile={targetProfile}
            isLoading={targetProfileLoading}
            cohortDefinitionId={targetCohortId}
            sourceId={sourceId}
          />
        )}
      </div>

      {/* Compare Button */}
      <button
        type="submit"
        disabled={isComparing || !bothGenerated || sourceId <= 0}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
          "bg-primary text-primary-foreground hover:bg-primary-light",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {isComparing ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <GitCompareArrows size={16} />
        )}
        Compare Profiles
      </button>

      {/* Cross-Cohort Search Button */}
      {hasComparisonResult &&
        currentSelectionKey !== null &&
        comparedSelectionKey === currentSelectionKey && (
        <button
          type="button"
          onClick={handleCrossSearch}
          disabled={isSearching}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
            "bg-success/10 text-success border border-success/30 hover:bg-success/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {isSearching ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
          Find Matching Patients
        </button>
      )}
    </form>
  );
}
