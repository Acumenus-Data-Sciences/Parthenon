import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useConceptSearch } from "../../../hooks/useNetworkData";
import type { ConceptSearchResult } from "../../../types/ares";

const CONCEPT_COLORS = ["var(--success)", "var(--accent)", "var(--critical)", "#7c8aed", "#59c990"];

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
  const { t } = useTranslation("app");
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
            placeholder={t("dataExplorer.ares.conceptComparison.addConceptPlaceholder", {
              selected: selectedConcepts.length,
              max: maxConcepts,
            })}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            className="w-full rounded-lg border border-border-default bg-surface-overlay px-4 py-2 text-sm text-text-primary
                       placeholder:text-text-ghost focus:border-accent focus:outline-none"
          />
          {isLoading && (
            <span className="absolute right-3 top-2.5 text-xs text-text-ghost">
              {t("dataExplorer.ares.conceptComparison.messages.searching")}
            </span>
          )}

          {showDropdown && searchResults && searchResults.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border-default
                          bg-surface-overlay shadow-xl">
              {searchResults
                .filter((c) => !selectedConcepts.some((sc) => sc.concept_id === c.concept_id))
                .map((concept) => (
                  <button
                    key={concept.concept_id}
                    type="button"
                    onClick={() => handleSelect(concept)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-surface-accent"
                  >
                    <span className="text-text-primary">{concept.concept_name}</span>
                    <span className="text-[10px] text-text-ghost">
                      {t("dataExplorer.ares.conceptComparison.conceptMetadata", {
                        domain: concept.domain_id,
                        vocabulary: concept.vocabulary_id,
                        id: concept.concept_id,
                      })}
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
