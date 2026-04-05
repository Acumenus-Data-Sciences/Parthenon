import { useSearchParams } from "react-router-dom";
import { Users, Clock, Target, Download, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useSourceStore } from "@/stores/sourceStore";
import { SimilaritySearchForm } from "../components/SimilaritySearchForm";
import { SimilarPatientTable } from "../components/SimilarPatientTable";
import { SimilarityModeToggle } from "../components/SimilarityModeToggle";
import { StalenessIndicator } from "../components/StalenessIndicator";
import { CohortSeedForm } from "../components/CohortSeedForm";
import { CohortExportDialog } from "../components/CohortExportDialog";
import { CohortExpandDialog } from "../components/CohortExpandDialog";
import { ResultCohortDiagnosticsPanel } from "../components/ResultCohortDiagnosticsPanel";
import { SearchDiagnosticsPanel } from "../components/SearchDiagnosticsPanel";
import { CohortCompareForm } from "../components/CohortCompareForm";
import { CohortComparisonRadar } from "../components/CohortComparisonRadar";
import { DivergenceScores } from "../components/DivergenceScores";
import {
  useSimilaritySearch,
  useCohortSimilaritySearch,
  useComputeStatus,
  useCompareCohorts,
  useCrossCohortSearch,
} from "../hooks/usePatientSimilarity";
import type {
  SimilaritySearchParams,
  CohortSimilaritySearchParams,
  CohortComparisonParams,
  CrossCohortSearchParams,
} from "../types/patientSimilarity";

type SimilarityMode = "auto" | "interpretable" | "embedding";
type SearchMode = "single" | "cohort" | "compare";

