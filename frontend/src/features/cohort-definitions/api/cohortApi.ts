import apiClient, { toLaravelPaginated } from "@/lib/api-client";
import type {
  CohortDefinition,
  CohortGeneration,
  CohortDefinitionListParams,
  PaginatedResponse,
  CreateCohortDefinitionPayload,
  UpdateCohortDefinitionPayload,
  CohortOverlapResult,
  NegativeControlSuggestion,
  NegativeControlValidation,
  CohortDiagnosticsResult,
  RDiagnosticsResponse,
  RunCohortDiagnosticsPayload,
  DomainInfo,
  GroupedCohortResponse,
  CohortDefinitionGroupedParams,
} from "../types/cohortExpression";

const BASE = "/cohort-definitions";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getCohortDefinitions(
  params?: CohortDefinitionListParams,
): Promise<PaginatedResponse<CohortDefinition> & { facets?: Record<string, Record<string, number>>; engine?: string }> {
  const { data } = await apiClient.get(BASE, { params });
  return {
    ...toLaravelPaginated<CohortDefinition>(data),
    facets: data.facets ?? undefined,
    engine: data.engine ?? undefined,
  };
}

export async function getCohortDomains(): Promise<DomainInfo[]> {
  const { data } = await apiClient.get(`${BASE}/domains`);
  return data;
}

export async function getGroupedCohortDefinitions(
  params: CohortDefinitionGroupedParams,
): Promise<GroupedCohortResponse> {
  const { data } = await apiClient.get(BASE, { params });
  return data;
}

export async function getCohortDefinition(
  id: number,
): Promise<CohortDefinition> {
  const { data } = await apiClient.get(`${BASE}/${id}`);
  return data.data ?? data;
}

export async function createCohortDefinition(
  payload: CreateCohortDefinitionPayload,
): Promise<CohortDefinition> {
  const { data } = await apiClient.post(BASE, payload);
  return data.data ?? data;
}

export async function updateCohortDefinition(
  id: number,
  payload: UpdateCohortDefinitionPayload,
): Promise<CohortDefinition> {
  const { data } = await apiClient.put(`${BASE}/${id}`, payload);
  return data.data ?? data;
}

