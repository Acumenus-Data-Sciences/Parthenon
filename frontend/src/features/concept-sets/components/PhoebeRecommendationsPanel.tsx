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
  onAddAll?: (conceptIds: number[]) => void;
  isAddingConcept?: boolean;
  defaultExpanded?: boolean;
}

export function PhoebeRecommendationsPanel({
  recommendations,
  isLoading,
  isError,
  existingConceptIds,
  onAddConcept,
  onAddAll,
  isAddingConcept,
  defaultExpanded = false,
}: PhoebeRecommendationsPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const notYetAdded = recommendations.filter(
    (rec) => !existingConceptIds.has(rec.concept_id),
  );

  return (
    <div className="rounded-lg border border-border-default bg-surface-overlay">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors rounded-lg"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-text-muted" />
        ) : (
          <ChevronRight size={14} className="text-text-muted" />
        )}
        <Sparkles size={14} className="text-accent" />
        <span>Phoebe Recommendations</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent">
          <Sparkles className="h-3 w-3" />
          Powered by Phoebe
        </span>
        {!isLoading && recommendations.length > 0 && (
          <span className="ml-auto inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
            {recommendations.length}
          </span>
        )}
      </button>

      {/* Add All button — shown in header when expanded and there are unadded recommendations */}
      {expanded && onAddAll && notYetAdded.length > 1 && (
        <div className="flex justify-end border-b border-border-default bg-surface-base px-3 py-1.5">
          <button
            type="button"
            onClick={() => onAddAll(notYetAdded.map((r) => r.concept_id))}
            disabled={isAddingConcept}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              "text-accent hover:bg-accent/10",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <Plus size={12} />
            Add All ({notYetAdded.length})
          </button>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border-default">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin text-text-muted" />
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-8 text-xs text-text-ghost">
              Recommendations unavailable
            </div>
          ) : recommendations.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-xs text-text-ghost">
              No recommendations found
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-border-default">
              {recommendations.map((rec) => {
                const alreadyAdded = existingConceptIds.has(rec.concept_id);

                return (
                  <div
                    key={rec.concept_id}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">
                        {rec.concept_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-['IBM_Plex_Mono',monospace] text-xs tabular-nums text-accent">
                          {rec.concept_id}
                        </span>
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-success/15 text-success">
                          {rec.score.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {alreadyAdded ? (
                      <span className="text-[10px] text-text-ghost shrink-0">
                        Added
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAddConcept(rec.concept_id)}
                        disabled={isAddingConcept}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                          "text-text-muted hover:text-success hover:bg-success/10",
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
