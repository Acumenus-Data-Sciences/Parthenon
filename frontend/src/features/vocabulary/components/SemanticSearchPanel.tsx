import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search,
  Loader2,
  X,
  ChevronDown,
  RefreshCw,
  Sparkles,
  PlusCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AddToConceptSetModal } from "./AddToConceptSetModal";
import { semanticSearch } from "../api/hecateApi";
import type {
  HecateSemanticSearchResult,
  HecateAutocompleteResult,
  SemanticSearchParams,
} from "../api/hecateApi";
import { useDebounce } from "../hooks/useVocabularySearch";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOMAINS = [
  "Condition",
  "Drug",
  "Procedure",
  "Measurement",
  "Observation",
  "Device",
  "Visit",
  "Specimen",
];

const VOCABULARIES = [
  "SNOMED",
  "ICD10CM",
  "ICD9CM",
  "RxNorm",
  "RxNorm Extension",
  "LOINC",
  "CPT4",
  "HCPCS",
  "NDC",
  "MedDRA",
  "ATC",
  "Read",
];

type StandardConceptFilter = "all" | "S" | "C";

// ---------------------------------------------------------------------------
// Sub-component: Score badge
// ---------------------------------------------------------------------------

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const colorClass =
    score > 0.8
      ? "bg-success/15 text-success"
      : score > 0.5
        ? "bg-accent/15 text-accent"
        : "bg-primary/15 text-critical";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-mono font-medium tabular-nums",
        colorClass,
      )}
    >
      {pct}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Domain badge
// ---------------------------------------------------------------------------

function DomainBadge({ domain }: { domain: string }) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-info/15 text-info">
      {domain}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Vocabulary badge
// ---------------------------------------------------------------------------

function VocabBadge({ vocab }: { vocab: string }) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent/15 text-accent">
      {vocab}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Standard status badge
// ---------------------------------------------------------------------------

