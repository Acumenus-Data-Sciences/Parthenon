import apiClient from "@/lib/api-client";
import type {
  GenomicUpload,
  GenomicVariant,
  GenomicCohortCriterion,
  GenomicsStats,
  PaginatedResponse,
  FileFormat,
  GenomeBuild,
  CriteriaType,
  ClinVarVariant,
  ClinVarStatus,
} from "../types";

const BASE = "/genomics";

// ──────────────────────────────────────────────────────────────────────────────
// Stats
// ──────────────────────────────────────────────────────────────────────────────

export async function getGenomicsStats(): Promise<GenomicsStats> {
  const { data } = await apiClient.get(`${BASE}/stats`);
  return data.data ?? data;
}

// ──────────────────────────────────────────────────────────────────────────────
// Uploads
// ──────────────────────────────────────────────────────────────────────────────

export async function listUploads(params?: {
  source_id?: number;
  status?: string;
  per_page?: number;
  page?: number;
}): Promise<PaginatedResponse<GenomicUpload>> {
  const { data } = await apiClient.get(`${BASE}/uploads`, { params });
  return data;
}

export async function uploadVariantFile(payload: {
  source_id: number;
  file: File;
  file_format: FileFormat;
  genome_build?: GenomeBuild;
  sample_id?: string;
}): Promise<GenomicUpload> {
  const form = new FormData();
  form.append("source_id", String(payload.source_id));
  form.append("file", payload.file);
  form.append("file_format", payload.file_format);
  if (payload.genome_build) form.append("genome_build", payload.genome_build);
  if (payload.sample_id) form.append("sample_id", payload.sample_id);

  const { data } = await apiClient.post(`${BASE}/uploads`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
}

export async function getUpload(id: number): Promise<GenomicUpload> {
  const { data } = await apiClient.get(`${BASE}/uploads/${id}`);
  return data.data;
}

export async function deleteUpload(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/uploads/${id}`);
}

export async function matchPersons(
  id: number
): Promise<{ matched: number; unmatched: number }> {
  const { data } = await apiClient.post(`${BASE}/uploads/${id}/match-persons`);
  return data.data;
}

export async function importToOmop(
  id: number
): Promise<{ upload: GenomicUpload; result: { written: number; skipped: number; errors: number } }> {
  const { data } = await apiClient.post(`${BASE}/uploads/${id}/import`);
  return data.data;
}

// ──────────────────────────────────────────────────────────────────────────────
// Variants
// ──────────────────────────────────────────────────────────────────────────────

export async function listVariants(params?: {
  upload_id?: number;
  source_id?: number;
  gene?: string;
  clinvar_significance?: string;
  mapping_status?: string;
  per_page?: number;
  page?: number;
}): Promise<PaginatedResponse<GenomicVariant>> {
  const { data } = await apiClient.get(`${BASE}/variants`, { params });
  return data;
}

export async function getVariant(id: number): Promise<GenomicVariant> {
  const { data } = await apiClient.get(`${BASE}/variants/${id}`);
  return data.data;
}

// ──────────────────────────────────────────────────────────────────────────────
// Cohort criteria
// ──────────────────────────────────────────────────────────────────────────────

export async function listCriteria(params?: {
  type?: CriteriaType;
}): Promise<GenomicCohortCriterion[]> {
  const { data } = await apiClient.get(`${BASE}/criteria`, { params });
  return data.data;
}

export async function createCriterion(payload: {
  name: string;
  criteria_type: CriteriaType;
  criteria_definition: Record<string, unknown>;
  description?: string;
  is_shared?: boolean;
}): Promise<GenomicCohortCriterion> {
  const { data } = await apiClient.post(`${BASE}/criteria`, payload);
  return data.data;
}

export async function updateCriterion(
  id: number,
  payload: Partial<{
    name: string;
    criteria_type: CriteriaType;
    criteria_definition: Record<string, unknown>;
    description: string;
    is_shared: boolean;
  }>
): Promise<GenomicCohortCriterion> {
  const { data } = await apiClient.put(`${BASE}/criteria/${id}`, payload);
  return data.data;
}

export async function deleteCriterion(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/criteria/${id}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// ClinVar
// ──────────────────────────────────────────────────────────────────────────────

export async function getClinVarStatus(): Promise<ClinVarStatus> {
  const { data } = await apiClient.get(`${BASE}/clinvar/status`);
  return data.data;
}

export async function searchClinVar(params?: {
  q?: string;
  gene?: string;
  significance?: string;
  pathogenic_only?: boolean;
  per_page?: number;
  page?: number;
}): Promise<PaginatedResponse<ClinVarVariant>> {
  const { data } = await apiClient.get(`${BASE}/clinvar/search`, { params });
  return data;
}

export async function syncClinVar(papuOnly = false): Promise<{
  inserted: number;
  updated: number;
  errors: number;
  log_id: number;
}> {
  const { data } = await apiClient.post(`${BASE}/clinvar/sync`, { papu_only: papuOnly });
  return data.data;
}

export async function annotateClinVar(uploadId: number): Promise<{
  annotated: number;
  skipped: number;
}> {
  const { data } = await apiClient.post(`${BASE}/uploads/${uploadId}/annotate-clinvar`);
  return data.data;
}
