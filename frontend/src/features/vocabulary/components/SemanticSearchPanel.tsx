import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Sparkles,
  PlusCircle,
  BookOpen,
  Network,
  Lightbulb,
  GitBranch,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AddToConceptSetModal } from "./AddToConceptSetModal";
import {
  semanticSearch,
  autocomplete,
  getConceptRelationships,
  getConceptPhoebe,
  getConceptDefinition,
  getConceptExpand,
} from "../api/hecateApi";
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
      ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
      : score > 0.5
        ? "bg-[#C9A227]/15 text-[#C9A227]"
        : "bg-[#9B1B30]/15 text-[#E85A6B]";

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
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#60A5FA]/15 text-[#60A5FA]">
      {domain}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Vocabulary badge
// ---------------------------------------------------------------------------

function VocabBadge({ vocab }: { vocab: string }) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#C9A227]/15 text-[#C9A227]">
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
          ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
          : "bg-[#8A857D]/15 text-[#8A857D]",
      )}
    >
      {isStandard ? "Standard" : "Classification"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Expanded concept detail
// ---------------------------------------------------------------------------

interface ConceptDetailExpandedProps {
  conceptId: number;
  onSelectConcept?: (id: number) => void;
  onAddToSet: (id: number, name: string) => void;
  conceptName: string;
}

function ConceptDetailExpanded({
  conceptId,
  onSelectConcept,
  onAddToSet,
  conceptName,
}: ConceptDetailExpandedProps) {
  const [activeTab, setActiveTab] = useState<
    "definition" | "relationships" | "phoebe" | "expand"
  >("definition");

  const definitionQuery = useQuery({
    queryKey: ["hecate", "definition", conceptId],
    queryFn: () => getConceptDefinition(conceptId),
    staleTime: 5 * 60_000,
  });

  const relationshipsQuery = useQuery({
    queryKey: ["hecate", "relationships", conceptId],
    queryFn: () => getConceptRelationships(conceptId),
    enabled: activeTab === "relationships",
    staleTime: 5 * 60_000,
  });

  const phoebeQuery = useQuery({
    queryKey: ["hecate", "phoebe", conceptId],
    queryFn: () => getConceptPhoebe(conceptId),
    enabled: activeTab === "phoebe",
    staleTime: 5 * 60_000,
  });

  const expandQuery = useQuery({
    queryKey: ["hecate", "expand", conceptId],
    queryFn: () => getConceptExpand(conceptId),
    enabled: activeTab === "expand",
    staleTime: 5 * 60_000,
  });

  const tabs = [
    {
      id: "definition" as const,
      label: "Definition",
      icon: <BookOpen size={11} />,
    },
    {
      id: "relationships" as const,
      label: "Relations",
      icon: <Network size={11} />,
    },
    {
      id: "phoebe" as const,
      label: "Phoebe",
      icon: <Lightbulb size={11} />,
    },
    {
      id: "expand" as const,
      label: "Hierarchy",
      icon: <GitBranch size={11} />,
    },
  ];

  return (
    <div className="mt-2 rounded-lg border border-[#2DD4BF]/20 bg-[#0E0E11] overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-[#232328]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1 px-3 py-2 text-[10px] font-medium transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-[#2DD4BF] text-[#2DD4BF] bg-[#2DD4BF]/5"
                : "text-[#8A857D] hover:text-[#C5C0B8]",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        <div className="ml-auto flex items-center pr-2">
          <button
            type="button"
            onClick={() => onAddToSet(conceptId, conceptName)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[#9B1B30] hover:text-[#C5384C] hover:bg-[#9B1B30]/10 transition-colors"
          >
            <PlusCircle size={11} />
            Add to Set
          </button>
          {onSelectConcept && (
            <button
              type="button"
              onClick={() => onSelectConcept(conceptId)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[#8A857D] hover:text-[#C5C0B8] hover:bg-[#1C1C20] transition-colors"
            >
              View Detail
            </button>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-3 min-h-[80px]">
        {/* Definition */}
        {activeTab === "definition" && (
          <>
            {definitionQuery.isLoading ? (
              <div className="flex items-center gap-2 text-[#8A857D] text-xs">
                <Loader2 size={12} className="animate-spin" />
                Loading definition...
              </div>
            ) : definitionQuery.isError ? (
              <p className="text-xs text-[#E85A6B]">
                Could not load definition.
              </p>
            ) : definitionQuery.data?.definition ? (
              <p className="text-xs text-[#C5C0B8] leading-relaxed">
                {definitionQuery.data.definition}
              </p>
            ) : (
              <p className="text-xs text-[#5A5650] italic">
                No definition available for this concept.
              </p>
            )}
          </>
        )}

        {/* Relationships */}
        {activeTab === "relationships" && (
          <>
            {relationshipsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-[#8A857D] text-xs">
                <Loader2 size={12} className="animate-spin" />
                Loading relationships...
              </div>
            ) : relationshipsQuery.isError ? (
              <p className="text-xs text-[#E85A6B]">
                Could not load relationships.
              </p>
            ) : !relationshipsQuery.data?.length ? (
              <p className="text-xs text-[#5A5650] italic">
                No relationships found.
              </p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {relationshipsQuery.data.slice(0, 20).map((rel, idx) => (
                  <div
                    key={`${rel.relationship_id}-${rel.concept_id}-${idx}`}
                    className="flex items-start gap-2"
                  >
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] bg-[#232328] text-[#8A857D] font-mono mt-0.5">
                      {rel.relationship_id}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectConcept?.(rel.concept_id)}
                      className="text-[11px] text-[#C5C0B8] hover:text-[#2DD4BF] transition-colors text-left leading-snug"
                    >
                      {rel.concept_name}
                      <span className="ml-1 font-mono text-[9px] text-[#5A5650]">
                        [{rel.vocabulary_id}]
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Phoebe recommendations */}
        {activeTab === "phoebe" && (
          <>
            {phoebeQuery.isLoading ? (
              <div className="flex items-center gap-2 text-[#8A857D] text-xs">
                <Loader2 size={12} className="animate-spin" />
                Loading recommendations...
              </div>
            ) : phoebeQuery.isError ? (
              <p className="text-xs text-[#E85A6B]">
                Could not load Phoebe recommendations.
              </p>
            ) : !phoebeQuery.data?.length ? (
              <p className="text-xs text-[#5A5650] italic">
                No Phoebe recommendations available.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {phoebeQuery.data.slice(0, 15).map((rec, idx) => (
                  <div
                    key={`${rec.concept_id}-${idx}`}
                    className="flex items-center gap-2"
                  >
                    <ScoreBadge score={rec.score} />
                    <button
                      type="button"
                      onClick={() => onSelectConcept?.(rec.concept_id)}
                      className="text-[11px] text-[#C5C0B8] hover:text-[#2DD4BF] transition-colors text-left"
                    >
                      {rec.concept_name}
                    </button>
                    <span className="ml-auto font-mono text-[9px] text-[#5A5650] shrink-0">
                      {rec.concept_id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Expand hierarchy */}
        {activeTab === "expand" && (
          <>
            {expandQuery.isLoading ? (
              <div className="flex items-center gap-2 text-[#8A857D] text-xs">
                <Loader2 size={12} className="animate-spin" />
                Expanding hierarchy...
              </div>
            ) : expandQuery.isError ? (
              <p className="text-xs text-[#E85A6B]">
                Could not expand hierarchy.
              </p>
            ) : !expandQuery.data?.length ? (
              <p className="text-xs text-[#5A5650] italic">
                No hierarchy nodes found.
              </p>
            ) : (
              <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
                {expandQuery.data.slice(0, 30).map((node, idx) => (
                  <div
                    key={`${node.concept_id}-${idx}`}
                    className="flex items-center gap-1"
                    style={{ paddingLeft: `${(node.level ?? 0) * 14}px` }}
                  >
                    <ChevronRight
                      size={9}
                      className="shrink-0 text-[#5A5650]"
                    />
                    <button
                      type="button"
                      onClick={() => onSelectConcept?.(node.concept_id)}
                      className="text-[11px] text-[#C5C0B8] hover:text-[#2DD4BF] transition-colors text-left truncate"
                    >
                      {node.concept_name}
                    </button>
                    <span className="ml-auto font-mono text-[9px] text-[#5A5650] shrink-0">
                      {node.vocabulary_id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
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
}

function ResultRow({
  result,
  isSelected,
  onSelectConcept,
  onAddToSet,
}: ResultRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "border-b border-[#232328] transition-colors",
        isSelected ? "bg-[#2DD4BF]/5" : "hover:bg-[#1C1C20]",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex flex-col gap-1.5 w-full px-4 py-3 text-left"
      >
        {/* Top row: score + id + standard badge */}
        <div className="flex items-center gap-2">
          <ScoreBadge score={result.score} />
          <span className="font-mono text-xs tabular-nums text-[#C9A227]">
            {result.concept_id}
          </span>
          <StandardBadge value={result.standard_concept} />
          <ChevronRight
            size={11}
            className={cn(
              "ml-auto shrink-0 text-[#5A5650] transition-transform",
              expanded && "rotate-90",
            )}
          />
        </div>

        {/* Concept name */}
        <p className="text-sm font-medium text-[#F0EDE8] leading-snug">
          {result.concept_name}
        </p>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <DomainBadge domain={result.domain_id} />
          <VocabBadge vocab={result.vocabulary_id} />
          {result.concept_class_id && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#8A857D]/15 text-[#8A857D]">
              {result.concept_class_id}
            </span>
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-3">
          <ConceptDetailExpanded
            conceptId={result.concept_id}
            conceptName={result.concept_name}
            onSelectConcept={onSelectConcept}
            onAddToSet={onAddToSet}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component: SemanticSearchPanel
// ---------------------------------------------------------------------------

interface SemanticSearchPanelProps {
  onSelectConcept?: (id: number) => void;
}

export function SemanticSearchPanel({
  onSelectConcept,
}: SemanticSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [vocabFilter, setVocabFilter] = useState("");
  const [standardFilter, setStandardFilter] =
    useState<StandardConceptFilter>("all");
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

  const { data: suggestions } = useQuery<HecateAutocompleteResult[]>({
    queryKey: ["hecate", "autocomplete", debouncedAutocompleteQuery],
    queryFn: () => autocomplete(debouncedAutocompleteQuery),
    enabled: debouncedAutocompleteQuery.length >= 2,
    staleTime: 60_000,
  });

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
  }, [suggestions]);

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
    const hasSuggestions = showSuggestions && suggestions && suggestions.length > 0;
    if (!hasSuggestions) return;

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
      <div className="px-4 py-4 border-b border-[#232328] space-y-3">
        {/* Branding row */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-[#2DD4BF]/40 bg-[#2DD4BF]/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#2DD4BF]">
            <Sparkles className="h-3 w-3" />
            Powered by Hecate
          </span>
          <span className="text-[10px] text-[#5A5650]">
            vector-powered concept discovery
          </span>
        </div>

        {/* Search input */}
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
            placeholder="Enter a clinical term to search semantically..."
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

          {/* Autocomplete dropdown */}
          {showSuggestions &&
            suggestions &&
            suggestions.length > 0 &&
            query.length >= 2 && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 top-full mt-1 w-full rounded-lg border border-[#232328] bg-[#16161A] shadow-xl overflow-hidden"
              >
                {suggestions.slice(0, 10).map((s, i) => (
                  <button
                    key={`${s.concept_id}-${i}`}
                    type="button"
                    onClick={() => applySuggestion(s.concept_name)}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors",
                      i === selectedSuggestionIdx
                        ? "bg-[#2DD4BF]/10 text-[#F0EDE8]"
                        : "text-[#C5C0B8] hover:bg-[#1C1C20]",
                    )}
                  >
                    <Sparkles size={10} className="shrink-0 text-[#2DD4BF]/50" />
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
                "bg-[#0E0E11] border border-[#232328]",
                domainFilter ? "text-[#60A5FA]" : "text-[#8A857D]",
                "focus:outline-none focus:border-[#2DD4BF]/50",
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
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5650]"
            />
          </div>

          {/* Vocabulary filter */}
          <div className="relative flex-1 min-w-0">
            <select
              value={vocabFilter}
              onChange={(e) => setVocabFilter(e.target.value)}
              className={cn(
                "w-full rounded-lg px-3 py-1.5 text-xs appearance-none pr-6",
                "bg-[#0E0E11] border border-[#232328]",
                vocabFilter ? "text-[#C9A227]" : "text-[#8A857D]",
                "focus:outline-none focus:border-[#2DD4BF]/50",
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
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5650]"
            />
          </div>

          {/* Standard concept toggle: All / Standard / Classification */}
          <div className="flex rounded-lg border border-[#232328] overflow-hidden shrink-0">
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
                    ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
                    : "text-[#5A5650] hover:text-[#C5C0B8] bg-[#0E0E11]",
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
            className="text-[10px] text-[#E85A6B] hover:text-[#F06B7F] transition-colors"
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
            <Loader2 size={18} className="animate-spin text-[#8A857D]" />
          </div>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4 space-y-3">
            <p className="text-sm text-[#E85A6B]">
              Semantic search is unavailable.
            </p>
            <p className="text-xs text-[#5A5650]">
              Ensure the Hecate AI service is running and ChromaDB is
              initialized.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[#C5C0B8] border border-[#232328] hover:border-[#2DD4BF]/30 hover:text-[#2DD4BF] transition-colors"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          </div>
        )}

        {/* Empty state — no query */}
        {!isLoading && !isError && !showResults && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6 space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#2DD4BF]/10 flex items-center justify-center">
              <Sparkles size={18} className="text-[#2DD4BF]/70" />
            </div>
            <p className="text-sm text-[#8A857D]">
              Enter a clinical term to search semantically
            </p>
            <p className="text-xs text-[#5A5650] max-w-xs leading-relaxed">
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
              <p className="text-sm text-[#8A857D]">
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
                  className="text-xs text-[#2DD4BF] hover:text-[#26B8A5] transition-colors"
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
            <div className="px-4 py-2 border-b border-[#232328] flex items-center justify-between">
              <p className="text-[10px] text-[#5A5650]">
                {results.length} semantic{" "}
                {results.length === 1 ? "match" : "matches"}
                {isFetching && !isLoading && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <Loader2 size={9} className="animate-spin" />
                    Updating...
                  </span>
                )}
              </p>
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium bg-[#2DD4BF]/10 text-[#2DD4BF]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF]" />
                Hecate
              </span>
            </div>

            {/* Result rows */}
            <div>
              {results.map((result) => (
                <ResultRow
                  key={result.concept_id}
                  result={result}
                  isSelected={false}
                  onSelectConcept={onSelectConcept}
                  onAddToSet={handleAddToSet}
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
        />
      )}
    </div>
  );
}
