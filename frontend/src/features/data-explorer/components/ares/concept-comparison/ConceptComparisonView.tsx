import { useState, useCallback } from "react";
import {
  useConceptComparison,
  useConceptSearch,
  useMultiConceptComparison,
  useAttritionFunnel,
  useTemporalPrevalence,
  useStandardizedComparison,
} from "../../../hooks/useNetworkData";
import ComparisonChart from "./ComparisonChart";
import TemporalPrevalenceChart from "./TemporalPrevalenceChart";
import MultiConceptSelector from "./MultiConceptSelector";
import AttritionFunnel from "./AttritionFunnel";
import type { ConceptSearchResult } from "../../../types/ares";

type ViewMode = "single" | "temporal" | "multi" | "funnel";
type RateMode = "crude" | "standardized";

export default function ConceptComparisonView() {
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConcept, setSelectedConcept] = useState<ConceptSearchResult | null>(null);
  const [selectedConcepts, setSelectedConcepts] = useState<ConceptSearchResult[]>([]);
  const [metric, setMetric] = useState<"count" | "rate_per_1000">("rate_per_1000");
  const [rateMode, setRateMode] = useState<RateMode>("crude");
  const [showResults, setShowResults] = useState(false);

  const { data: searchResults, isLoading: searchLoading } = useConceptSearch(searchQuery);
  const { data: comparison, isLoading: comparisonLoading } = useConceptComparison(
    selectedConcept?.concept_id ?? null,
  );
  const { data: temporalData, isLoading: temporalLoading } = useTemporalPrevalence(
    selectedConcept?.concept_id ?? null,
  );
  const { data: standardizedData, isLoading: standardizedLoading } = useStandardizedComparison(
    selectedConcept?.concept_id ?? null,
    rateMode === "standardized" && viewMode === "single",
  );

  const multiConceptIds = selectedConcepts.map((c) => c.concept_id);
  const { data: multiComparison, isLoading: multiLoading } = useMultiConceptComparison(multiConceptIds);
  const { data: funnelData, isLoading: funnelLoading } = useAttritionFunnel(multiConceptIds);

  const handleSelect = useCallback((concept: ConceptSearchResult) => {
    setSelectedConcept(concept);
    setSearchQuery(concept.concept_name);
    setShowResults(false);
  }, []);

  const handleAddConcept = useCallback((concept: ConceptSearchResult) => {
    setSelectedConcepts((prev) => [...prev, concept]);
  }, []);

  const handleRemoveConcept = useCallback((conceptId: number) => {
    setSelectedConcepts((prev) => prev.filter((c) => c.concept_id !== conceptId));
  }, []);

  // Extract sources and benchmark from new response shape
  const comparisonSources = comparison?.sources ?? [];
  const benchmarkRate = comparison?.benchmark_rate ?? null;

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Concept Comparison Across Sources</h2>

        {/* View mode toggle */}
        <div className="flex gap-1 rounded-lg border border-[#333] p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("single")}
            className={`rounded px-3 py-1 text-xs ${
              viewMode === "single" ? "bg-[#2DD4BF] text-black" : "text-[#888]"
            }`}
          >
            Single
          </button>
          <button
            type="button"
            onClick={() => setViewMode("temporal")}
            className={`rounded px-3 py-1 text-xs ${
              viewMode === "temporal" ? "bg-[#2DD4BF] text-black" : "text-[#888]"
            }`}
          >
            Temporal
          </button>
          <button
            type="button"
            onClick={() => setViewMode("multi")}
            className={`rounded px-3 py-1 text-xs ${
              viewMode === "multi" ? "bg-[#2DD4BF] text-black" : "text-[#888]"
            }`}
          >
            Multi-Concept
          </button>
          <button
            type="button"
            onClick={() => setViewMode("funnel")}
            className={`rounded px-3 py-1 text-xs ${
              viewMode === "funnel" ? "bg-[#2DD4BF] text-black" : "text-[#888]"
            }`}
          >
            Attrition Funnel
          </button>
        </div>
      </div>

      {/* Multi-concept and funnel modes share the chip selector */}
      {(viewMode === "multi" || viewMode === "funnel") && (
        <div className="mb-4">
          <MultiConceptSelector
            selectedConcepts={selectedConcepts}
            onAdd={handleAddConcept}
            onRemove={handleRemoveConcept}
          />
          {selectedConcepts.length < 2 && (
            <p className="mt-2 text-xs text-[#555]">
              Select at least 2 concepts to compare.
            </p>
          )}
        </div>
      )}

      {/* Single and Temporal modes share the concept search bar */}
      {(viewMode === "single" || viewMode === "temporal") && (
        <>
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

          {selectedConcept && (
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-white">{selectedConcept.concept_name}</p>
                <p className="text-[11px] text-[#666]">
                  {selectedConcept.domain_id} | {selectedConcept.vocabulary_id} | Concept ID: {selectedConcept.concept_id}
                </p>
              </div>
              {viewMode === "single" && (
                <div className="flex items-center gap-3">
                  {/* Rate mode toggle: Crude / Age-Sex Adjusted */}
                  {metric === "rate_per_1000" && (
                    <div className="flex gap-1 rounded-lg border border-[#333] p-0.5">
                      <button
                        type="button"
                        onClick={() => setRateMode("crude")}
                        className={`rounded px-3 py-1 text-xs ${
                          rateMode === "crude" ? "bg-[#2DD4BF] text-black" : "text-[#888]"
                        }`}
                      >
                        Crude Rate
                      </button>
                      <button
                        type="button"
                        onClick={() => setRateMode("standardized")}
                        className={`rounded px-3 py-1 text-xs ${
                          rateMode === "standardized" ? "bg-[#2DD4BF] text-black" : "text-[#888]"
                        }`}
                      >
                        Age-Sex Adjusted
                      </button>
                    </div>
                  )}
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
            </div>
          )}
        </>
      )}

      {/* Single concept bar chart */}
      {viewMode === "single" && (
        <>
          {(comparisonLoading || standardizedLoading) && (
            <p className="text-[#555]">Loading comparison data...</p>
          )}

          {rateMode === "standardized" && standardizedData && (
            <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
              <ComparisonChart
                data={standardizedData.map((s) => ({
                  source_id: s.source_id,
                  source_name: s.source_name,
                  count: s.person_count,
                  rate_per_1000: s.standardized_rate,
                  person_count: s.person_count,
                  ci_lower: s.ci_lower,
                  ci_upper: s.ci_upper,
                }))}
                metric={metric}
                benchmarkRate={benchmarkRate}
              />
              <p className="mt-2 text-[10px] text-[#555]">
                Standardized to US Census 2020 population using direct age-sex standardization.
              </p>
              {standardizedData.some((s) => s.warning) && (
                <div className="mt-1 space-y-0.5">
                  {standardizedData
                    .filter((s) => s.warning)
                    .map((s) => (
                      <p key={s.source_id} className="text-[10px] text-[#C9A227]">
                        {s.source_name}: {s.warning}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}

          {rateMode === "crude" && comparison && (
            <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
              <ComparisonChart data={comparisonSources} metric={metric} benchmarkRate={benchmarkRate} />
            </div>
          )}

          {!selectedConcept && (
            <p className="py-10 text-center text-[#555]">
              Search for a concept above to compare its prevalence across all data sources.
            </p>
          )}
        </>
      )}

      {/* Temporal prevalence line chart */}
      {viewMode === "temporal" && (
        <>
          {temporalLoading && <p className="text-[#555]">Loading temporal prevalence...</p>}

          {temporalData && temporalData.sources.length > 0 && (
            <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
              <TemporalPrevalenceChart
                sources={temporalData.sources}
                title={selectedConcept ? `Temporal Trend: ${selectedConcept.concept_name}` : undefined}
              />
            </div>
          )}

          {temporalData && temporalData.sources.length === 0 && selectedConcept && (
            <p className="py-10 text-center text-[#555]">
              No temporal data available for this concept.
            </p>
          )}

          {!selectedConcept && (
            <p className="py-10 text-center text-[#555]">
              Search for a concept above to view its temporal prevalence trend across releases.
            </p>
          )}
        </>
      )}

      {/* Multi-concept grouped bars */}
      {viewMode === "multi" && (
        <>
          {selectedConcepts.length >= 2 && (
            <div className="mb-4 flex justify-end">
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

          {multiLoading && <p className="text-[#555]">Loading multi-concept comparison...</p>}

          {multiComparison && (
            <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
              <ComparisonChart multiData={multiComparison} metric={metric} />
            </div>
          )}
        </>
      )}

      {/* Attrition funnel */}
      {viewMode === "funnel" && (
        <>
          {funnelLoading && <p className="text-[#555]">Loading attrition funnel...</p>}

          {funnelData && funnelData.length > 0 && (
            <AttritionFunnel data={funnelData} />
          )}

          {funnelData && funnelData.length === 0 && selectedConcepts.length >= 2 && (
            <p className="py-10 text-center text-[#555]">
              No attrition data available for the selected concepts.
            </p>
          )}
        </>
      )}
    </div>
  );
}
