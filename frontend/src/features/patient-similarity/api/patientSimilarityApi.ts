import apiClient from "@/lib/api-client";
import type {
  SimilarityDimension,
  SimilaritySearchParams,
  SimilaritySearchResult,
  ComputeStatus,
  CohortSimilaritySearchParams,
  CohortExportParams,
  CohortExportResult,
  CohortProfileResult,
  PatientComparisonResult,
  ExpandCohortParams,
  ExpandCohortResult,
  CohortComparisonParams,
  CohortComparisonResult,
  CrossCohortSearchParams,
  PropensityMatchParams,
  PropensityMatchResult,
  NetworkFusionParams,
  NetworkFusionResult,
  LandscapeParams,
  LandscapeResult,
  TemporalSimilarityResult,
} from "../types/patientSimilarity";

export async function searchSimilarPatients(
  params: SimilaritySearchParams,
): Promise<SimilaritySearchResult> {
  const { data } = await apiClient.post("/patient-similarity/search", params);
  return data.data ?? data;
}

export async function fetchDimensions(): Promise<SimilarityDimension[]> {
  const { data } = await apiClient.get("/patient-similarity/dimensions");
  return data.data ?? data;
}

export async function fetchComputeStatus(
  sourceId: number,
): Promise<ComputeStatus> {
  const { data } = await apiClient.get(
    `/patient-similarity/status/${sourceId}`,
  );
  return data.data ?? data;
}

export async function triggerCompute(
  sourceId: number,
  force?: boolean,
): Promise<{ status: string; message?: string }> {
  const { data } = await apiClient.post("/patient-similarity/compute", {
    source_id: sourceId,
    force: force ?? false,
  });
  return data;
}

// ── Cohort Integration ────────────────────────────────────────────

export async function searchFromCohort(
  params: CohortSimilaritySearchParams,
): Promise<SimilaritySearchResult> {
  const { data } = await apiClient.post(
    "/patient-similarity/search-from-cohort",
    params,
  );
  return data.data ?? data;
}

export async function exportCohort(
  params: CohortExportParams,
): Promise<CohortExportResult> {
  const { data } = await apiClient.post(
    "/patient-similarity/export-cohort",
    params,
  );
  return data.data ?? data;
}

// ── Cohort Profile ────────────────────────────────────────────────

export async function fetchCohortProfile(
  cohortDefinitionId: number,
  sourceId: number,
): Promise<CohortProfileResult> {
  const { data } = await apiClient.get("/patient-similarity/cohort-profile", {
    params: {
      cohort_definition_id: cohortDefinitionId,
      source_id: sourceId,
    },
  });
  return data.data ?? data;
}

// ── Patient Comparison ────────────────────────────────────────────

export async function comparePatients(
  personA: number,
  personB: number,
  sourceId: number,
): Promise<PatientComparisonResult> {
  const { data } = await apiClient.get("/patient-similarity/compare", {
    params: { person_a: personA, person_b: personB, source_id: sourceId },
  });
  return data.data ?? data;
}

// ── Cohort Expansion ────────────────────────────────────────────

export async function expandCohort(
  params: ExpandCohortParams,
): Promise<ExpandCohortResult> {
  const { data } = await apiClient.post(
    "/patient-similarity/expand-cohort",
    params,
  );
  return data.data ?? data;
}

// ── Cohort Comparison ────────────────────────────────────────────

export async function compareCohorts(
  params: CohortComparisonParams,
): Promise<CohortComparisonResult> {
  const { data } = await apiClient.post(
    "/patient-similarity/compare-cohorts",
    params,
  );
  return data.data ?? data;
}

export async function crossCohortSearch(
  params: CrossCohortSearchParams,
): Promise<SimilaritySearchResult> {
  const { data } = await apiClient.post(
    "/patient-similarity/cross-cohort-search",
    params,
  );
  return data.data ?? data;
}

// ── Propensity Score Matching ────────────────────────────────────

export async function propensityMatch(
  params: PropensityMatchParams,
): Promise<PropensityMatchResult> {
  const { data } = await apiClient.post(
    "/patient-similarity/propensity-match",
    params,
  );
  return data.data ?? data;
}

// ── Network Fusion (SNF) ────────────────────────────────────────

export async function networkFusion(
  params: NetworkFusionParams,
): Promise<NetworkFusionResult> {
  const { data } = await apiClient.post(
    "/patient-similarity/network-fusion",
    params,
  );
  return data.data ?? data;
}

// ── Patient Landscape (UMAP Projection) ─────────────────────────

export async function projectPatientLandscape(
  params: LandscapeParams,
): Promise<LandscapeResult> {
  const { data } = await apiClient.post(
    "/patient-similarity/landscape",
    params,
  );
  return data.data ?? data;
}

// ── Temporal Similarity (DTW) ───────────────────────────────────

export async function fetchTemporalSimilarity(
  personAId: number,
  personBId: number,
  sourceId: number,
): Promise<TemporalSimilarityResult> {
  const { data } = await apiClient.post(
    "/patient-similarity/temporal-compare",
    { person_a_id: personAId, person_b_id: personBId, source_id: sourceId },
  );
  return data.data ?? data;
}
