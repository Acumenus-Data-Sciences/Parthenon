import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import apiClient from "@/lib/api-client";

interface ConceptResult {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  standard_concept: string | null;
}

interface ConceptBrowserProps {
  onSelectConcept: (conceptId: number, conceptName: string) => void;
}

export function ConceptBrowser({ onSelectConcept }: ConceptBrowserProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceTimer) clearTimeout(debounceTimer);
      const timer = setTimeout(() => {
        setDebouncedQuery(value);
      }, 350);
      setDebounceTimer(timer);
    },
    [debounceTimer],
  );

  const {
    data: results,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["vocabulary-search", debouncedQuery],
    queryFn: async () => {
      const { data } = await apiClient.get<ConceptResult[]>(
        "/vocabulary/search",
        { params: { q: debouncedQuery } },
      );
      return data;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-default">
        <h3 className="text-sm font-semibold text-text-primary mb-2">
          Concept Browser
        </h3>

        {/* Search input */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search concepts..."
            className={cn(
              "w-full rounded-lg pl-9 pr-8 py-2 text-sm",
              "bg-surface-base border border-border-default",
              "text-text-primary placeholder:text-text-ghost",
              "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40",
              "transition-colors",
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setDebouncedQuery("");
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-ghost hover:text-text-secondary transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isLoading || isFetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin text-text-muted" />
          </div>
        ) : !debouncedQuery || debouncedQuery.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Search size={24} className="text-text-ghost mb-3" />
            <p className="text-xs text-text-ghost">
              Type at least 2 characters to search OMOP concepts
            </p>
          </div>
        ) : !results || results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <p className="text-xs text-text-ghost">
              No concepts found for &ldquo;{debouncedQuery}&rdquo;
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-default">
            {results.map((concept) => {
              const isStandard = concept.standard_concept === "S";

              return (
                <button
                  key={concept.concept_id}
                  type="button"
                  onClick={() =>
                    onSelectConcept(concept.concept_id, concept.concept_name)
                  }
                  className="flex flex-col gap-1 w-full px-4 py-3 text-left hover:bg-surface-overlay transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-['IBM_Plex_Mono',monospace] text-xs tabular-nums",
                        isStandard ? "text-accent" : "text-text-muted",
                      )}
                    >
                      {concept.concept_id}
                    </span>
                    {isStandard && (
                      <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-success/15 text-success">
                        S
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-primary leading-snug">
                    {concept.concept_name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-info/15 text-info">
                      {concept.domain_id}
                    </span>
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent/15 text-accent">
                      {concept.vocabulary_id}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
