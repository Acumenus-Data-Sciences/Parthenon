import apiClient from "@/lib/api-client";
import type {
  CareBundleCoverageCell,
  CareBundleQualificationsResponse,
  CareBundleRun,
  DerivedCohortDefinition,
  IntersectionMode,
  IntersectionResponse,
  IntersectionToCohortPayload,
  MaterializeDispatchResponse,
} from "./types";

const BASE = "/care-bundles";

export async function fetchCoverageMatrix(): Promise<CareBundleCoverageCell[]> {
  const { data } = await apiClient.get<{ data: CareBundleCoverageCell[] }>(
    `${BASE}/coverage`,
  );
  return data.data ?? [];
}

export async function fetchBundleQualifications(
  bundleId: number,
  sourceId: number,
): Promise<CareBundleQualificationsResponse> {
  const { data } = await apiClient.get<{ data: CareBundleQualificationsResponse }>(
    `${BASE}/${bundleId}/qualifications`,
    { params: { source_id: sourceId } },
  );
  return data.data;
}

export async function fetchBundleRuns(bundleId: number): Promise<CareBundleRun[]> {
  const { data } = await apiClient.get<{ data: CareBundleRun[] }>(
    `${BASE}/${bundleId}/runs`,
  );
  return data.data ?? [];
}

export async function fetchRun(runId: number): Promise<CareBundleRun> {
  const { data } = await apiClient.get<{ data: CareBundleRun }>(
    `${BASE}/runs/${runId}`,
  );
  return data.data;
}

export async function materializeBundle(
  bundleId: number,
  sourceId: number,
): Promise<MaterializeDispatchResponse> {
  const { data } = await apiClient.post<{ data: MaterializeDispatchResponse }>(
    `${BASE}/${bundleId}/materialize`,
    { source_id: sourceId },
  );
  return data.data;
}

export async function materializeAllBundles(): Promise<MaterializeDispatchResponse> {
  const { data } = await apiClient.post<{ data: MaterializeDispatchResponse }>(
    `${BASE}/materialize-all`,
  );
  return data.data;
}

export async function computeIntersection(payload: {
  source_id: number;
  bundle_ids: number[];
  mode: IntersectionMode;
}): Promise<IntersectionResponse> {
  const { data } = await apiClient.post<{ data: IntersectionResponse }>(
    `${BASE}/intersections`,
    payload,
  );
  return data.data;
}

export async function createCohortFromIntersection(
  payload: IntersectionToCohortPayload,
): Promise<DerivedCohortDefinition> {
  const { data } = await apiClient.post<{ data: DerivedCohortDefinition }>(
    `${BASE}/intersections/to-cohort`,
    payload,
  );
  return data.data;
}

/**
 * Fetch the FHIR Measure export as a raw JSON object. Caller is responsible
 * for triggering the browser download (Blob + anchor click).
 */
export async function fetchFhirMeasure(bundleId: number): Promise<unknown> {
  const { data } = await apiClient.get<unknown>(
    `${BASE}/${bundleId}/fhir/measure`,
    { headers: { Accept: "application/fhir+json" } },
  );
  return data;
}
