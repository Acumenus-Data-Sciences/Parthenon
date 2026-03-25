import { useState, useCallback } from "react";
import { useConceptComparison, useConceptSearch } from "../../../hooks/useNetworkData";
import ComparisonChart from "./ComparisonChart";
import type { ConceptSearchResult } from "../../../types/ares";

export default function ConceptComparisonView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConcept, setSelectedConcept] = useState<ConceptSearchResult | null>(null);
  const [metric, setMetric] = useState<"count" | "rate_per_1000">("rate_per_1000");
  const [showResults, setShowResults] = useState(false);

  const { data: searchResults, isLoading: searchLoading } = useConceptSearch(searchQuery);
  const { data: comparison, isLoading: comparisonLoading } = useConceptComparison(
    selectedConcept?.concept_id ?? null,
  );

  const handleSelect = useCallback((concept: ConceptSearchResult) => {
    setSelectedConcept(concept);
    setSearchQuery(concept.concept_name);
    setShowResults(false);
  }, []);

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-medium text-white">Concept Comparison Across Sources</h2>

      {/* Search bar */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Search for a concept (e.g. 'Type 2 Diabetes', 'Metformin')..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className="w-full rounded-lg border border-[#333] bg-[#1a1a22] px-4 py-2.5 text-sm text-white
                     placeholder-[#555] focus:border-[#C9A227] focus:outline-none"
        />
        {searchLoading && (
          <span className="absolute right-3 top-3 text-xs text-[#555]">Searching...</span>
        )}

        {/* Search dropdown */}
        {showResults && searchResults && searchResults.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#333]
                        bg-[#1a1a22] shadow-xl">
            {searchResults.map((concept) => (
              <button
                key={concept.concept_id}
                type="button"
                onClick={() => handleSelect(concept)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-[#252530]"
              >
                <span className="text-white">{concept.concept_name}</span>
                <span className="text-[10px] text-[#666]">
                  {concept.domain_id} | {concept.vocabulary_id} | ID: {concept.concept_id}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected concept info + metric toggle */}
      {selectedConcept && (
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-white">{selectedConcept.concept_name}</p>
            <p className="text-[11px] text-[#666]">
              {selectedConcept.domain_id} | {selectedConcept.vocabulary_id} | Concept ID: {selectedConcept.concept_id}
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-[#333] p-0.5">
            <button
              type="button"
              onClick={() => setMetric("rate_per_1000")}
              className={`rounded px-3 py-1 text-xs ${
                metric === "rate_per_1000" ? "bg-[#C9A227] text-black" : "text-[#888]"
              }`}
            >
              Rate/1000
            </button>
            <button
              type="button"
              onClick={() => setMetric("count")}
              className={`rounded px-3 py-1 text-xs ${
                metric === "count" ? "bg-[#C9A227] text-black" : "text-[#888]"
              }`}
            >
              Count
            </button>
          </div>
        </div>
      )}

      {/* Comparison chart */}
      {comparisonLoading && <p className="text-[#555]">Loading comparison data...</p>}

      {comparison && (
        <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
          <ComparisonChart data={comparison} metric={metric} />
        </div>
      )}

      {!selectedConcept && (
        <p className="py-10 text-center text-[#555]">
          Search for a concept above to compare its prevalence across all data sources.
        </p>
      )}
    </div>
  );
}
