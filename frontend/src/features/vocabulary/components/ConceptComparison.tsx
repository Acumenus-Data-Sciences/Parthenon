import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, Loader2, Plus } from "lucide-react";
import { useConceptComparison, useDebounce } from "../hooks/useVocabularySearch";
import { searchConcepts } from "../api/vocabularyApi";
import type { Concept } from "../types/vocabulary";

function ConceptCard({
  entry,
  allFields,
  onRemove,
}: {
  entry: {
    concept: Concept;
    ancestors: { concept_id: number; concept_name: string; domain_id: string; vocabulary_id: string; min_levels_of_separation: number }[];
    relationships: { relationship_id: string; concept_id_2: number; concept_name: string; domain_id: string; vocabulary_id: string }[];
  };
  allFields: string[];
  onRemove: () => void;
}) {
  const c = entry.concept;
  const isStandard = c.standard_concept === "S";

  const fieldValues: Record<string, string> = {
    "Concept Code": c.concept_code,
    Domain: c.domain_id,
    Vocabulary: c.vocabulary_id,
    "Concept Class": c.concept_class_id,
    Standard: c.standard_concept === "S" ? "Standard" : c.standard_concept === "C" ? "Classification" : "Non-standard",
    "Valid Start": c.valid_start_date ?? "--",
    "Valid End": c.valid_end_date ?? "--",
    "Invalid Reason": c.invalid_reason ?? "Valid",
  };

  return (
    <div className="flex-1 min-w-0 rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-default bg-surface-overlay">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-['IBM_Plex_Mono',monospace] text-xs tabular-nums text-accent">
                {c.concept_id}
              </span>
              {isStandard && (
                <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-success/15 text-success">
                  Standard
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-text-primary leading-snug truncate">
              {c.concept_name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 p-1 rounded text-text-ghost hover:text-critical hover:bg-critical/10 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="divide-y divide-border-default">
        {allFields.map((field) => (
          <div key={field} className="px-4 py-2 flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold shrink-0">
              {field}
            </span>
            <span className="text-xs text-text-primary text-right truncate">
              {fieldValues[field] ?? "--"}
            </span>
          </div>
        ))}
      </div>

      {/* Ancestors */}
      {entry.ancestors.length > 0 && (
        <div className="border-t border-border-default">
          <div className="px-4 py-2 bg-surface-overlay">
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
              Ancestors (2 levels)
            </span>
          </div>
          <div className="px-4 py-2 space-y-1">
            {entry.ancestors.map((a) => (
              <div key={a.concept_id} className="flex items-center gap-2">
                <span className="text-[10px] text-text-ghost">L{a.min_levels_of_separation}</span>
                <span className="text-xs text-text-primary truncate">{a.concept_name}</span>
                <span className="shrink-0 inline-flex items-center rounded px-1 py-0.5 text-[8px] font-medium bg-accent/15 text-accent">
                  {a.vocabulary_id}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Relationships */}
      {entry.relationships.length > 0 && (
        <div className="border-t border-border-default">
          <div className="px-4 py-2 bg-surface-overlay">
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
              Relationships
            </span>
          </div>
          <div className="px-4 py-2 space-y-1 max-h-40 overflow-y-auto">
            {entry.relationships.slice(0, 10).map((r, i) => (
              <div key={`${r.relationship_id}-${r.concept_id_2}-${i}`} className="flex items-center gap-2">
                <span className="shrink-0 inline-flex items-center rounded px-1 py-0.5 text-[8px] font-medium bg-[var(--domain-observation)]/15 text-[var(--domain-observation)]">
                  {r.relationship_id}
                </span>
                <span className="text-xs text-text-primary truncate">{r.concept_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConceptQuickSearch({
  onSelect,
  excludeIds,
}: {
  onSelect: (id: number) => void;
  excludeIds: number[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Concept[]>([]);
  const [searching, setSearching] = useState(false);
  const debouncedQuery = useDebounce(query, 350);

  const doSearch = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await searchConcepts({ q, limit: 10 });
        setResults(
          (res.items ?? []).filter(
            (c: Concept) => !excludeIds.includes(c.concept_id),
          ),
        );
      } finally {
        setSearching(false);
      }
    },
    [excludeIds],
  );

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      doSearch(debouncedQuery);
    } else {
      setResults([]);
    }
  }, [debouncedQuery, doSearch]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search concept to add..."
          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border-default bg-surface-overlay text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-accent/50"
        />
        {searching && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-text-muted" />
        )}
      </div>
      {results.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-overlay max-h-48 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.concept_id}
              type="button"
              onClick={() => {
                onSelect(c.concept_id);
                setQuery("");
                setResults([]);
              }}
              className="w-full px-3 py-2 text-left hover:bg-surface-elevated transition-colors border-b border-border-default last:border-b-0"
            >
              <span className="text-xs text-text-primary">{c.concept_name}</span>
              <span className="ml-2 text-[10px] text-accent">{c.concept_id}</span>
              <span className="ml-2 text-[10px] text-text-ghost">{c.vocabulary_id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const ALL_FIELDS = [
  "Concept Code",
  "Domain",
  "Vocabulary",
  "Concept Class",
  "Standard",
  "Valid Start",
  "Valid End",
  "Invalid Reason",
];

export function ConceptComparison() {
  const [searchParams, setSearchParams] = useSearchParams();
  const idsParam = searchParams.getAll("ids").map(Number).filter(Boolean);
  const [selectedIds, setSelectedIds] = useState<number[]>(
    idsParam.length >= 2 ? idsParam : [],
  );

  const { data: comparison, isLoading } = useConceptComparison(selectedIds);

  const addConcept = (id: number) => {
    if (selectedIds.length >= 4 || selectedIds.includes(id)) return;
    const next = [...selectedIds, id];
    setSelectedIds(next);
    setSearchParams({ ids: next.map(String) });
  };

  const removeConcept = (id: number) => {
    const next = selectedIds.filter((x) => x !== id);
    setSelectedIds(next);
    if (next.length >= 2) {
      setSearchParams({ ids: next.map(String) });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Compare Concepts</h1>
        <p className="mt-1 text-sm text-text-muted">
          Side-by-side comparison of 2-4 OMOP concepts with attributes, ancestors, and relationships
        </p>
      </div>

      {/* Add concept search */}
      {selectedIds.length < 4 && (
        <div className="max-w-md">
          <ConceptQuickSearch
            onSelect={addConcept}
            excludeIds={selectedIds}
          />
        </div>
      )}

      {/* Selected IDs pills */}
      {selectedIds.length > 0 && selectedIds.length < 2 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Selected:</span>
          {selectedIds.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-accent/15 text-accent">
              {id}
              <button type="button" onClick={() => removeConcept(id)}>
                <X size={10} />
              </button>
            </span>
          ))}
          <span className="text-[10px] text-text-ghost">Add at least one more to compare</span>
        </div>
      )}

      {/* Comparison cards */}
      {isLoading && selectedIds.length >= 2 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      )}

      {comparison && comparison.length >= 2 && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {comparison.map((entry) => (
            <ConceptCard
              key={entry.concept.concept_id}
              entry={entry}
              allFields={ALL_FIELDS}
              onRemove={() => removeConcept(entry.concept.concept_id)}
            />
          ))}
          {selectedIds.length < 4 && (
            <div className="shrink-0 w-48 flex items-center justify-center rounded-lg border border-dashed border-border-default bg-surface-raised">
              <div className="text-center">
                <Plus size={20} className="mx-auto text-surface-highlight mb-2" />
                <p className="text-[10px] text-text-ghost">Add concept</p>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedIds.length === 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-12 text-center">
          <Search size={32} className="mx-auto text-surface-highlight mb-4" />
          <p className="text-sm text-text-muted">Search for concepts to compare</p>
          <p className="mt-1 text-xs text-text-ghost">
            Select 2-4 concepts to see a side-by-side comparison of their attributes, ancestors, and relationships
          </p>
        </div>
      )}
    </div>
  );
}
