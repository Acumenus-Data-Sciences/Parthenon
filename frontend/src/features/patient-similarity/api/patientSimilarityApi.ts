import apiClient from "@/lib/api-client";
import type {
  SimilarityDimension,
  SimilaritySearchParams,
  SimilaritySearchResult,
  ComputeStatus,
} from "../types/patientSimilarity";

export async function searchSimilarPatients(
  params: SimilaritySearchParams,
): Promise<SimilaritySearchResult> {
  const { data } = await apiClient.post<SimilaritySearchResult>(
    "/patient-similarity/search",
    params,
  );
  return data;
}

export async function fetchDimensions(): Promise<SimilarityDimension[]> {
  const { data } = await apiClient.get<{ dimensions: SimilarityDimension[] }>(
    "/patient-similarity/dimensions",
  );
  return data.dimensions;
}

export async function fetchComputeStatus(
  sourceId: number,
): Promise<ComputeStatus> {
  const { data } = await apiClient.get<ComputeStatus>(
    `/patient-similarity/status/${sourceId}`,
  );
  return data;
}

export async function triggerCompute(
  sourceId: number,
  force?: boolean,
): Promise<{ status: string; message?: string }> {
  const { data } = await apiClient.post<{ status: string; message?: string }>(
    "/patient-similarity/compute",
    { source_id: sourceId, force: force ?? false },
  );
  return data;
}
