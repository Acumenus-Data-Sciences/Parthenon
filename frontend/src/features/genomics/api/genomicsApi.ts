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