export async function deleteCohortDefinition(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

export async function copyCohortDefinition(
  id: number,
): Promise<CohortDefinition> {
  const { data } = await apiClient.post(`${BASE}/${id}/copy`);
  return data.data ?? data;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export async function generateCohort(
  id: number,
  payload: { source_id: number },
): Promise<CohortGeneration> {
  const { data } = await apiClient.post(`${BASE}/${id}/generate`, payload);
  return data.data ?? data;
}

export async function getCohortGenerations(
  id: number,
): Promise<CohortGeneration[]> {
  const { data } = await apiClient.get(
    `${BASE}/${id}/generations`,
  );
  const items = data.data ?? data;
  return Array.isArray(items) ? items : [];
}

export async function getCohortGeneration(
  defId: number,
  genId: number,
): Promise<CohortGeneration> {
  const { data } = await apiClient.get(
    `${BASE}/${defId}/generations/${genId}`,
  );
  return data.data ?? data;
}

// ---------------------------------------------------------------------------
// SQL Preview
// ---------------------------------------------------------------------------

export async function previewCohortSql(
  id: number,
  payload: { source_id: number },
): Promise<{ sql: string }> {
  const { data } = await apiClient.get(
    `${BASE}/${id}/sql`,
    { params: payload },
  );
  return data.data ?? data;
}

// ---------------------------------------------------------------------------
// §9.2 — Import / Export / Tags / Share
// ---------------------------------------------------------------------------

export interface ImportCohortPayload {
  name: string;
  description?: string;
  expression: Record<string, unknown>;
}

export interface ImportCohortResult {
  imported: number;
  skipped: number;
  failed: number;
  results: { name: string; status: string; id?: number; reason?: string }[];
}

export async function importCohortDefinitions(
  payload: ImportCohortPayload | ImportCohortPayload[],
): Promise<ImportCohortResult> {
  const { data } = await apiClient.post<ImportCohortResult>(
    `${BASE}/import`,
    payload,
  );
  return data;
}

export async function exportCohortDefinition(
  id: number,
): Promise<{ name: string; description?: string; expression: Record<string, unknown> }> {
  const { data } = await apiClient.get(`${BASE}/${id}/export`);
  return data;
}

export async function getCohortTags(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>(`${BASE}/tags`);
  return data;
}

export interface ShareCohortResult {
  token: string;
  url: string;
  expires_at: string;
}

export async function shareCohortDefinition(
  id: number,
  days?: number,
): Promise<ShareCohortResult> {
  const { data } = await apiClient.post<ShareCohortResult>(
    `${BASE}/${id}/share`,
    days ? { days } : {},
  );
  return data;
}

export async function getSharedCohort(token: string): Promise<{
  id: number;
  name: string;
  description?: string;
  expression: Record<string, unknown>;
  expires_at: string;
}> {
  // Public endpoint — no auth header needed, but apiClient still works for it
  const { data } = await apiClient.get(`${BASE}/shared/${token}`);
  return data;
}

// ---------------------------------------------------------------------------
// §9.4 — Cohort Overlap
// ---------------------------------------------------------------------------

export async function compareCohorts(payload: {
  cohort_ids: number[];
  source_id: number;
}): Promise<CohortOverlapResult> {
  const { data } = await apiClient.post(`${BASE}/compare`, payload);
  return data.data ?? data;
}

// ---------------------------------------------------------------------------
// §9.4 — Negative Controls
// ---------------------------------------------------------------------------

export async function suggestNegativeControls(payload: {
  exposure_concept_ids: number[];
  source_id: number;
  exclude_concept_ids?: number[];
  limit?: number;
}): Promise<NegativeControlSuggestion[]> {
  const { data } = await apiClient.post("/negative-controls/suggest", payload);
  return data.data ?? data;
}

export async function validateNegativeControls(payload: {
  exposure_concept_ids: number[];
  candidate_concept_ids: number[];
  source_id: number;
}): Promise<NegativeControlValidation[]> {
  const { data } = await apiClient.post(
    "/negative-controls/validate",
    payload,
  );
  return data.data ?? data;
}

// ---------------------------------------------------------------------------
// §9.4 — Cohort Diagnostics
// ---------------------------------------------------------------------------

export async function runCohortDiagnostics(
  id: number,
  payload: { source_id: number },
): Promise<CohortDiagnosticsResult> {
  const { data } = await apiClient.post(
    `${BASE}/${id}/diagnostics`,
    payload,
  );
  return data.data ?? data;
}

/**
 * Run full CohortDiagnostics via the R Plumber proxy.
 * POST /api/v1/cohort-diagnostics/run
 */
export async function runRCohortDiagnostics(
  payload: RunCohortDiagnosticsPayload,
): Promise<RDiagnosticsResponse> {
  const { data } = await apiClient.post("/cohort-diagnostics/run", payload);
  return data.data ?? data;
}

// ---------------------------------------------------------------------------
// Stats & Create from Bundle
// ---------------------------------------------------------------------------

export interface CohortStats {
  total: number;
  with_generations: number;
  public: number;
}

export async function getCohortStats(): Promise<CohortStats> {
  const { data } = await apiClient.get<CohortStats>(`${BASE}/stats`);
  return data;
}

export async function createCohortFromBundle(payload: {
  bundle_id: number;
  include_measures?: boolean;
  name?: string;
}): Promise<CohortDefinition> {
  const { data } = await apiClient.post(`${BASE}/from-bundle`, payload);
  return data.data ?? data;
}

// ---------------------------------------------------------------------------
// Lifecycle — Deprecate / Restore
// ---------------------------------------------------------------------------

export async function deprecateCohort(
  id: number,
  supersededBy?: number,
): Promise<CohortDefinition> {
  const { data } = await apiClient.post(`${BASE}/${id}/deprecate`, {
    superseded_by: supersededBy ?? null,
  });
  return data.data;
}

export async function restoreActiveCohort(
  id: number,
): Promise<CohortDefinition> {
  const { data } = await apiClient.post(
    `${BASE}/${id}/restore-active`,
  );
  return data.data;
}
