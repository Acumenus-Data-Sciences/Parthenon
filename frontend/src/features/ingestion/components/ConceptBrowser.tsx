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
      <div className="px-4 py-3 border-b border-[#232328]">
        <h3 className="text-sm font-semibold text-[#F0EDE8] mb-2">
          Concept Browser
        </h3>

        {/* Search input */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search concepts..."
            className={cn(
              "w-full rounded-lg pl-9 pr-8 py-2 text-sm",
              "bg-[#0E0E11] border border-[#232328]",
              "text-[#F0EDE8] placeholder:text-[#5A5650]",
              "focus:outline-none focus:border-[#9B1B30] focus:ring-1 focus:ring-[#9B1B30]/40",
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
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5650] hover:text-[#C5C0B8] transition-colors"
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
            <Loader2 size={18} className="animate-spin text-[#8A857D]" />
          </div>
        ) : !debouncedQuery || debouncedQuery.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Search size={24} className="text-[#323238] mb-3" />
            <p className="text-xs text-[#5A5650]">
              Type at least 2 characters to search OMOP concepts
            </p>
          </div>
        ) : !results || results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <p className="text-xs text-[#5A5650]">
              No concepts found for &ldquo;{debouncedQuery}&rdquo;
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#232328]">
            {results.map((concept) => {
              const isStandard = concept.standard_concept === "S";

              return (
                <button
                  key={concept.concept_id}
                  type="button"
                  onClick={() =>
                    onSelectConcept(concept.concept_id, concept.concept_name)
                  }
                  className="flex flex-col gap-1 w-full px-4 py-3 text-left hover:bg-[#1C1C20] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-['IBM_Plex_Mono',monospace] text-xs tabular-nums",
                        isStandard ? "text-[#C9A227]" : "text-[#8A857D]",
                      )}
                    >
                      {concept.concept_id}
                    </span>
                    {isStandard && (
                      <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-[#2DD4BF]/15 text-[#2DD4BF]">
                        S
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#F0EDE8] leading-snug">
                    {concept.concept_name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#60A5FA]/15 text-[#60A5FA]">
                      {concept.domain_id}
                    </span>
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#C9A227]/15 text-[#C9A227]">
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
