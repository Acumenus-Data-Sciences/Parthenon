import { useState } from "react";
import { Sparkles, ChevronRight, ChevronDown, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HecatePhoebeRecommendation } from "@/features/vocabulary/api/hecateApi";

interface PhoebeRecommendationsPanelProps {
  recommendations: HecatePhoebeRecommendation[];
  isLoading: boolean;
  isError: boolean;
  existingConceptIds: Set<number>;
  onAddConcept: (conceptId: number) => void;
  isAddingConcept?: boolean;
  defaultExpanded?: boolean;
}

export function PhoebeRecommendationsPanel({
  recommendations,
  isLoading,
  isError,
  existingConceptIds,
  onAddConcept,
  isAddingConcept,
  defaultExpanded = false,
}: PhoebeRecommendationsPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-lg border border-[#232328] bg-[#1A1A1E]">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-[#F0EDE8] hover:bg-[#1C1C20] transition-colors rounded-lg"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-[#8A857D]" />
        ) : (
          <ChevronRight size={14} className="text-[#8A857D]" />
        )}
        <Sparkles size={14} className="text-[#C9A227]" />
        <span>Phoebe Recommendations</span>
        {!isLoading && recommendations.length > 0 && (
          <span className="ml-auto inline-flex items-center rounded-full bg-[#C9A227]/15 px-2 py-0.5 text-xs font-medium text-[#C9A227]">
            {recommendations.length}
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[#232328]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin text-[#8A857D]" />
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-8 text-xs text-[#5A5650]">
              Recommendations unavailable
            </div>
          ) : recommendations.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-xs text-[#5A5650]">
              No recommendations found
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-[#232328]">
              {recommendations.map((rec) => {
                const alreadyAdded = existingConceptIds.has(rec.concept_id);

                return (
                  <div
                    key={rec.concept_id}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#F0EDE8] truncate">
                        {rec.concept_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-['IBM_Plex_Mono',monospace] text-xs tabular-nums text-[#C9A227]">
                          {rec.concept_id}
                        </span>
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/15 text-[#2DD4BF]">
                          {rec.score.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {alreadyAdded ? (
                      <span className="text-[10px] text-[#5A5650] shrink-0">
                        Added
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAddConcept(rec.concept_id)}
                        disabled={isAddingConcept}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                          "text-[#8A857D] hover:text-[#2DD4BF] hover:bg-[#2DD4BF]/10",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                        )}
                        title="Add to concept set"
                      >
                        <Plus size={12} />
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
