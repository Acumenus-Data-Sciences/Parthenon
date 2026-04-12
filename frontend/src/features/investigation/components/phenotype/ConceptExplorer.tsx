import { useState, useEffect, useRef } from "react";
import type { ConceptSearchResult } from "../../types";
import {
  useConceptSearch,
  useConceptHierarchy,
  useConceptCount,
} from "../../hooks/useConceptSearch";
import { ConceptTree } from "./ConceptTree";

const DOMAIN_OPTIONS = [
  { value: "all", label: "All Domains" },
  { value: "Condition", label: "Condition" },
  { value: "Drug", label: "Drug" },
  { value: "Measurement", label: "Measurement" },
  { value: "Procedure", label: "Procedure" },
  { value: "Observation", label: "Observation" },
];

const DOMAIN_BADGE_CLASSES: Record<string, string> = {
  Condition: "bg-primary/20 text-primary border border-primary/30",
  Drug: "bg-teal-900/30 text-teal-400 border border-teal-500/30",
  Measurement: "bg-yellow-900/30 text-accent border border-yellow-600/30",
  Procedure: "bg-blue-900/30 text-blue-400 border border-blue-500/30",
  Observation: "bg-purple-900/30 text-purple-400 border border-purple-500/30",
  Device: "bg-orange-900/30 text-orange-400 border border-orange-500/30",
  Visit: "bg-surface-accent/50 text-text-secondary border border-border-hover/30",
};

function domainBadgeClass(domain: string): string {
  return (
    DOMAIN_BADGE_CLASSES[domain] ??
    "bg-surface-accent/50 text-text-muted border border-border-hover/30"
  );
}

function ConceptCountBadge({ conceptId }: { conceptId: number }) {
  const { data, isLoading } = useConceptCount(conceptId);
  if (isLoading) return <span className="text-[10px] text-text-ghost">...</span>;
  if (!data) return null;
  return (
    <span className="rounded bg-teal-900/30 px-1.5 py-0.5 text-[10px] text-teal-400">
      {data.patient_count.toLocaleString()} pts
    </span>
  );
}

interface ConceptCardProps {
  concept: ConceptSearchResult;
  isSelected: boolean;
  onSelect: (concept: ConceptSearchResult) => void;
  onAdd: (concept: ConceptSearchResult) => void;
}

function ConceptCard({
  concept,
  isSelected,
  onSelect,
  onAdd,
}: ConceptCardProps) {
  return (
    <div
      className={`group cursor-pointer rounded border px-3 py-2.5 transition-colors ${
        isSelected
          ? "border-success/40 bg-success/5"
          : "border-border-default/50 bg-surface-raised/40 hover:border-border-hover hover:bg-surface-raised/70"
      }`}
      onClick={() => onSelect(concept)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text-primary leading-snug">
              {concept.concept_name}
            </span>
            {concept.standard_concept === "S" && (
              <span className="text-[10px] font-semibold text-success bg-teal-900/30 border border-teal-500/30 rounded px-1.5 py-0.5 leading-none">
                Standard
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`text-[10px] font-medium rounded px-1.5 py-0.5 leading-none ${domainBadgeClass(concept.domain_id)}`}
            >
              {concept.domain_id}
            </span>
            <span className="text-[10px] text-text-ghost">
              {concept.vocabulary_id}
            </span>
            <span className="text-[10px] text-text-ghost">
              #{concept.concept_code}
            </span>
            <span className="text-[10px] text-text-ghost font-mono">
              ID: {concept.concept_id}
            </span>
            <ConceptCountBadge conceptId={concept.concept_id} />
          </div>
        </div>
        <button
          className="shrink-0 rounded px-2 py-1 text-xs font-medium text-success border border-teal-500/30 bg-teal-900/20 opacity-0 group-hover:opacity-100 hover:bg-teal-900/40 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onAdd(concept);
          }}
          title="Add to concept set"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

interface ConceptExplorerProps {
  onAddConcept: (concept: ConceptSearchResult) => void;
}

export function ConceptExplorer({ onAddConcept }: ConceptExplorerProps) {
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [standardOnly, setStandardOnly] = useState(true);
  const [selectedConcept, setSelectedConcept] = useState<
    ConceptSearchResult | undefined
  >();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(inputValue.trim());
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue]);

  const { data: results, isFetching } = useConceptSearch(
    debouncedQuery,
    selectedDomain !== "all" ? selectedDomain : undefined,
  );

  const { data: hierarchy } = useConceptHierarchy(selectedConcept?.concept_id);

  const filteredResults = results?.filter((c) =>
    standardOnly ? c.standard_concept === "S" : true,
  );

  const showTree =
    selectedConcept &&
    hierarchy &&
    (hierarchy.ancestors.length > 0 || hierarchy.descendants.length > 0);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Search controls */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search concepts… (min 2 chars)"
            className="w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder-text-ghost focus:border-success/50 focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/20"
          />
          {isFetching && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border-hover border-t-[#2DD4BF]" />
            </div>
          )}
        </div>
        <select
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          className="rounded border border-border-default bg-surface-base px-2 py-2 text-xs text-text-secondary focus:border-success/50 focus:outline-none"
        >
          {DOMAIN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={standardOnly}
            onChange={(e) => setStandardOnly(e.target.checked)}
            className="h-3.5 w-3.5 rounded border border-border-hover bg-surface-base accent-[#2DD4BF] cursor-pointer"
          />
          <span className="text-xs text-text-muted whitespace-nowrap">
            Standard only
          </span>
        </label>
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-0.5">
        {debouncedQuery.length < 2 && (
          <p className="text-center text-xs text-text-ghost mt-6">
            Type at least 2 characters to search OMOP concepts
          </p>
        )}

        {debouncedQuery.length >= 2 && !isFetching && filteredResults?.length === 0 && (
          <p className="text-center text-xs text-text-ghost mt-6">
            No concepts found matching &ldquo;{debouncedQuery}&rdquo;
            {standardOnly && results && results.length > 0 && (
              <span className="block mt-1 text-text-ghost">
                ({results.length} non-standard hidden — uncheck &ldquo;Standard only&rdquo; to show)
              </span>
            )}
          </p>
        )}

        {filteredResults?.map((concept) => (
          <ConceptCard
            key={concept.concept_id}
            concept={concept}
            isSelected={selectedConcept?.concept_id === concept.concept_id}
            onSelect={(c) =>
              setSelectedConcept(
                selectedConcept?.concept_id === c.concept_id ? undefined : c,
              )
            }
            onAdd={onAddConcept}
          />
        ))}
      </div>

      {/* Hierarchy tree */}
      {showTree && selectedConcept && (
        <div className="shrink-0 border-t border-border-default/50 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Concept Hierarchy
            </span>
            <button
              className="text-[10px] text-text-ghost hover:text-text-muted transition-colors"
              onClick={() => setSelectedConcept(undefined)}
            >
              Close
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto">
            <ConceptTree
              conceptId={selectedConcept.concept_id}
              conceptName={selectedConcept.concept_name}
            />
          </div>
        </div>
      )}
    </div>
  );
}
