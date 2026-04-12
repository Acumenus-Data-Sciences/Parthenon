import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Loader2, X, Filter, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useVocabularySearch,
  useConceptSuggest,
  useDomains,
  useVocabularies,
} from "../hooks/useVocabularySearch";


interface VocabularySearchPanelProps {
  mode?: 'browse' | 'build';
  selectedConceptId?: number | null;
  onSelectConcept?: (id: number) => void;

  // Build mode: concept set integration
  conceptSetItemIds?: Set<number>;
  onAddToSet?: (conceptId: number) => void;

  // Context carry-over: pre-fill search from URL params
  initialQuery?: string;
  initialFilters?: {
    domain?: string;
    vocabulary?: string;
    standard?: boolean;
  };
}

/** Render HTML string with <mark> highlights safely (only allow <mark> tags) */
function HighlightedText({ html, fallback }: { html: string | undefined; fallback: string }) {
  if (!html) return <>{fallback}</>;
  // Sanitize: only allow <mark> and </mark>
  const safe = html.replace(/<(?!\/?mark>)[^>]*>/g, "");
  return <span dangerouslySetInnerHTML={{ __html: safe }} />;
}

export function VocabularySearchPanel({
  mode,
  selectedConceptId,
  onSelectConcept,
  conceptSetItemIds,
  onAddToSet,
  initialQuery,
  initialFilters,
}: VocabularySearchPanelProps) {
  const resolvedMode = mode ?? 'browse';
  const [query, setQuery] = useState(initialQuery ?? "");
  const [showFilters, setShowFilters] = useState(false);
  const [domainFilter, setDomainFilter] = useState<string>(initialFilters?.domain ?? "");
  const [vocabFilter, setVocabFilter] = useState<string>(initialFilters?.vocabulary ?? "");
  const [conceptClassFilter, setConceptClassFilter] = useState<string>("");
  const [standardOnly, setStandardOnly] = useState(initialFilters?.standard ?? false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { data: domains } = useDomains();
  const { data: vocabularies } = useVocabularies();
  const { data: suggestions } = useConceptSuggest(query);

  const {
    data: results,
    total,
    facets,
    highlights,
    engine,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useVocabularySearch(query, {
    domain: domainFilter || undefined,
    vocabulary: vocabFilter || undefined,
    concept_class: conceptClassFilter || undefined,
    standard: standardOnly || undefined,
  });

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset suggestion index when suggestions change
  useEffect(() => {
    setSelectedSuggestionIdx(-1);
  }, [suggestions]);

  const applySuggestion = useCallback((text: string) => {
    setQuery(text);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || !suggestions?.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestionIdx((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestionIdx((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1,
      );
    } else if (e.key === "Enter" && selectedSuggestionIdx >= 0) {
      e.preventDefault();
      applySuggestion(suggestions[selectedSuggestionIdx].concept_name);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const clearFilters = () => {
    setDomainFilter("");
    setVocabFilter("");
    setConceptClassFilter("");
    setStandardOnly(false);
  };

  const hasActiveFilters = domainFilter || vocabFilter || conceptClassFilter || standardOnly;
  const activeFilterCount = [domainFilter, vocabFilter, conceptClassFilter, standardOnly].filter(Boolean).length;

  // Get highlight for a concept's field (Solr returns keyed by concept_id)
  const getHighlight = (conceptId: number, field: string): string | undefined => {
    const h = highlights?.[String(conceptId)];
    if (!h) return undefined;
    return h[field]?.[0];
  };

  // Build concept class options from facets
  const conceptClassOptions = facets?.concept_class_id
    ? Object.entries(facets.concept_class_id).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="flex flex-col h-full border-r border-[#232328]">
      {/* Search Header */}
      <div className="px-4 py-4 border-b border-[#232328] space-y-3">
        {/* Search Input + Autocomplete */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => query.length >= 2 && setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
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
              onClick={() => {
                setQuery("");
                setShowSuggestions(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5650] hover:text-[#C5C0B8] transition-colors"
            >
              <X size={14} />
            </button>
          )}

          {/* Autocomplete Dropdown */}
          {showSuggestions && suggestions && suggestions.length > 0 && query.length >= 2 && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 top-full mt-1 w-full rounded-lg border border-[#232328] bg-[#16161A] shadow-xl overflow-hidden"
            >
              {suggestions.slice(0, 8).map((s, i) => (
                <button
                  key={s.concept_name}
                  type="button"
                  onClick={() => applySuggestion(s.concept_name)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors",
                    i === selectedSuggestionIdx
                      ? "bg-[#2DD4BF]/10 text-[#F0EDE8]"
                      : "text-[#C5C0B8] hover:bg-[#1C1C20]",
                  )}
                >
                  <Search size={11} className="shrink-0 text-[#5A5650]" />
                  <span className="truncate">{s.concept_name}</span>
                </button>
              ))}
            </div>
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
                {activeFilterCount}
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
              {domains?.map((d) => {
                const count = facets?.domain_id?.[d.domain_id];
                return (
                  <option key={d.domain_id} value={d.domain_id}>
                    {d.domain_name}{count != null ? ` (${count.toLocaleString()})` : ""}
                  </option>
                );
              })}
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
              {vocabularies?.map((v) => {
                const count = facets?.vocabulary_id?.[v.vocabulary_id];
                return (
                  <option key={v.vocabulary_id} value={v.vocabulary_id}>
                    {v.vocabulary_name}{count != null ? ` (${count.toLocaleString()})` : ""}
                  </option>
                );
              })}
            </select>

            {/* Concept Class Filter */}
            <select
              value={conceptClassFilter}
              onChange={(e) => setConceptClassFilter(e.target.value)}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-sm appearance-none",
                "bg-[#0E0E11] border border-[#232328]",
                "text-[#F0EDE8]",
                "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
              )}
            >
              <option value="">All Concept Classes</option>
              {conceptClassOptions.map(([name, count]) => (
                <option key={name} value={name}>
                  {name} ({count.toLocaleString()})
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
            {/* Result count + engine indicator */}
            <div className="px-4 py-2 border-b border-[#232328] flex items-center justify-between">
              <p className="text-[10px] text-[#5A5650]">
                Showing {results.length} of {total.toLocaleString()} results
              </p>
              {engine && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium",
                    engine === "solr"
                      ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                      : "bg-[#8A857D]/10 text-[#8A857D]",
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      engine === "solr" ? "bg-[#2DD4BF]" : "bg-[#8A857D]",
                    )}
                  />
                  {engine === "solr" ? "Solr" : "PG"}
                </span>
              )}
            </div>

            {/* Faceted filter chips (Solr-powered) — domain, vocabulary, concept class */}
            {facets && Object.keys(facets).length > 0 && !showFilters && (
              <div className="px-4 py-1.5 border-b border-[#232328] flex flex-wrap gap-1">
                {/* Domain chips */}
                {facets.domain_id && Object.entries(facets.domain_id).slice(0, 4).map(([name, count]) => (
                  <button
                    key={`d-${name}`}
                    type="button"
                    onClick={() => {
                      setDomainFilter(domainFilter === name ? "" : name);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] transition-colors",
                      domainFilter === name
                        ? "bg-[#60A5FA]/20 text-[#60A5FA]"
                        : "bg-[#60A5FA]/10 text-[#60A5FA]/70 hover:text-[#60A5FA]",
                    )}
                  >
                    {name}
                    <span className="text-[#60A5FA]/50">{count.toLocaleString()}</span>
                  </button>
                ))}
                {/* Vocabulary chips */}
                {facets.vocabulary_id && Object.entries(facets.vocabulary_id).slice(0, 3).map(([name, count]) => (
                  <button
                    key={`v-${name}`}
                    type="button"
                    onClick={() => {
                      setVocabFilter(vocabFilter === name ? "" : name);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] transition-colors",
                      vocabFilter === name
                        ? "bg-[#C9A227]/20 text-[#C9A227]"
                        : "bg-[#C9A227]/10 text-[#C9A227]/70 hover:text-[#C9A227]",
                    )}
                  >
                    {name}
                    <span className="text-[#C9A227]/50">{count.toLocaleString()}</span>
                  </button>
                ))}
                {/* Concept class chips */}
                {facets.concept_class_id && Object.entries(facets.concept_class_id).slice(0, 3).map(([name, count]) => (
                  <button
                    key={`c-${name}`}
                    type="button"
                    onClick={() => {
                      setConceptClassFilter(conceptClassFilter === name ? "" : name);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] transition-colors",
                      conceptClassFilter === name
                        ? "bg-[#8A857D]/25 text-[#C5C0B8]"
                        : "bg-[#8A857D]/10 text-[#8A857D]/70 hover:text-[#8A857D]",
                    )}
                  >
                    {name}
                    <span className="text-[#8A857D]/50">{count.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="divide-y divide-[#232328]">
              {results.map((concept) => {
                const isStandard = concept.standard_concept === "S";
                const isSelected = concept.concept_id === selectedConceptId;
                const isInSet = conceptSetItemIds?.has(concept.concept_id) ?? false;
                const highlightedName = getHighlight(concept.concept_id, "concept_name");

                return (
                  <button
                    key={concept.concept_id}
                    type="button"
                    onClick={() => {
                      if (resolvedMode === 'browse') {
                        onSelectConcept?.(concept.concept_id);
                      }
                    }}
                    className={cn(
                      "flex flex-col gap-1 w-full px-4 py-3 text-left transition-colors",
                      resolvedMode === 'browse' && isSelected
                        ? "bg-[#2DD4BF]/10 border-l-2 border-[#2DD4BF]"
                        : resolvedMode === 'build' && isInSet
                          ? "border-l-2 border-l-teal-400 bg-teal-400/5"
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
                      <span className="flex-1" />
                      {resolvedMode === 'build' ? (
                        isInSet ? (
                          <span className="shrink-0 rounded bg-teal-500/10 px-2 py-0.5 text-xs text-teal-400">
                            In set
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddToSet?.(concept.concept_id);
                            }}
                            className="shrink-0 flex h-6 w-6 items-center justify-center rounded bg-teal-400 text-[#0E0E11] text-sm font-bold hover:bg-teal-300 transition-colors"
                          >
                            +
                          </button>
                        )
                      ) : null}
                    </div>
                    <p className="text-sm text-[#F0EDE8] leading-snug [&_mark]:bg-[#C9A227]/30 [&_mark]:text-[#F0EDE8] [&_mark]:rounded-sm [&_mark]:px-0.5">
                      <HighlightedText
                        html={highlightedName}
                        fallback={concept.concept_name}
                      />
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
