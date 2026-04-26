import apiClient from "@/lib/api-client";
import type {
  CareBundleCoverageCell,
  CareBundleQualificationsResponse,
  CareBundleRun,
  CareBundleSourcesResponse,
  ComparisonResponse,
  ComplianceBucket,
  DerivedCohortDefinition,
  IntersectionMode,
  IntersectionResponse,
  IntersectionToCohortPayload,
  MaterializeDispatchResponse,
  MeasureMethodology,
  MeasureStrata,
  PaginatedResponse,
  RosterResponse,
  RosterToCohortPayload,
  RosterToCohortResponse,
  TrendResponse,
  VsacCode,
  VsacMeasureDetail,
  VsacMeasureSummary,
  VsacOmopConcept,
  VsacValueSetDetail,
  VsacValueSetSummary,
} from "./types";

const BASE = "/care-bundles";
const VSAC = "/vsac";

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

export async function fetchBundleRuns(
  bundleId: number,
  sourceId?: number | null,
): Promise<CareBundleRun[]> {
  const { data } = await apiClient.get<{ data: CareBundleRun[] }>(
    `${BASE}/${bundleId}/runs`,
    sourceId != null ? { params: { source_id: sourceId } } : undefined,
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

// ---------------------------------------------------------------------------
// Source population gate (N ≥ min_population)
// ---------------------------------------------------------------------------

export async function fetchCareBundleSources(): Promise<CareBundleSourcesResponse> {
  const { data } = await apiClient.get<CareBundleSourcesResponse>(
    `${BASE}/sources`,
  );
  return data;
}

// ---------------------------------------------------------------------------
// VSAC reference library
// ---------------------------------------------------------------------------

export interface VsacValueSetListParams {
  q?: string;
  code_system?: string;
  cms_id?: string;
  page?: number;
  per_page?: number;
}

export async function fetchVsacValueSets(
  params: VsacValueSetListParams = {},
): Promise<PaginatedResponse<VsacValueSetSummary>> {
  const { data } = await apiClient.get<PaginatedResponse<VsacValueSetSummary>>(
    `${VSAC}/value-sets`,
    { params },
  );
  return data;
}

export async function fetchVsacValueSet(
  oid: string,
): Promise<VsacValueSetDetail> {
  const { data } = await apiClient.get<{ data: VsacValueSetDetail }>(
    `${VSAC}/value-sets/${oid}`,
  );
  return data.data;
}

export async function fetchVsacCodes(
  oid: string,
  params: { code_system?: string; page?: number; per_page?: number } = {},
): Promise<PaginatedResponse<VsacCode>> {
  const { data } = await apiClient.get<PaginatedResponse<VsacCode>>(
    `${VSAC}/value-sets/${oid}/codes`,
    { params },
  );
  return data;
}

export async function fetchVsacOmopConcepts(
  oid: string,
  params: { vocabulary_id?: string; page?: number; per_page?: number } = {},
): Promise<PaginatedResponse<VsacOmopConcept>> {
  const { data } = await apiClient.get<PaginatedResponse<VsacOmopConcept>>(
    `${VSAC}/value-sets/${oid}/omop-concepts`,
    { params },
  );
  return data;
}

export async function fetchVsacMeasures(
  params: { q?: string; page?: number; per_page?: number } = {},
): Promise<PaginatedResponse<VsacMeasureSummary>> {
  const { data } = await apiClient.get<PaginatedResponse<VsacMeasureSummary>>(
    `${VSAC}/measures`,
    { params },
  );
  return data;
}

export async function fetchVsacMeasure(
  cmsId: string,
): Promise<VsacMeasureDetail> {
  const { data } = await apiClient.get<{ data: VsacMeasureDetail }>(
    `${VSAC}/measures/${cmsId}`,
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Methodology card + Stratification
// ---------------------------------------------------------------------------

export async function fetchMeasureMethodology(
  bundleId: number,
  measureId: number,
  sourceId: number,
): Promise<MeasureMethodology> {
  const { data } = await apiClient.get<{ data: MeasureMethodology }>(
    `${BASE}/${bundleId}/measures/${measureId}/methodology`,
    { params: { source_id: sourceId } },
  );
  return data.data;
}

export async function fetchMeasureStrata(
  bundleId: number,
  measureId: number,
  sourceId: number,
): Promise<MeasureStrata> {
  const { data } = await apiClient.get<{ data: MeasureStrata }>(
    `${BASE}/${bundleId}/measures/${measureId}/strata`,
    { params: { source_id: sourceId } },
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Source comparison + Time trend (Tier B)
// ---------------------------------------------------------------------------

export async function fetchBundleComparison(
  bundleId: number,
): Promise<ComparisonResponse> {
  const { data } = await apiClient.get<{ data: ComparisonResponse }>(
    `${BASE}/${bundleId}/comparison`,
  );
  return data.data;
}

export async function fetchMeasureTrend(
  bundleId: number,
  measureId: number,
  sourceId: number,
  limit = 24,
): Promise<TrendResponse> {
  const { data } = await apiClient.get<{ data: TrendResponse }>(
    `${BASE}/${bundleId}/measures/${measureId}/trend`,
    { params: { source_id: sourceId, limit } },
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Patient roster + cohort export (Tier C)
// ---------------------------------------------------------------------------

export async function fetchMeasureRoster(
  bundleId: number,
  measureId: number,
  sourceId: number,
  bucket: ComplianceBucket = "non_compliant",
  page = 1,
  perPage = 100,
): Promise<RosterResponse> {
  const { data } = await apiClient.get<{ data: RosterResponse }>(
    `${BASE}/${bundleId}/measures/${measureId}/roster`,
    { params: { source_id: sourceId, bucket, page, per_page: perPage } },
  );
  return data.data;
}

export async function exportRosterToCohort(
  bundleId: number,
  measureId: number,
  payload: RosterToCohortPayload,
): Promise<RosterToCohortResponse> {
  const { data } = await apiClient.post<{ data: RosterToCohortResponse }>(
    `${BASE}/${bundleId}/measures/${measureId}/roster/to-cohort`,
    payload,
  );
  return data.data;
}
