import { useState } from "react";
import { Search, Loader2, X, Filter, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useVocabularySearch,
  useDomains,
  useVocabularies,
} from "../hooks/useVocabularySearch";

interface VocabularySearchPanelProps {
  selectedConceptId: number | null;
  onSelectConcept: (id: number) => void;
}

export function VocabularySearchPanel({
  selectedConceptId,
  onSelectConcept,
}: VocabularySearchPanelProps) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [vocabFilter, setVocabFilter] = useState<string>("");
  const [standardOnly, setStandardOnly] = useState(false);

  const { data: domains } = useDomains();
  const { data: vocabularies } = useVocabularies();

  const {
    data: results,
    total,
    isLoading,
    isFetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useVocabularySearch(query, {
    domain: domainFilter || undefined,
    vocabulary: vocabFilter || undefined,
    standard: standardOnly || undefined,
  });

  const clearFilters = () => {
    setDomainFilter("");
    setVocabFilter("");
    setStandardOnly(false);
  };

  const hasActiveFilters = domainFilter || vocabFilter || standardOnly;

  return (
    <div className="flex flex-col h-full border-r border-[#232328]">
      {/* Search Header */}
      <div className="px-4 py-4 border-b border-[#232328] space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search concepts..."
            className={cn(
              "w-full rounded-lg pl-9 pr-8 py-2.5 text-sm",
              "bg-[#0E0E11] border border-[#232328]",
              "text-[#F0EDE8] placeholder:text-[#5A5650]",
              "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
              "transition-colors",
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5650] hover:text-[#C5C0B8] transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Toggle + Standard Toggle (same row) */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs transition-colors",
              hasActiveFilters
                ? "text-[#2DD4BF]"
                : "text-[#8A857D] hover:text-[#C5C0B8]",
            )}
          >
            <Filter size={12} />
            Filters
            {hasActiveFilters && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#2DD4BF]/15 text-[9px] font-bold text-[#2DD4BF]">
                {[domainFilter, vocabFilter, standardOnly].filter(Boolean).length}
              </span>
            )}
            <ChevronDown
              size={12}
              className={cn(
                "transition-transform",
                showFilters && "rotate-180",
              )}
            />
          </button>

          {/* Standard Concepts Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <span className={cn("text-xs transition-colors", standardOnly ? "text-[#2DD4BF]" : "text-[#5A5650]")}>
              Standard
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={standardOnly}
              onClick={() => setStandardOnly(!standardOnly)}
              className={cn(
                "relative w-8 h-[18px] rounded-full transition-colors",
                standardOnly ? "bg-[#2DD4BF]" : "bg-[#323238]",
              )}
            >
              <div
                className={cn(
                  "absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform",
                  standardOnly && "translate-x-[14px]",
                )}
              />
            </button>
          </label>
        </div>

        {/* Filter Dropdowns */}
        {showFilters && (
          <div className="space-y-2 pt-1">
            {/* Domain Filter */}
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-sm appearance-none",
                "bg-[#0E0E11] border border-[#232328]",
                "text-[#F0EDE8]",
                "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
              )}
            >
              <option value="">All Domains</option>
              {domains?.map((d) => (
                <option key={d.domain_id} value={d.domain_id}>
                  {d.domain_name}
                </option>
              ))}
            </select>

            {/* Vocabulary Filter */}
            <select
              value={vocabFilter}
              onChange={(e) => setVocabFilter(e.target.value)}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-sm appearance-none",
                "bg-[#0E0E11] border border-[#232328]",
                "text-[#F0EDE8]",
                "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
              )}
            >
              <option value="">All Vocabularies</option>
              {vocabularies?.map((v) => (
                <option key={v.vocabulary_id} value={v.vocabulary_id}>
                  {v.vocabulary_name}
                </option>
              ))}
            </select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-[#E85A6B] hover:text-[#F06B7F] transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && !isFetchingNextPage ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin text-[#8A857D]" />
          </div>
        ) : !query || query.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Search size={28} className="text-[#323238] mb-3" />
            <p className="text-sm text-[#8A857D]">Search the OMOP Vocabulary</p>
            <p className="mt-1 text-xs text-[#5A5650]">
              Type at least 2 characters to search concepts by name, code, or ID
            </p>
          </div>
        ) : !results || results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <p className="text-sm text-[#8A857D]">
              No concepts found for &ldquo;{query}&rdquo;
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-2 text-xs text-[#2DD4BF] hover:text-[#26B8A5] transition-colors"
              >
                Try clearing filters
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Result count */}
            <div className="px-4 py-2 border-b border-[#232328]">
              <p className="text-[10px] text-[#5A5650]">
                Showing {results.length} of {total.toLocaleString()} results
              </p>
            </div>

            <div className="divide-y divide-[#232328]">
              {results.map((concept) => {
                const isStandard = concept.standard_concept === "S";
                const isSelected = concept.concept_id === selectedConceptId;

                return (
                  <button
                    key={concept.concept_id}
                    type="button"
                    onClick={() => onSelectConcept(concept.concept_id)}
                    className={cn(
                      "flex flex-col gap-1 w-full px-4 py-3 text-left transition-colors",
                      isSelected
                        ? "bg-[#2DD4BF]/10 border-l-2 border-[#2DD4BF]"
                        : "hover:bg-[#1C1C20] border-l-2 border-transparent",
                    )}
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
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#8A857D]/15 text-[#8A857D]">
                        {concept.concept_class_id}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Load More */}
            {hasNextPage && (
              <div className="px-4 py-3 border-t border-[#232328]">
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className={cn(
                    "w-full px-3 py-2 text-xs rounded-lg border border-[#232328] transition-colors",
                    "text-[#8A857D] hover:text-[#F0EDE8] hover:border-[#2DD4BF]/30",
                    isFetchingNextPage && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {isFetchingNextPage ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={12} className="animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    "Load more results"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
