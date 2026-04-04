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
}

export function CohortCompareForm({
  onCompare,
  onCrossSearch,
  isComparing,
  isSearching,
  hasComparisonResult,
}: CohortCompareFormProps) {
  const { activeSourceId, defaultSourceId, sources } = useSourceStore();

  const [sourceId, setSourceId] = useState<number>(
    activeSourceId ?? defaultSourceId ?? 0,
  );
  const [sourceCohortId, setSourceCohortId] = useState<number>(0);
  const [targetCohortId, setTargetCohortId] = useState<number>(0);

  const { data: cohortsData, isLoading: cohortsLoading } =
    useCohortDefinitions({ limit: 100 });
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
    if (activeSourceId) setSourceId(activeSourceId);
  }, [activeSourceId]);

  useEffect(() => {
    setSourceCohortId(0);
    setTargetCohortId(0);
  }, [sourceId]);

  const bothGenerated =
    sourceProfile?.generated === true && targetProfile?.generated === true;

  const handleCompare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bothGenerated || sourceId <= 0) return;

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
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
          Data Source
        </label>
        <select
          value={sourceId}
          onChange={(e) => setSourceId(parseInt(e.target.value, 10))}
          className={cn(
            "w-full rounded-lg px-3 py-2 text-sm",
            "bg-[#0E0E11] border border-[#232328]",
            "text-[#F0EDE8]",
            "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
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
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
          Source Cohort
        </label>
        {cohortsLoading ? (
          <div className="flex items-center gap-2 text-xs text-[#5A5650] py-2">
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
              "bg-[#0E0E11] border border-[#232328]",
              "text-[#F0EDE8]",
              "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
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
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
          Target Cohort
        </label>
        {cohortsLoading ? (
          <div className="flex items-center gap-2 text-xs text-[#5A5650] py-2">
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
              "bg-[#0E0E11] border border-[#232328]",
              "text-[#F0EDE8]",
              "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
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
          "bg-[#9B1B30] text-white hover:bg-[#B22040]",
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
      {hasComparisonResult && (
        <button
          type="button"
          onClick={handleCrossSearch}
          disabled={isSearching}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
            "bg-[#2DD4BF]/10 text-[#2DD4BF] border border-[#2DD4BF]/30 hover:bg-[#2DD4BF]/20",
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
