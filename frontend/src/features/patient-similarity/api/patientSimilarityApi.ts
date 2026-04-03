import apiClient from "@/lib/api-client";
import type {
  SimilarityDimension,
  SimilaritySearchParams,
  SimilaritySearchResult,
  ComputeStatus,
  CohortSimilaritySearchParams,
  CohortExportParams,
  CohortExportResult,
  PatientComparisonResult,
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
