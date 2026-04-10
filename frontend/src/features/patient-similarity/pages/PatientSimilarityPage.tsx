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
import { PropensityMatchResults } from "../components/PropensityMatchResults";
import { NetworkFusionResults } from "../components/NetworkFusionResults";
import { PatientLandscape } from "../components/PatientLandscape";
import { TrajectoryComparison } from "../components/TrajectoryComparison";
import {
  useSimilaritySearch,
  useCohortSimilaritySearch,
  useComputeStatus,
  useCompareCohorts,
  useCrossCohortSearch,
  usePropensityMatch,
  useComparePatients,
} from "../hooks/usePatientSimilarity";
import { projectPatientLandscape } from "../api/patientSimilarityApi";
import type {
  SimilaritySearchParams,
  CohortSimilaritySearchParams,
  CohortComparisonParams,
  CrossCohortSearchParams,
  LandscapeResult,
} from "../types/patientSimilarity";

type SimilarityMode = "auto" | "interpretable" | "embedding";
type SearchMode = "single" | "cohort" | "compare" | "landscape" | "headtohead";

function getMutationErrorMessage(error: unknown): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const response = "response" in error ? error.response : undefined;
  if (typeof response !== "object" || response === null) {
    return null;
  }

  const data = "data" in response ? response.data : undefined;
  if (typeof data !== "object" || data === null) {
    return null;
  }

  if ("error" in data && typeof data.error === "string" && data.error.trim() !== "") {
    return data.error;
  }

  if ("message" in data && typeof data.message === "string" && data.message.trim() !== "") {
    return data.message;
  }

  return null;
}

