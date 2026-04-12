import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchMappingSuggestions, acceptMappingSuggestion } from "../../../api/dqHistoryApi";
import type { MappingSuggestion, UnmappedCode } from "../../../types/ares";

interface MappingSuggestionPanelProps {
  code: UnmappedCode;
  sourceId: number;
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "bg-success" :
    pct >= 60 ? "bg-accent" :
    pct >= 40 ? "bg-amber-500" :
    "bg-primary";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-surface-accent">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-text-muted">{pct}%</span>
    </div>
  );
}

export default function MappingSuggestionPanel({ code, sourceId }: MappingSuggestionPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [acceptedId, setAcceptedId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: suggestionData, isLoading, error } = useQuery({
    queryKey: ["ares", "mapping-suggestions", sourceId, code.id],
    queryFn: () => fetchMappingSuggestions(sourceId, code.id),
    enabled: expanded,
    staleTime: 5 * 60 * 1000,
  });

  const acceptMutation = useMutation({
    mutationFn: (suggestion: MappingSuggestion) =>
      acceptMappingSuggestion(sourceId, code.id, {
        target_concept_id: suggestion.concept_id,
        confidence_score: suggestion.confidence_score,
      }),
    onSuccess: (_data, suggestion) => {
      setAcceptedId(suggestion.concept_id);
      queryClient.invalidateQueries({
        queryKey: ["ares", "unmapped-codes", "progress"],
      });
    },
  });

  return (
    <div className="border-t border-border-subtle">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-success hover:bg-surface-raised"
      >
        <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>
          {"\u25B6"}
        </span>
        AI Mapping Suggestions
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {isLoading && (
            <p className="text-xs text-text-ghost">Generating suggestions via pgvector similarity...</p>
          )}

          {error && (
            <p className="text-xs text-primary">
              Failed to load suggestions. The AI service or concept embeddings may not be available.
            </p>
          )}

          {suggestionData && suggestionData.length === 0 && (
            <p className="text-xs text-text-ghost">
              No suggestions available. Concept embeddings may not be loaded.
            </p>
          )}

          {suggestionData && suggestionData.length > 0 && (
            <div className="space-y-2">
              {suggestionData.map((suggestion: MappingSuggestion) => {
                const isAccepted = acceptedId === suggestion.concept_id;

                return (
                  <div
                    key={suggestion.concept_id}
                    className={`flex items-center justify-between rounded-lg border p-2 ${
                      isAccepted
                        ? "border-success/50 bg-success/5"
                        : "border-border-subtle bg-surface-base"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white">
                          {suggestion.concept_name}
                        </span>
                        <span className="rounded bg-surface-accent px-1.5 py-0.5 text-[10px] text-text-muted">
                          {suggestion.vocabulary_id}
                        </span>
                        <span className="rounded bg-surface-accent px-1.5 py-0.5 text-[10px] text-text-muted">
                          {suggestion.domain_id}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="text-[10px] text-text-ghost">
                          ID: {suggestion.concept_id}
                        </span>
                        <ConfidenceBar score={suggestion.confidence_score} />
                      </div>
                    </div>

                    <div className="ml-3 flex items-center gap-1">
                      {isAccepted ? (
                        <span className="rounded-full bg-success/20 px-3 py-1 text-[10px] font-medium text-success">
                          Accepted
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => acceptMutation.mutate(suggestion)}
                            disabled={acceptMutation.isPending || acceptedId !== null}
                            className="rounded border border-success/30 px-2 py-1 text-[10px] text-success hover:bg-success/10 disabled:opacity-30"
                          >
                            {acceptMutation.isPending ? "..." : "Accept"}
                          </button>
                          <button
                            type="button"
                            disabled={acceptedId !== null}
                            className="rounded border border-border-default px-2 py-1 text-[10px] text-text-ghost hover:text-text-muted disabled:opacity-30"
                          >
                            Skip
                          </button>
                        </>
                      )}
                    </div>
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
