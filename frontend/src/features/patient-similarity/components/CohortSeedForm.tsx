import { useState, useEffect, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSourceStore } from "@/stores/sourceStore";
import { useCohortDefinitions } from "@/features/cohort-definitions/hooks/useCohortDefinitions";
import {
  useSimilarityDimensions,
  useCohortProfile,
} from "../hooks/usePatientSimilarity";
import { CohortCentroidRadar } from "./CohortCentroidRadar";
import { GenerationStatusBanner } from "./GenerationStatusBanner";
import type { CohortSimilaritySearchParams } from "../types/patientSimilarity";
import { buildSimilarityFilters } from "../utils/similarityFilters";

interface CohortSeedFormProps {
  onSearch: (params: CohortSimilaritySearchParams) => void;
  isLoading: boolean;
  sourceId: number;
  onSourceChange: (sourceId: number) => void;
}

export function CohortSeedForm({
  onSearch,
  isLoading,
  sourceId,
  onSourceChange,
}: CohortSeedFormProps) {
  const { sources } = useSourceStore();
  const { data: dimensions } = useSimilarityDimensions();
  const [selectedCohortId, setSelectedCohortId] = useState<number>(0);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [gender, setGender] = useState("");

  const { data: cohortsData, isLoading: cohortsLoading } =
    useCohortDefinitions({ limit: 500 });
  const cohorts = cohortsData?.items ?? [];

  const {
    data: cohortProfile,
    isLoading: profileLoading,
  } = useCohortProfile(
    selectedCohortId > 0 ? selectedCohortId : undefined,
    sourceId,
  );

  useEffect(() => {
    if (!dimensions) return;
    const defaults: Record<string, number> = {};
    for (const dim of dimensions) {
      defaults[dim.key] = dim.default_weight;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWeights(defaults);
  }, [dimensions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCohortId(0);
  }, [sourceId]);

  const handleWeightChange = useCallback((key: string, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isGenerated = cohortProfile?.generated === true;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCohortId <= 0 || sourceId <= 0 || !isGenerated) return;
    const filters = buildSimilarityFilters(ageMin, ageMax, gender);

    onSearch({
      cohort_definition_id: selectedCohortId,
      source_id: sourceId,
      weights: Object.keys(weights).length > 0 ? weights : undefined,
      filters,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
            "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/15",
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

      {/* Cohort Selector */}
      <div>
        <label className="block text-[10px] text-text-ghost uppercase tracking-wider mb-1.5">
          Seed Cohort
        </label>
        {cohortsLoading ? (
          <div className="flex items-center gap-2 text-xs text-text-ghost py-2">
            <Loader2 size={12} className="animate-spin" />
            Loading cohorts...
          </div>
        ) : (
          <select
            value={selectedCohortId}
            onChange={(e) =>
              setSelectedCohortId(parseInt(e.target.value, 10))
            }
            className={cn(
              "w-full rounded-lg px-3 py-2 text-sm",
              "bg-surface-base border border-border-default",
              "text-text-primary",
              "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/15",
            )}
          >
            <option value={0}>Select a cohort...</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {/* Generation Status */}
        {selectedCohortId > 0 && sourceId > 0 && (
          <GenerationStatusBanner
            profile={cohortProfile}
            isLoading={profileLoading}
            cohortDefinitionId={selectedCohortId}
            sourceId={sourceId}
          />
        )}
      </div>

      {/* Radar Chart */}
      {cohortProfile?.generated && (
        <CohortCentroidRadar profile={cohortProfile} />
      )}

      {/* Dimension Weight Sliders */}
      {dimensions && dimensions.length > 0 && (
        <div>
          <label className="block text-[10px] text-text-ghost uppercase tracking-wider mb-2">
            Dimension Weights
          </label>
          <div className="space-y-3">
            {dimensions
              .filter((d) => d.is_active)
              .map((dim) => (
                <div key={dim.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary">{dim.name}</span>
                    <span className="text-[10px] font-medium text-success tabular-nums">
                      {(weights[dim.key] ?? dim.default_weight).toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.5}
                    value={weights[dim.key] ?? dim.default_weight}
                    onChange={(e) =>
                      handleWeightChange(dim.key, parseFloat(e.target.value))
                    }
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-surface-elevated accent-success"
                  />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <label className="block text-[10px] text-text-ghost uppercase tracking-wider">
          Filters (optional)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={ageMin}
            onChange={(e) => setAgeMin(e.target.value)}
            placeholder="Min age"
            className={cn(
              "w-1/2 rounded-lg px-3 py-1.5 text-xs",
              "bg-surface-base border border-border-default",
              "text-text-primary placeholder:text-text-ghost",
              "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/15",
            )}
          />
          <span className="text-text-ghost text-xs">-</span>
          <input
            type="text"
            value={ageMax}
            onChange={(e) => setAgeMax(e.target.value)}
            placeholder="Max age"
            className={cn(
              "w-1/2 rounded-lg px-3 py-1.5 text-xs",
              "bg-surface-base border border-border-default",
              "text-text-primary placeholder:text-text-ghost",
              "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/15",
            )}
          />
        </div>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className={cn(
            "w-full rounded-lg px-3 py-1.5 text-xs",
            "bg-surface-base border border-border-default",
            "text-text-primary",
            "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/15",
          )}
        >
          <option value="">Any gender</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </select>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={
          isLoading || selectedCohortId <= 0 || sourceId <= 0 || !isGenerated
        }
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
          "bg-primary text-white hover:bg-[#B22040]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Search size={16} />
        )}
        Find Similar Patients
      </button>
    </form>
  );
}