function HeadToHeadPanel({ personA, personB, sourceId }: { personA: number; personB: number; sourceId: number }) {
  const canCompare = personA > 0 && personB > 0 && personA !== personB && sourceId > 0;
  const { data: comparison, isLoading, isError, error } = useComparePatients(
    canCompare ? personA : 0,
    canCompare ? personB : 0,
    canCompare ? sourceId : 0,
  );

  if (!canCompare) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-24">
        <Users size={36} className="text-[#323238] mb-4" />
        <h3 className="text-lg font-semibold text-[#F0EDE8]">Head-to-Head Comparison</h3>
        <p className="mt-2 text-sm text-[#8A857D] max-w-md text-center">
          Enter two different patient IDs to compare them across all clinical dimensions with trajectory overlay.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-[#232328] bg-[#151518] py-16">
        <div className="text-sm text-[#5A5650]">Comparing patients...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-4 py-3">
        <p className="text-sm text-[#E85A6B]">
          {error instanceof Error ? error.message : "Comparison failed."}
        </p>
      </div>
    );
  }

  if (!comparison) return null;

  const scores = comparison.scores ?? {};
  const dimScores = (typeof scores.dimension_scores === "object" && scores.dimension_scores !== null)
    ? scores.dimension_scores as Record<string, number | null>
    : {};
  const overallScore = typeof scores.overall_score === "number" ? scores.overall_score : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#F0EDE8]">
            Patient {personA} vs Patient {personB}
          </h3>
          <div className="text-lg font-bold" style={{ color: overallScore >= 0.8 ? "#2DD4BF" : overallScore >= 0.5 ? "#C9A227" : "#8A857D" }}>
            {overallScore.toFixed(3)}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(dimScores).map(([dim, score]) => (
            <div key={dim} className="rounded border border-[#232328] bg-[#0E0E11] p-2.5">
              <div className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1">{dim}</div>
              <div className="text-sm font-medium" style={{ color: score != null && score >= 0.5 ? "#2DD4BF" : "#8A857D" }}>
                {score != null ? score.toFixed(3) : "N/A"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shared features */}
      {comparison.shared_features && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <h3 className="text-sm font-semibold text-[#F0EDE8] mb-3">Shared Features</h3>
          <div className="grid grid-cols-3 gap-4 text-xs">
            {["conditions", "drugs", "procedures"].map((domain) => {
              const items = comparison.shared_features?.[domain];
              const count = Array.isArray(items) ? items.length : 0;
              return (
                <div key={domain}>
                  <span className="text-[#5A5650] uppercase tracking-wider">{domain}</span>
                  <span className="ml-2 text-[#C5C0B8] font-medium">{count} shared</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trajectory comparison */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
        <TrajectoryComparison personAId={personA} personBId={personB} sourceId={sourceId} />
      </div>
    </div>
  );
}

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

  // Landscape state
  const [landscapeResult, setLandscapeResult] = useState<LandscapeResult | null>(null);
  const [landscapeLoading, setLandscapeLoading] = useState(false);
  const [landscapeError, setLandscapeError] = useState<string | null>(null);

  // Head-to-head state
  const [h2hPersonA, setH2hPersonA] = useState<number>(0);
  const [h2hPersonB, setH2hPersonB] = useState<number>(0);

  const searchMutation = useSimilaritySearch();
  const cohortSearchMutation = useCohortSimilaritySearch();
  const compareMutation = useCompareCohorts();
  const crossSearchMutation = useCrossCohortSearch();
  const psmMutation = usePropensityMatch();

  useEffect(() => {
    if (initialSourceId != null && initialSourceId > 0 && activeSourceId !== initialSourceId) {
      setActiveSource(initialSourceId);
    }
  }, [
    activeSourceId,
    initialSourceId,
    setActiveSource,
  ]);

  const handleSourceChange = (nextSourceId: number) => {
    setSelectedSourceId(nextSourceId);

    if (nextSourceId > 0 && nextSourceId !== activeSourceId) {
      setActiveSource(nextSourceId);
    }
  };

  const sourceId =
    selectedSourceId > 0
      ? selectedSourceId
      : initialSourceId ?? activeSourceId ?? defaultSourceId ?? 0;

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
  const isLoading =
    searchMode === "compare"
      ? compareMutation.isPending || crossSearchMutation.isPending
      : activeMutation.isPending;
  const isError =
    searchMode === "compare"
      ? compareMutation.isError || crossSearchMutation.isError
      : activeMutation.isError;
  const errorMessage =
    searchMode === "compare"
      ? getMutationErrorMessage(compareMutation.error) ??
        getMutationErrorMessage(crossSearchMutation.error)
      : getMutationErrorMessage(activeMutation.error);

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
            {(["single", "cohort", "compare", "landscape", "headtohead"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSearchMode(m)}
                className={cn(
                  "flex-1 px-2 py-2 text-[10px] font-medium transition-colors",
                  searchMode === m
                    ? "bg-[#9B1B30]/10 text-[#9B1B30]"
                    : "bg-[#0E0E11] text-[#5A5650] hover:text-[#C5C0B8]",
                )}
              >
                {m === "single"
                  ? "Patient"
                  : m === "cohort"
                    ? "Cohort"
                    : m === "compare"
                      ? "Compare"
                      : m === "landscape"
                        ? "Landscape"
                        : "Head to Head"}
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
            ) : searchMode === "compare" ? (
              <CohortCompareForm
                onCompare={handleCompare}
                onCrossSearch={handleCrossSearch}
                isComparing={compareMutation.isPending}
                isSearching={crossSearchMutation.isPending}
                hasComparisonResult={compareMutation.data != null}
                sourceId={sourceId}
                onSourceChange={handleSourceChange}
              />
            ) : searchMode === "landscape" ? (
              <div className="space-y-3">
                <p className="text-xs text-[#8A857D]">
                  Project all patients into a 2D/3D scatter plot using UMAP. Proximity reflects multi-dimensional similarity.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    setLandscapeLoading(true);
                    setLandscapeError(null);
                    try {
                      const res = await projectPatientLandscape({
                        source_id: sourceId,
                        dimensions: 3,
                        max_patients: 2000,
                      });
                      setLandscapeResult(res);
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : "Projection failed";
                      setLandscapeError(msg);
                    } finally {
                      setLandscapeLoading(false);
                    }
                  }}
                  disabled={landscapeLoading || sourceId === 0}
                  className={cn(
                    "w-full px-3 py-2 text-xs font-medium rounded border transition-colors",
                    landscapeLoading
                      ? "text-[#5A5650] border-[#232328] cursor-wait"
                      : "text-[#2DD4BF] border-[#2DD4BF]/30 hover:bg-[#2DD4BF]/10",
                  )}
                >
                  {landscapeLoading ? "Projecting..." : "Generate Landscape"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#8A857D]">
                  Compare two patients head-to-head across all dimensions with trajectory overlay.
                </p>
                <input
                  type="number"
                  placeholder="Person A ID"
                  value={h2hPersonA || ""}
                  onChange={(e) => setH2hPersonA(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded border border-[#232328] bg-[#0E0E11] px-3 py-2 text-xs text-[#F0EDE8] placeholder-[#5A5650]"
                />
                <input
                  type="number"
                  placeholder="Person B ID"
                  value={h2hPersonB || ""}
                  onChange={(e) => setH2hPersonB(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded border border-[#232328] bg-[#0E0E11] px-3 py-2 text-xs text-[#F0EDE8] placeholder-[#5A5650]"
                />
              </div>
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
              {errorMessage ??
                (searchMode === "single"
                  ? "Search failed. Please verify the patient ID exists in this data source and try again."
                  : searchMode === "compare"
                    ? "Comparison failed. Please verify both cohorts are generated for this source and try again."
                    : "Search failed. Please verify the cohort has been generated for this source and try again.")}
            </p>
          </div>
        )}

        {/* Compare Cohorts visualization */}
        {searchMode === "compare" && compareMutation.data && (
          <div className="space-y-4">
            {/* Propensity Score Matching — top of comparison results */}
            <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#F0EDE8]">
                    Propensity Score Matching
                  </h3>
                  <p className="text-xs text-[#5A5650] mt-0.5">
                    Match patients between cohorts on estimated treatment probability for causal inference
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!compareMutation.data) return;
                    psmMutation.mutate({
                      source_id: sourceId,
                      target_cohort_id: compareMutation.data.source_cohort.cohort_definition_id,
                      comparator_cohort_id: compareMutation.data.target_cohort.cohort_definition_id,
                    });
                  }}
                  disabled={psmMutation.isPending}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded border transition-colors",
                    psmMutation.isPending
                      ? "text-[#5A5650] border-[#232328] cursor-wait"
                      : "text-[#2DD4BF] border-[#2DD4BF]/30 hover:bg-[#2DD4BF]/10 cursor-pointer",
                  )}
                >
                  {psmMutation.isPending ? "Computing..." : "Run PSM"}
                </button>
              </div>
            </div>

            {psmMutation.isError && (
              <div className="rounded-lg border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-4 py-3">
                <p className="text-sm text-[#E85A6B]">
                  {getMutationErrorMessage(psmMutation.error) ?? "Propensity score matching failed."}
                </p>
              </div>
            )}

            {psmMutation.data && (
              <PropensityMatchResults result={psmMutation.data} />
            )}

            <CohortComparisonRadar
              divergence={compareMutation.data.divergence}
              sourceName={compareMutation.data.source_cohort.name}
              targetName={compareMutation.data.target_cohort.name}
            />
            <DivergenceScores
              divergence={compareMutation.data.divergence}
              overallDivergence={compareMutation.data.overall_divergence}
            />
          </div>
        )}

        {/* Landscape mode */}
        {searchMode === "landscape" && (
          <div className="space-y-4">
            {landscapeError && (
              <div className="rounded-lg border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-4 py-3">
                <p className="text-sm text-[#E85A6B]">{landscapeError}</p>
              </div>
            )}
            {landscapeResult && (
              <div className="rounded-lg border border-[#232328] bg-[#0E0E11]" style={{ height: 600 }}>
                <PatientLandscape
                  points={landscapeResult.points}
                  clusters={landscapeResult.clusters ?? []}
                  stats={landscapeResult.stats ?? { n_patients: landscapeResult.points.length, dimensions: 3, n_clusters: 0 }}
                />
              </div>
            )}
            {!landscapeResult && !landscapeLoading && !landscapeError && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-24">
                <Users size={36} className="text-[#323238] mb-4" />
                <h3 className="text-lg font-semibold text-[#F0EDE8]">Patient Landscape</h3>
                <p className="mt-2 text-sm text-[#8A857D] max-w-md text-center">
                  Click &quot;Generate Landscape&quot; to project patients into a 3D scatter plot using UMAP dimensionality reduction.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Head-to-head mode */}
        {searchMode === "headtohead" && (
          <HeadToHeadPanel personA={h2hPersonA} personB={h2hPersonB} sourceId={sourceId} />
        )}

        {/* Network Fusion (cohort mode) */}
        {searchMode === "cohort" && cohortDefinitionId > 0 && sourceId > 0 && (
          <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
            <NetworkFusionResults
              sourceId={sourceId}
              cohortDefinitionId={cohortDefinitionId}
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
