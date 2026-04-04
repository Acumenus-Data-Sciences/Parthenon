import { useSearchParams } from "react-router-dom";
import { Users, Clock, Target, Download } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useSourceStore } from "@/stores/sourceStore";
import { SimilaritySearchForm } from "../components/SimilaritySearchForm";
import { SimilarPatientTable } from "../components/SimilarPatientTable";
import { SimilarityModeToggle } from "../components/SimilarityModeToggle";
import { StalenessIndicator } from "../components/StalenessIndicator";
import { CohortSeedForm } from "../components/CohortSeedForm";
import { CohortExportDialog } from "../components/CohortExportDialog";
import {
  useSimilaritySearch,
  useCohortSimilaritySearch,
  useComputeStatus,
} from "../hooks/usePatientSimilarity";
import type {
  SimilaritySearchParams,
  CohortSimilaritySearchParams,
} from "../types/patientSimilarity";

type SimilarityMode = "auto" | "interpretable" | "embedding";
type SearchMode = "single" | "cohort";

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

  const [mode, setMode] = useState<SimilarityMode>("auto");
  const [searchMode, setSearchMode] = useState<SearchMode>("single");
  const [lastSearchParams, setLastSearchParams] =
    useState<SimilaritySearchParams | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const searchMutation = useSimilaritySearch();
  const cohortSearchMutation = useCohortSimilaritySearch();

  const sourceId =
    lastSearchParams?.source_id ??
    initialSourceId ??
    activeSourceId ??
    defaultSourceId ??
    0;

  const { data: computeStatus } = useComputeStatus(sourceId || undefined);

  const handleSearch = (params: SimilaritySearchParams) => {
    const withMode = { ...params, mode };
    setLastSearchParams(withMode);
    searchMutation.mutate(withMode);
  };

  const handleCohortSearch = (params: CohortSimilaritySearchParams) => {
    const withMode = { ...params, mode };
    setLastSearchParams({
      person_id: 0, // placeholder for cohort-based search
      source_id: params.source_id,
      mode,
    });
    cohortSearchMutation.mutate(withMode);
  };

  // Use whichever mutation has data
  const activeMutation =
    searchMode === "cohort" ? cohortSearchMutation : searchMutation;
  const result = activeMutation.data;
  const isLoading = activeMutation.isPending;
  const isError = activeMutation.isError;

  const metadata = result?.metadata ?? {};
  const computedInMs =
    typeof metadata.computed_in_ms === "number" ? metadata.computed_in_ms : null;
  const candidatesEvaluated =
    typeof metadata.candidates_evaluated === "number"
      ? metadata.candidates_evaluated
      : null;
  const cacheId =
    typeof metadata.cache_id === "number" ? metadata.cache_id : 0;

  return (
    <div className="flex gap-6 min-h-0">
      {/* Left Panel - Search Form */}
      <div className="w-80 shrink-0">
        <div className="sticky top-0 space-y-4">
          {/* Search Mode Toggle */}
          <div className="flex rounded-lg border border-[#232328] overflow-hidden">
            {(["single", "cohort"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSearchMode(m)}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                  searchMode === m
                    ? "bg-[#9B1B30]/10 text-[#9B1B30]"
                    : "bg-[#0E0E11] text-[#5A5650] hover:text-[#C5C0B8]",
                )}
              >
                {m === "single" ? "Single Patient" : "From Cohort"}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
            {searchMode === "single" ? (
              <SimilaritySearchForm
                onSearch={handleSearch}
                isLoading={isLoading}
                initialPersonId={initialPersonId}
                initialSourceId={initialSourceId}
                initialWeights={
                  Object.keys(initialWeights).length > 0
                    ? initialWeights
                    : undefined
                }
              />
            ) : (
              <CohortSeedForm
                onSearch={handleCohortSearch}
                sourceId={sourceId}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Results */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="page-title">Patient Similarity</h1>
            <SimilarityModeToggle
              mode={mode}
              onChange={setMode}
              recommendedMode={computeStatus?.recommended_mode}
            />
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
                <span className="font-medium">
                  {result.similar_patients.length}
                </span>
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
                onClick={() => setExportOpen(true)}
                disabled={result.similar_patients.length === 0}
                className={cn(
                  "flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors",
                  result.similar_patients.length > 0
                    ? "text-[#2DD4BF] border-[#2DD4BF]/30 hover:bg-[#2DD4BF]/10 cursor-pointer"
                    : "text-[#5A5650] border-[#232328] cursor-not-allowed opacity-50",
                )}
              >
                <Download size={12} />
                Export as Cohort
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="rounded-lg border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-4 py-3">
            <p className="text-sm text-[#E85A6B]">
              Search failed. Please verify the{" "}
              {searchMode === "single"
                ? "patient ID exists in this data source"
                : "cohort has been generated for this source"}{" "}
              and try again.
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
          !isLoading && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-24">
              <Users size={36} className="text-[#323238] mb-4" />
              <h3 className="text-lg font-semibold text-[#F0EDE8]">
                Find Similar Patients
              </h3>
              <p className="mt-2 text-sm text-[#8A857D] max-w-md text-center">
                {searchMode === "single"
                  ? "Enter a seed patient ID and configure dimension weights to discover clinically similar patients across the OMOP CDM."
                  : "Select an existing cohort to find patients similar to the cohort profile across the OMOP CDM."}
              </p>
            </div>
          )
        )}
      </div>

      {/* Export Dialog */}
      <CohortExportDialog
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        cacheId={cacheId}
        patients={result?.similar_patients ?? []}
      />
    </div>
  );
}
