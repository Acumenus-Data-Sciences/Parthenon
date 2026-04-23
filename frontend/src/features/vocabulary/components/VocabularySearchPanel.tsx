import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Loader2, X, Filter, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/i18n/format";
import {
  useVocabularySearch,
  useConceptSuggest,
  useDomains,
  useVocabularies,
} from "../hooks/useVocabularySearch";
import DOMPurify from "dompurify";


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
  const safe = DOMPurify.sanitize(html.replace(/<(?!\/?mark>)[^>]*>/g, ""), { ALLOWED_TAGS: ['mark'] });
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
  const { t } = useTranslation("app");
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

  // Reset suggestion index when suggestions change — legitimate derived-reset sync
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSelectedSuggestionIdx(-1);
  }, [suggestions]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const applySuggestion = useCallback((text: string) => {
    setQuery(text);
    setShowSuggestions(false);
    setSelectedSuggestionIdx(-1);
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
    <div className="flex flex-col h-full border-r border-border-default">
      {/* Search Header */}
      <div className="px-4 py-4 border-b border-border-default space-y-3">
        {/* Search Input + Autocomplete */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
              setSelectedSuggestionIdx(-1);
            }}
            onFocus={() => query.length >= 2 && setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={t("vocabulary.searchPanel.placeholder")}
            className={cn(
              "w-full rounded-lg pl-9 pr-8 py-2.5 text-sm",
              "bg-surface-base border border-border-default",
              "text-text-primary placeholder:text-text-ghost",
              "focus:outline-none focus:border-success focus:ring-1 focus:ring-success/40",
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
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-ghost hover:text-text-secondary transition-colors"
            >
              <X size={14} />
            </button>
          )}

          {/* Autocomplete Dropdown */}
          {showSuggestions && suggestions && suggestions.length > 0 && query.length >= 2 && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border-default bg-surface-raised shadow-xl overflow-hidden"
            >
              {suggestions.slice(0, 8).map((s, i) => (
                <button
                  key={s.concept_name}
                  type="button"
                  onClick={() => applySuggestion(s.concept_name)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors",
                    i === selectedSuggestionIdx
                      ? "bg-success/10 text-text-primary"
                      : "text-text-secondary hover:bg-surface-overlay",
                  )}
                >
                  <Search size={11} className="shrink-0 text-text-ghost" />
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
                ? "text-success"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            <Filter size={12} />
            {t("vocabulary.searchPanel.filters.toggle")}
            {hasActiveFilters && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-success/15 text-[9px] font-bold text-success">
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
            <span className={cn("text-xs transition-colors", standardOnly ? "text-success" : "text-text-ghost")}>
              {t("vocabulary.searchPanel.filters.standardOnly")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={standardOnly}
              onClick={() => setStandardOnly(!standardOnly)}
              className={cn(
                "relative w-8 h-[18px] rounded-full transition-colors",
                standardOnly ? "bg-success" : "bg-surface-highlight",
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
                "bg-surface-base border border-border-default",
                "text-text-primary",
                "focus:outline-none focus:border-success focus:ring-1 focus:ring-success/40",
              )}
            >
              <option value="">{t("vocabulary.searchPanel.filters.allDomains")}</option>
              {domains?.map((d) => {
                const count = facets?.domain_id?.[d.domain_id];
                return (
                  <option key={d.domain_id} value={d.domain_id}>
                    {d.domain_name}
                    {count != null
                      ? t("vocabulary.searchPanel.filters.countSuffix", {
                        count: formatNumber(count),
                      })
                      : ""}
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
                "bg-surface-base border border-border-default",
                "text-text-primary",
                "focus:outline-none focus:border-success focus:ring-1 focus:ring-success/40",
              )}
            >
              <option value="">{t("vocabulary.searchPanel.filters.allVocabularies")}</option>
              {vocabularies?.map((v) => {
                const count = facets?.vocabulary_id?.[v.vocabulary_id];
                return (
                  <option key={v.vocabulary_id} value={v.vocabulary_id}>
                    {v.vocabulary_name}
                    {count != null
                      ? t("vocabulary.searchPanel.filters.countSuffix", {
                        count: formatNumber(count),
                      })
                      : ""}
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
                "bg-surface-base border border-border-default",
                "text-text-primary",
                "focus:outline-none focus:border-success focus:ring-1 focus:ring-success/40",
              )}
            >
              <option value="">{t("vocabulary.searchPanel.filters.allConceptClasses")}</option>
              {conceptClassOptions.map(([name, count]) => (
                <option key={name} value={name}>
                  {name}
                  {t("vocabulary.searchPanel.filters.countSuffix", {
                    count: formatNumber(count),
                  })}
                </option>
              ))}
            </select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-critical hover:text-critical transition-colors"
              >
                {t("vocabulary.searchPanel.actions.clearAllFilters")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && !isFetchingNextPage ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin text-text-muted" />
          </div>
        ) : !query || query.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Search size={28} className="text-text-ghost mb-3" />
            <p className="text-sm text-text-muted">{t("vocabulary.searchPanel.empty.prompt")}</p>
            <p className="mt-1 text-xs text-text-ghost">
              {t("vocabulary.searchPanel.empty.help")}
            </p>
          </div>
        ) : !results || results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <p className="text-sm text-text-muted">
              {t("vocabulary.searchPanel.empty.noResults", { query })}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-2 text-xs text-success hover:text-success-dark transition-colors"
              >
                {t("vocabulary.searchPanel.actions.tryClearingFilters")}
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Result count + engine indicator */}
            <div className="px-4 py-2 border-b border-border-default flex items-center justify-between">
              <p className="text-[10px] text-text-ghost">
                {t("vocabulary.searchPanel.results.showingCount", {
                  shown: formatNumber(results.length),
                  total: formatNumber(total),
                })}
              </p>
              {engine && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium",
                    engine === "solr"
                      ? "bg-success/10 text-success"
                      : "bg-text-muted/10 text-text-muted",
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      engine === "solr" ? "bg-success" : "bg-text-muted",
                    )}
                  />
                  {t(engine === "solr"
                    ? "vocabulary.searchPanel.engine.solr"
                    : "vocabulary.searchPanel.engine.pg")}
                </span>
              )}
            </div>

            {/* Faceted filter chips (Solr-powered) — domain, vocabulary, concept class */}
            {facets && Object.keys(facets).length > 0 && !showFilters && (
              <div className="px-4 py-1.5 border-b border-border-default flex flex-wrap gap-1">
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
                        ? "bg-info/20 text-info"
                        : "bg-info/10 text-info/70 hover:text-info",
                    )}
                  >
                    {name}
                    <span className="text-info/50">{formatNumber(count)}</span>
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
                        ? "bg-accent/20 text-accent"
                        : "bg-accent/10 text-accent/70 hover:text-accent",
                    )}
                  >
                    {name}
                    <span className="text-accent/50">{formatNumber(count)}</span>
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
                        ? "bg-text-muted/25 text-text-secondary"
                        : "bg-text-muted/10 text-text-muted/70 hover:text-text-muted",
                    )}
                  >
                    {name}
                    <span className="text-text-muted/50">{formatNumber(count)}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="divide-y divide-border-default">
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
                        ? "bg-success/10 border-l-2 border-success"
                        : resolvedMode === 'build' && isInSet
                          ? "border-l-2 border-l-teal-400 bg-teal-400/5"
                          : "hover:bg-surface-overlay border-l-2 border-transparent",
                    )}
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
                          {t("vocabulary.searchPanel.values.standardAbbrev")}
                        </span>
                      )}
                      <span className="flex-1" />
                      {resolvedMode === 'build' ? (
                        isInSet ? (
                          <span className="shrink-0 rounded bg-teal-500/10 px-2 py-0.5 text-xs text-teal-400">
                            {t("vocabulary.searchPanel.values.inSet")}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddToSet?.(concept.concept_id);
                            }}
                            className="shrink-0 flex h-6 w-6 items-center justify-center rounded bg-teal-400 text-surface-base text-sm font-bold hover:bg-teal-300 transition-colors"
                          >
                            +
                          </button>
                        )
                      ) : null}
                    </div>
                    <p className="text-sm text-text-primary leading-snug [&_mark]:bg-accent/30 [&_mark]:text-text-primary [&_mark]:rounded-sm [&_mark]:px-0.5">
                      <HighlightedText
                        html={highlightedName}
                        fallback={concept.concept_name}
                      />
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-info/15 text-info">
                        {concept.domain_id}
                      </span>
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent/15 text-accent">
                        {concept.vocabulary_id}
                      </span>
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-text-muted/15 text-text-muted">
                        {concept.concept_class_id}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Load More */}
            {hasNextPage && (
              <div className="px-4 py-3 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className={cn(
                    "w-full px-3 py-2 text-xs rounded-lg border border-border-default transition-colors",
                    "text-text-muted hover:text-text-primary hover:border-success/30",
                    isFetchingNextPage && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {isFetchingNextPage ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={12} className="animate-spin" />
                      {t("vocabulary.searchPanel.actions.loading")}
                    </span>
                  ) : (
                    t("vocabulary.searchPanel.actions.loadMoreResults")
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