export default function PatientSimilarityPage() {
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAuthStore();
  const { activeSourceId, defaultSourceId, setActiveSource } = useSourceStore();
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
  const [selectedSourceId, setSelectedSourceId] = useState(
    initialSourceId ?? activeSourceId ?? defaultSourceId ?? 0,
  );
  const [lastSearchParams, setLastSearchParams] =
    useState<SimilaritySearchParams | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);

  const searchMutation = useSimilaritySearch();
  const cohortSearchMutation = useCohortSimilaritySearch();
  const compareMutation = useCompareCohorts();
  const crossSearchMutation = useCrossCohortSearch();

  useEffect(() => {
    const nextSourceId =
      initialSourceId ?? activeSourceId ?? defaultSourceId ?? 0;

    if (nextSourceId > 0 && selectedSourceId !== nextSourceId) {
      setSelectedSourceId(nextSourceId);
    }

    if (nextSourceId > 0 && activeSourceId !== nextSourceId) {
      setActiveSource(nextSourceId);
    }
  }, [
    activeSourceId,
    defaultSourceId,
    initialSourceId,
    selectedSourceId,
    setActiveSource,
  ]);

  const handleSourceChange = (nextSourceId: number) => {
    setSelectedSourceId(nextSourceId);

    if (nextSourceId > 0 && nextSourceId !== activeSourceId) {
      setActiveSource(nextSourceId);
    }
  };

  const sourceId = selectedSourceId;

  const { data: computeStatus } = useComputeStatus(sourceId);

  const handleSearch = (params: SimilaritySearchParams) => {
    const withMode = { ...params, mode };
    handleSourceChange(params.source_id);
    setLastSearchParams(withMode);
    searchMutation.mutate(withMode);
  };

  const handleCohortSearch = (params: CohortSimilaritySearchParams) => {
    const withMode = { ...params, mode };
    handleSourceChange(params.source_id);
    setLastSearchParams({
      person_id: 0, // placeholder for cohort-based search
      source_id: params.source_id,
      mode,
    });
    cohortSearchMutation.mutate(withMode);
  };

  const handleCompare = (params: CohortComparisonParams) => {
    handleSourceChange(params.source_id);
    compareMutation.mutate(params);
  };

  const handleCrossSearch = (params: CrossCohortSearchParams) => {
    handleSourceChange(params.source_id);
    crossSearchMutation.mutate(params);
    setLastSearchParams({
      person_id: 0,
      source_id: params.source_id,
      mode,
    });
  };

  // Use whichever mutation has data
  const activeMutation =
    searchMode === "compare"
      ? crossSearchMutation
      : searchMode === "cohort"
        ? cohortSearchMutation
        : searchMutation;
  const rawResult = activeMutation.data;
  const isLoading = activeMutation.isPending;
  const isError = activeMutation.isError;

  // Normalize result: API may return [] for empty cohorts or an object with similar_patients
  const result =
    rawResult && !Array.isArray(rawResult) && typeof rawResult === "object"
      ? rawResult
      : undefined;
  const patients = result?.similar_patients ?? [];

  const metadata = result?.metadata ?? {};
  const computedInMs = typeof metadata.computed_in_ms === "number" ? metadata.computed_in_ms : null;
  const candidatesEvaluated =
    typeof metadata.candidates_evaluated === "number"
      ? metadata.candidates_evaluated
      : typeof metadata.total_candidates === "number"
        ? metadata.total_candidates
        : null;
  const cacheId = typeof metadata.cache_id === "number" ? metadata.cache_id : 0;

  const cohortName = typeof metadata.cohort_name === "string" ? metadata.cohort_name : undefined;
  const cohortMemberCount = typeof metadata.cohort_member_count === "number" ? metadata.cohort_member_count : 0;
  const cohortDefinitionId = typeof metadata.cohort_definition_id === "number" ? metadata.cohort_definition_id : 0;
  const hasCompareInsights = searchMode === "compare" && compareMutation.data != null;
  const shouldShowEmptyState = !result && !isLoading && !hasCompareInsights;
  const canExport = patients.length > 0 && cacheId > 0;

  return (
    <div className="flex gap-6 min-h-0">
      {/* Left Panel - Search Form */}
      <div className="w-80 shrink-0">
        <div className="sticky top-0 space-y-4">
          {/* Search Mode Toggle */}
          <div className="flex rounded-lg border border-[#232328] overflow-hidden">
            {(["single", "cohort", "compare"] as const).map((m) => (
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
                {m === "single"
                  ? "Single Patient"
                  : m === "cohort"
                    ? "From Cohort"
                    : "Compare Cohorts"}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
            {searchMode === "single" ? (
              <SimilaritySearchForm
                onSearch={handleSearch}
                isLoading={isLoading}
                sourceId={sourceId}
                onSourceChange={handleSourceChange}
                initialPersonId={initialPersonId}
                initialWeights={
                  Object.keys(initialWeights).length > 0
                    ? initialWeights
                    : undefined
                }
              />
            ) : searchMode === "cohort" ? (
              <CohortSeedForm
                onSearch={handleCohortSearch}
                isLoading={isLoading}
                sourceId={sourceId}
                onSourceChange={handleSourceChange}
              />
            ) : (
              <CohortCompareForm
                onCompare={handleCompare}
                onCrossSearch={handleCrossSearch}
                isComparing={compareMutation.isPending}
                isSearching={crossSearchMutation.isPending}
                hasComparisonResult={compareMutation.data != null}
                sourceId={sourceId}
                onSourceChange={handleSourceChange}
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
                  {patients.length}
                </span>
                <span className="text-[#5A5650]">results</span>
              </div>
              {cohortName && (
                <div className="flex items-center gap-1.5 text-xs text-[#5A5650]">
                  <span>Seed:</span>
                  <span className="font-medium text-[#C5C0B8]">{cohortName}</span>
                  <span>({cohortMemberCount} members)</span>
                </div>
              )}
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
                disabled={!canExport}
                className={cn(
                  "flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors",
                  canExport
                    ? "text-[#2DD4BF] border-[#2DD4BF]/30 hover:bg-[#2DD4BF]/10 cursor-pointer"
                    : "text-[#5A5650] border-[#232328] cursor-not-allowed opacity-50",
                )}
              >
                <Download size={12} />
                Export as Cohort
              </button>
              {searchMode === "cohort" && cohortName && (
                <button
                  type="button"
                  onClick={() => setExpandOpen(true)}
                  disabled={patients.length === 0}
                  className={cn(
                    "flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors",
                    patients.length > 0
                      ? "text-[#C9A227] border-[#C9A227]/30 hover:bg-[#C9A227]/10 cursor-pointer"
                      : "text-[#5A5650] border-[#232328] cursor-not-allowed opacity-50",
                  )}
                >
                  <UserPlus size={12} />
                  Add to {cohortName}
                </button>
              )}
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

        {/* Compare Cohorts visualization */}
        {searchMode === "compare" && compareMutation.data && (
          <div className="space-y-4">
            <CohortComparisonRadar
              sourceDimensions={compareMutation.data.source_cohort.dimensions}
              targetDimensions={compareMutation.data.target_cohort.dimensions}
              sourceName={compareMutation.data.source_cohort.name}
              targetName={compareMutation.data.target_cohort.name}
            />
            <DivergenceScores
              divergence={compareMutation.data.divergence}
              overallDivergence={compareMutation.data.overall_divergence}
            />
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <SearchDiagnosticsPanel
              metadata={metadata}
              seed={result.seed}
              computeStatus={computeStatus}
            />
            {metadata.diagnostics && (
              <ResultCohortDiagnosticsPanel diagnostics={metadata.diagnostics} />
            )}
          </div>
        )}

        {/* Results table */}
        {result ? (
          <SimilarPatientTable
            patients={patients}
            showPersonId={showPersonId}
            seedPersonId={result?.seed?.person_id}
            sourceId={lastSearchParams?.source_id}
          />
        ) : hasCompareInsights ? (
          <div className="rounded-lg border border-dashed border-[#323238] bg-[#151518] px-6 py-10">
            <h3 className="text-base font-semibold text-[#F0EDE8]">
              Cohort Profiles Compared
            </h3>
            <p className="mt-2 text-sm text-[#8A857D] max-w-2xl">
              Review the radar chart and divergence scores above, then use
              <span className="text-[#C5C0B8]"> Find Matching Patients</span> to
              search for patients outside both cohorts who resemble the source
              cohort profile.
            </p>
          </div>
        ) : (
          shouldShowEmptyState && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-24">
              <Users size={36} className="text-[#323238] mb-4" />
              <h3 className="text-lg font-semibold text-[#F0EDE8]">
                Find Similar Patients
              </h3>
              <p className="mt-2 text-sm text-[#8A857D] max-w-md text-center">
                {searchMode === "single"
                  ? "Enter a seed patient ID and configure dimension weights to discover clinically similar patients across the OMOP CDM."
                  : searchMode === "cohort"
                    ? "Select an existing cohort to find patients similar to the cohort profile across the OMOP CDM."
                    : "Select two cohorts to compare their clinical profiles and identify divergence across OMOP dimensions."}
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
        patients={patients}
      />

      {/* Expand Dialog */}
      <CohortExpandDialog
        isOpen={expandOpen}
        onClose={() => setExpandOpen(false)}
        cohortDefinitionId={cohortDefinitionId}
        cohortName={cohortName ?? "Cohort"}
        sourceId={sourceId}
        currentMemberCount={cohortMemberCount}
        patients={patients}
      />
    </div>
  );
}
