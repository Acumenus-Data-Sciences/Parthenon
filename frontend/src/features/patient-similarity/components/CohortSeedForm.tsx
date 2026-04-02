import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCohortDefinitions } from "@/features/cohort-definitions/hooks/useCohortDefinitions";
import type { CohortSimilaritySearchParams } from "../types/patientSimilarity";

interface CohortSeedFormProps {
  onSearch: (params: CohortSimilaritySearchParams) => void;
  sourceId: number;
  isLoading: boolean;
}

type Strategy = "centroid" | "exemplar";

export function CohortSeedForm({
  onSearch,
  sourceId,
  isLoading,
}: CohortSeedFormProps) {
  const [selectedCohortId, setSelectedCohortId] = useState<number>(0);
  const [strategy, setStrategy] = useState<Strategy>("centroid");

  const { data: cohortsData, isLoading: cohortsLoading } =
    useCohortDefinitions({ limit: 100 });

  const cohorts = cohortsData?.data ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCohortId <= 0 || sourceId <= 0) return;

    onSearch({
      cohort_definition_id: selectedCohortId,
      source_id: sourceId,
      strategy,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Cohort Selector */}
      <div>
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
          Seed Cohort
        </label>
        {cohortsLoading ? (
          <div className="flex items-center gap-2 text-xs text-[#5A5650] py-2">
            <Loader2 size={12} className="animate-spin" />
            Loading cohorts...
          </div>
        ) : (
          <select
            value={selectedCohortId}
            onChange={(e) => setSelectedCohortId(parseInt(e.target.value, 10))}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-sm",
              "bg-[#0E0E11] border border-[#232328]",
              "text-[#F0EDE8]",
              "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
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
      </div>

      {/* Strategy Toggle */}
      <div>
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-2">
          Search Strategy
        </label>
        <div className="flex rounded-lg border border-[#232328] overflow-hidden">
          {(["centroid", "exemplar"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStrategy(s)}
              className={cn(
                "flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors",
                strategy === s
                  ? "bg-[#2DD4BF]/10 text-[#2DD4BF] border-r border-[#232328]"
                  : "bg-[#0E0E11] text-[#5A5650] hover:text-[#C5C0B8] border-r border-[#232328]",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-[#5A5650]">
          {strategy === "centroid"
            ? "Average features across all cohort members as seed"
            : "Use the most representative cohort member as seed"}
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || selectedCohortId <= 0 || sourceId <= 0}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
          "bg-[#9B1B30] text-white hover:bg-[#B22040]",
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