function StandardBadge({ value }: { value: string | null }) {
  if (!value) return null;
  const isStandard = value === "S";
  const isClass = value === "C";
  if (!isStandard && !isClass) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium",
        isStandard
          ? "bg-success/15 text-success"
          : "bg-text-muted/15 text-text-muted",
      )}
    >
      {isStandard ? "Standard" : "Classification"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Single result row
// ---------------------------------------------------------------------------

interface ResultRowProps {
  result: HecateSemanticSearchResult;
  isSelected: boolean;
  onSelectConcept?: (id: number) => void;
  onAddToSet: (id: number, name: string) => void;
  resolvedMode: 'browse' | 'build';
  conceptSetItemIds?: Set<number>;
  onAddToSetBuild?: (conceptId: number) => void;
}

function ResultRow({
  result,
  isSelected,
  onSelectConcept,
  onAddToSet,
  resolvedMode,
  conceptSetItemIds,
  onAddToSetBuild,
}: ResultRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectConcept?.(result.concept_id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelectConcept?.(result.concept_id);
      }}
      className={cn(
        "border-b border-border-default transition-colors cursor-pointer",
        isSelected
          ? "bg-success/10 border-l-2 border-l-success"
          : "hover:bg-surface-overlay",
      )}
    >
      <div className="flex flex-col gap-1.5 w-full px-4 py-3 text-left">
        {/* Top row: score + id + standard badge + add-to-set */}
        <div className="flex items-center gap-2">
          <ScoreBadge score={result.score} />
          <span className="font-mono text-xs tabular-nums text-accent">
            {result.concept_id}
          </span>
          <StandardBadge value={result.standard_concept} />
          {resolvedMode === 'build' ? (
            conceptSetItemIds?.has(result.concept_id) ? (
              <span className="ml-auto shrink-0 rounded bg-teal-500/10 px-2 py-0.5 text-xs text-teal-400">
                In set
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToSetBuild?.(result.concept_id);
                }}
                className="ml-auto shrink-0 flex h-6 w-6 items-center justify-center rounded bg-teal-400 text-surface-base text-sm font-bold hover:bg-teal-300 transition-colors"
              >
                +
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddToSet(result.concept_id, result.concept_name);
              }}
              className="ml-auto inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] text-primary hover:text-critical-dark hover:bg-primary/10 transition-colors"
            >
              <PlusCircle size={10} />
              Add to Set
            </button>
          )}
        </div>

        {/* Concept name */}
        <p className="text-sm font-medium text-text-primary leading-snug">
          {result.concept_name}
        </p>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <DomainBadge domain={result.domain_id} />
          <VocabBadge vocab={result.vocabulary_id} />
          {result.concept_class_id && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-text-muted/15 text-text-muted">
              {result.concept_class_id}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component: SemanticSearchPanel
// ---------------------------------------------------------------------------

interface SemanticSearchPanelProps {
  mode?: 'browse' | 'build';
  onSelectConcept?: (id: number) => void;

  // Build mode: concept set integration
  conceptSetItemIds?: Set<number>;
  onAddToSet?: (conceptId: number) => void;

  // Context carry-over
  initialQuery?: string;
  initialFilters?: {
    domain?: string;
    vocabulary?: string;
    standard?: boolean;
  };
}

export function SemanticSearchPanel({
  mode,
  onSelectConcept,
  conceptSetItemIds,
  onAddToSet,
  initialQuery,
  initialFilters,
}: SemanticSearchPanelProps) {
  const resolvedMode = mode ?? 'browse';
  const [query, setQuery] = useState(initialQuery ?? "");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [domainFilter, setDomainFilter] = useState(initialFilters?.domain ?? "");
  const [vocabFilter, setVocabFilter] = useState(initialFilters?.vocabulary ?? "");
  const [standardFilter, setStandardFilter] =
    useState<StandardConceptFilter>(
      initialFilters?.standard === true ? "S" : "all"
    );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(-1);

  // Modal state for "Add to Concept Set"
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);
  const debouncedAutocompleteQuery = useDebounce(query, 200);

  // ---------------------------------------------------------------------------
  // Autocomplete query
  // ---------------------------------------------------------------------------

  // Autocomplete disabled — Hecate binary does not expose /api/autocomplete
  void debouncedAutocompleteQuery;
  const suggestionItems: HecateAutocompleteResult[] = [];

  // ---------------------------------------------------------------------------
  // Semantic search query
  // ---------------------------------------------------------------------------

  const searchParams: SemanticSearchParams = {
    q: debouncedQuery,
    ...(domainFilter && { domain_id: domainFilter }),
    ...(vocabFilter && { vocabulary_id: vocabFilter }),
    ...(standardFilter !== "all" && { standard_concept: standardFilter }),
    limit: 50,
  };

  const {
    data: results,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<HecateSemanticSearchResult[]>({
    queryKey: ["hecate", "search", searchParams],
    queryFn: () => semanticSearch(searchParams),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  // ---------------------------------------------------------------------------
  // Suggestion keyboard navigation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setSelectedSuggestionIdx(-1);
  }, [debouncedAutocompleteQuery]);

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

  const applySuggestion = useCallback((text: string) => {
    setQuery(text);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const hasSuggestions = showSuggestions && suggestionItems.length > 0;
    if (!hasSuggestions) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const count = suggestionItems.length;
      setSelectedSuggestionIdx((prev) =>
        count > 0 ? (prev < count - 1 ? prev + 1 : 0) : -1,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const count = suggestionItems.length;
      setSelectedSuggestionIdx((prev) =>
        count > 0 ? (prev > 0 ? prev - 1 : count - 1) : -1,
      );
    } else if (e.key === "Enter" && selectedSuggestionIdx >= 0) {
      e.preventDefault();
      const activeSuggestion = suggestionItems[selectedSuggestionIdx];
      if (activeSuggestion) {
        applySuggestion(activeSuggestion.concept_name);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Add to concept set handler
  // ---------------------------------------------------------------------------

  const handleAddToSet = useCallback((id: number, name: string) => {
    setAddTarget({ id, name });
    setAddModalOpen(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasFilters = domainFilter || vocabFilter || standardFilter !== "all";
  const showResults = debouncedQuery.length >= 2;

  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="px-4 py-4 border-b border-border-default space-y-3">
        {/* Branding row */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-success">
            <Sparkles className="h-3 w-3" />
            Powered by Hecate
          </span>
          <span className="text-[10px] text-text-ghost">
            vector-powered concept discovery
          </span>
        </div>

        {/* Search input */}
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
            }}
            onFocus={() => query.length >= 2 && setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder="Enter a clinical term to search semantically..."
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

          {/* Autocomplete dropdown */}
          {showSuggestions &&
            suggestionItems.length > 0 &&
            query.length >= 2 && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border-default bg-surface-raised shadow-xl overflow-hidden"
              >
                {suggestionItems.slice(0, 10).map((s: HecateAutocompleteResult, i: number) => (
                  <button
                    key={`${s.concept_id}-${i}`}
                    type="button"
                    onClick={() => applySuggestion(s.concept_name)}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors",
                      i === selectedSuggestionIdx
                        ? "bg-success/10 text-text-primary"
                        : "text-text-secondary hover:bg-surface-overlay",
                    )}
                  >
                    <Sparkles size={10} className="shrink-0 text-success/50" />
                    <span className="truncate">{s.concept_name}</span>
                    <DomainBadge domain={s.domain_id} />
                  </button>
                ))}
              </div>
            )}
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2">
          {/* Domain filter */}
          <div className="relative flex-1 min-w-0">
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className={cn(
                "w-full rounded-lg px-3 py-1.5 text-xs appearance-none pr-6",
                "bg-surface-base border border-border-default",
                domainFilter ? "text-info" : "text-text-muted",
                "focus:outline-none focus:border-success/50",
                "transition-colors",
              )}
            >
              <option value="">All Domains</option>
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <ChevronDown
              size={10}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-ghost"
            />
          </div>

          {/* Vocabulary filter */}
          <div className="relative flex-1 min-w-0">
            <select
              value={vocabFilter}
              onChange={(e) => setVocabFilter(e.target.value)}
              className={cn(
                "w-full rounded-lg px-3 py-1.5 text-xs appearance-none pr-6",
                "bg-surface-base border border-border-default",
                vocabFilter ? "text-accent" : "text-text-muted",
                "focus:outline-none focus:border-success/50",
                "transition-colors",
              )}
            >
              <option value="">All Vocabularies</option>
              {VOCABULARIES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <ChevronDown
              size={10}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-ghost"
            />
          </div>

          {/* Standard concept toggle: All / Standard / Classification */}
          <div className="flex rounded-lg border border-border-default overflow-hidden shrink-0">
            {(
              [
                { value: "all", label: "All" },
                { value: "S", label: "S" },
                { value: "C", label: "C" },
              ] as { value: StandardConceptFilter; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStandardFilter(opt.value)}
                className={cn(
                  "px-2 py-1.5 text-[10px] font-medium transition-colors",
                  standardFilter === opt.value
                    ? "bg-success/15 text-success"
                    : "text-text-ghost hover:text-text-secondary bg-surface-base",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active filters clear */}
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setDomainFilter("");
              setVocabFilter("");
              setStandardFilter("all");
            }}
            className="text-[10px] text-critical hover:text-critical transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin text-text-muted" />
          </div>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4 space-y-3">
            <p className="text-sm text-critical">
              Semantic search is unavailable.
            </p>
            <p className="text-xs text-text-ghost">
              Ensure the Hecate AI service is running and ChromaDB is
              initialized.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-secondary border border-border-default hover:border-success/30 hover:text-success transition-colors"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          </div>
        )}

        {/* Empty state — no query */}
        {!isLoading && !isError && !showResults && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6 space-y-3">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
              <Sparkles size={18} className="text-success/70" />
            </div>
            <p className="text-sm text-text-muted">
              Enter a clinical term to search semantically
            </p>
            <p className="text-xs text-text-ghost max-w-xs leading-relaxed">
              Hecate uses vector embeddings to find conceptually similar OMOP
              concepts, even when exact keyword matches fail.
            </p>
          </div>
        )}

        {/* No results */}
        {!isLoading &&
          !isError &&
          showResults &&
          results &&
          results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4 space-y-2">
              <p className="text-sm text-text-muted">
                No semantic matches found for &ldquo;{debouncedQuery}&rdquo;
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setDomainFilter("");
                    setVocabFilter("");
                    setStandardFilter("all");
                  }}
                  className="text-xs text-success hover:text-success-dark transition-colors"
                >
                  Try clearing filters
                </button>
              )}
            </div>
          )}

        {/* Results list */}
        {!isError && showResults && results && results.length > 0 && (
          <div>
            {/* Result count header */}
            <div className="px-4 py-2 border-b border-border-default flex items-center justify-between">
              <p className="text-[10px] text-text-ghost">
                {results.length} semantic{" "}
                {results.length === 1 ? "match" : "matches"}
                {isFetching && !isLoading && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <Loader2 size={9} className="animate-spin" />
                    Updating...
                  </span>
                )}
              </p>
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium bg-success/10 text-success">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Hecate
              </span>
            </div>

            {/* Result rows */}
            <div>
              {results.map((result) => (
                <ResultRow
                  key={result.concept_id}
                  result={result}
                  isSelected={selectedId === result.concept_id}
                  onSelectConcept={(id) => {
                    setSelectedId(id);
                    onSelectConcept?.(id);
                  }}
                  onAddToSet={handleAddToSet}
                  resolvedMode={resolvedMode}
                  conceptSetItemIds={conceptSetItemIds}
                  onAddToSetBuild={onAddToSet}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add to Concept Set modal */}
      {addTarget && (
        <AddToConceptSetModal
          open={addModalOpen}
          onClose={() => {
            setAddModalOpen(false);
            setAddTarget(null);
          }}
          conceptId={addTarget.id}
          conceptName={addTarget.name}
          searchContext={{
            query: query || undefined,
            domain: domainFilter || undefined,
            vocabulary: vocabFilter || undefined,
            standard: standardFilter !== "all" ? standardFilter : undefined,
          }}
        />
      )}
    </div>
  );
}
