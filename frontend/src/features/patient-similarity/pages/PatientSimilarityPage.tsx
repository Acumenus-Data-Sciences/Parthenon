import { useSearchParams } from "react-router-dom";
import { Users, Clock, Target } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useSourceStore } from "@/stores/sourceStore";
import { SimilaritySearchForm } from "../components/SimilaritySearchForm";
import { SimilarPatientTable } from "../components/SimilarPatientTable";
import { SimilarityModeToggle } from "../components/SimilarityModeToggle";
import { StalenessIndicator } from "../components/StalenessIndicator";
import { useSimilaritySearch } from "../hooks/usePatientSimilarity";
import type { SimilaritySearchParams } from "../types/patientSimilarity";

type SimilarityMode = "interpretable" | "embedding";

export default function PatientSimilarityPage() {
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAuthStore();
  const { activeSourceId, defaultSourceId } = useSourceStore();
  const showPersonId = hasPermission("profiles.view");

  const initialPersonId = searchParams.get("person_id")
    ? parseInt(searchParams.get("person_id") as string, 10)
    : undefined;
  const initialSourceId = searchParams.get("source_id")
    ? parseInt(searchParams.get("source_id") as string, 10)
    : undefined;

  // Parse initial weights from query params (format: w_demographics=2.0&w_conditions=3.0)
  const initialWeights: Record<string, number> = {};
  searchParams.forEach((value, key) => {
    if (key.startsWith("w_")) {
      const dimKey = key.slice(2);
      const numVal = parseFloat(value);
      if (!isNaN(numVal)) initialWeights[dimKey] = numVal;
    }
  });

  const [mode, setMode] = useState<SimilarityMode>("interpretable");
  const [lastSearchParams, setLastSearchParams] =
    useState<SimilaritySearchParams | null>(null);

  const searchMutation = useSimilaritySearch();
  const sourceId =
    lastSearchParams?.source_id ??
    initialSourceId ??
    activeSourceId ??
    defaultSourceId ??
    0;

  const handleSearch = (params: SimilaritySearchParams) => {
    const withMode = { ...params, mode };
    setLastSearchParams(withMode);
    searchMutation.mutate(withMode);
  };

  const result = searchMutation.data;
  const metadata = result?.metadata ?? {};
  const computedInMs = typeof metadata.computed_in_ms === "number" ? metadata.computed_in_ms : null;
  const candidatesEvaluated =
    typeof metadata.candidates_evaluated === "number" ? metadata.candidates_evaluated : null;

  return (
    <div className="flex gap-6 min-h-0">
      {/* Left Panel - Search Form */}
      <div className="w-80 shrink-0">
        <div className="sticky top-0 space-y-4">
          <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
            <SimilaritySearchForm
              onSearch={handleSearch}
              isLoading={searchMutation.isPending}
              initialPersonId={initialPersonId}
              initialSourceId={initialSourceId}
              initialWeights={
                Object.keys(initialWeights).length > 0
                  ? initialWeights
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* Right Panel - Results */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="page-title">Patient Similarity</h1>
            <SimilarityModeToggle mode={mode} onChange={setMode} />
          </div>
          <div className="flex items-center gap-3">
            {sourceId > 0 && <StalenessIndicator sourceId={sourceId} />}
          </div>
        </div>

        {/* Results header bar */}
        {result && (
          <div className="flex items-center justify-between rounded-lg border border-[#232328] bg-[#151518] px-4 py-2.5">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-[#C5C0B8]">
                <Users size={14} className="text-[#2DD4BF]" />
                <span className="font-medium">{result.similar_patients.length}</span>
                <span className="text-[#5A5650]">results</span>
              </div>
              {candidatesEvaluated !== null && (
                <div className="flex items-center gap-1.5 text-xs text-[#5A5650]">
                  <Target size={12} />
                  {candidatesEvaluated.toLocaleString()} candidates
                </div>
              )}
              {computedInMs !== null && (
                <div className="flex items-center gap-1.5 text-xs text-[#5A5650]">
                  <Clock size={12} />
                  {computedInMs}ms
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[#5A5650] uppercase tracking-wider">
                Mode: {result.mode}
              </span>
              <button
                type="button"
                disabled
                className="text-xs text-[#5A5650] border border-[#232328] rounded px-2.5 py-1 cursor-not-allowed opacity-50"
                title="Coming in Phase 4"
              >
                Export as Cohort
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {searchMutation.isError && (
          <div className="rounded-lg border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-4 py-3">
            <p className="text-sm text-[#E85A6B]">
              Search failed. Please verify the patient ID exists in this data
              source and try again.
            </p>
          </div>
        )}

        {/* Results table */}
        {result ? (
          <SimilarPatientTable
            patients={result.similar_patients}
            showPersonId={showPersonId}
            seedPersonId={result.seed.person_id}
            sourceId={lastSearchParams?.source_id}
          />
        ) : (
          !searchMutation.isPending && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-24">
              <Users size={36} className="text-[#323238] mb-4" />
              <h3 className="text-lg font-semibold text-[#F0EDE8]">
                Find Similar Patients
              </h3>
              <p className="mt-2 text-sm text-[#8A857D] max-w-md text-center">
                Enter a seed patient ID and configure dimension weights to
                discover clinically similar patients across the OMOP CDM.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
