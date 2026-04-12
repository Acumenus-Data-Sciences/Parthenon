import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { useConceptSearch } from "../../../hooks/useNetworkData";
import type { ConceptSearchResult } from "../../../types/ares";

const CONCEPT_COLORS = ["#2DD4BF", "#C9A227", "#e85d75", "#7c8aed", "#59c990"];

interface MultiConceptSelectorProps {
  selectedConcepts: ConceptSearchResult[];
  onAdd: (concept: ConceptSearchResult) => void;
  onRemove: (conceptId: number) => void;
  maxConcepts?: number;
}

export default function MultiConceptSelector({
  selectedConcepts,
  onAdd,
  onRemove,
  maxConcepts = 5,
}: MultiConceptSelectorProps) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const { data: searchResults, isLoading } = useConceptSearch(query);

  const handleSelect = useCallback(
    (concept: ConceptSearchResult) => {
      if (selectedConcepts.length >= maxConcepts) return;
      if (selectedConcepts.some((c) => c.concept_id === concept.concept_id)) return;
      onAdd(concept);
      setQuery("");
      setShowDropdown(false);
    },
    [selectedConcepts, maxConcepts, onAdd],
  );

  return (
    <div className="space-y-2">
      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        {selectedConcepts.map((concept, i) => (
          <span
            key={concept.concept_id}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-text-primary"
            style={{ backgroundColor: `${CONCEPT_COLORS[i % CONCEPT_COLORS.length]}30`, borderColor: CONCEPT_COLORS[i % CONCEPT_COLORS.length], borderWidth: 1 }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: CONCEPT_COLORS[i % CONCEPT_COLORS.length] }}
            />
            {concept.concept_name}
            <button
              type="button"
              onClick={() => onRemove(concept.concept_id)}
              className="ml-1 rounded-full p-0.5 hover:bg-white/10"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      {/* Search input */}
      {selectedConcepts.length < maxConcepts && (
        <div className="relative">
          <input
            type="text"
            placeholder={`Add concept (${selectedConcepts.length}/${maxConcepts})...`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            className="w-full rounded-lg border border-[#333] bg-[#1a1a22] px-4 py-2 text-sm text-text-primary
                       placeholder-[#555] focus:border-[#C9A227] focus:outline-none"
          />
          {isLoading && (
            <span className="absolute right-3 top-2.5 text-xs text-[#555]">Searching...</span>
          )}

          {showDropdown && searchResults && searchResults.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[#333]
                          bg-[#1a1a22] shadow-xl">
              {searchResults
                .filter((c) => !selectedConcepts.some((sc) => sc.concept_id === c.concept_id))
                .map((concept) => (
                  <button
                    key={concept.concept_id}
                    type="button"
                    onClick={() => handleSelect(concept)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-[#252530]"
                  >
                    <span className="text-text-primary">{concept.concept_name}</span>
                    <span className="text-[10px] text-[#666]">
                      {concept.domain_id} | {concept.vocabulary_id} | ID: {concept.concept_id}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { CONCEPT_COLORS };
