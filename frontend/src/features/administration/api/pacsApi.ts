import apiClient from "@/lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PacsStats {
  count_patients: number | null;
  count_studies: number | null;
  count_series: number | null;
  count_instances: number | null;
  total_disk_size_mb: number | null;
  modalities: Record<string, number> | null;
}

export interface PacsConnection {
  id: number;
  name: string;
  type: "orthanc" | "dicomweb" | "google_healthcare" | "cloud";
  base_url: string;
  auth_type: "none" | "basic" | "bearer";
  is_default: boolean;
  is_active: boolean;
  source_id: number | null;
  source: { id: number; source_name: string } | null;
  last_health_check_at: string | null;
  last_health_status: "ok" | "healthy" | "degraded" | "error" | "unreachable" | null;
  metadata_cache: PacsStats | null;
  metadata_cached_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PacsConnectionPayload {
  name: string;
  type: string;
  base_url: string;
  auth_type?: string;
  credentials?: Record<string, string>;
  is_active?: boolean;
  source_id?: number | null;
}

export interface PacsTestResult {
  success: boolean;
  message: string;
  latency_ms: number | null;
}

export interface PacsStudy {
  study_instance_uid: string | null;
  patient_name: string | null;
  patient_id: string | null;
  study_date: string | null;
  modalities: string | null;
  study_description: string | null;
  num_series: number | null;
  num_instances: number | null;
}

export interface PacsStudyBrowseResult {
  studies: PacsStudy[];
  count: number;
}

export interface PacsStudyFilters {
  patient_name?: string;
  patient_id?: string;
  modality?: string;
  study_date_from?: string;
  study_date_to?: string;
  offset?: number;
  limit?: number;
}

// ── API Functions ────────────────────────────────────────────────────────────

export const fetchPacsConnections = async (): Promise<PacsConnection[]> => {
  const { data } = await apiClient.get<{ data: PacsConnection[] }>("/admin/pacs-connections");
  return data.data ?? data;
};

export const fetchPacsConnection = async (id: number): Promise<PacsConnection> => {
  const { data } = await apiClient.get<{ data: PacsConnection }>(`/admin/pacs-connections/${id}`);
  return data.data ?? data;
};

export const createPacsConnection = async (payload: PacsConnectionPayload): Promise<PacsConnection> => {
  const { data } = await apiClient.post<{ data: PacsConnection }>("/admin/pacs-connections", payload);
  return data.data ?? data;
};

export const updatePacsConnection = async (id: number, payload: Partial<PacsConnectionPayload>): Promise<PacsConnection> => {
  const { data } = await apiClient.put<{ data: PacsConnection }>(`/admin/pacs-connections/${id}`, payload);
  return data.data ?? data;
};

export const deletePacsConnection = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/pacs-connections/${id}`);
};

export const testPacsConnection = async (id: number): Promise<PacsTestResult> => {
  const { data } = await apiClient.post<{ data: PacsTestResult }>(`/admin/pacs-connections/${id}/test`);
  return data.data ?? data;
};

export const refreshPacsStats = async (id: number): Promise<PacsConnection> => {
  const { data } = await apiClient.post<{ data: PacsConnection }>(`/admin/pacs-connections/${id}/refresh-stats`);
  return data.data ?? data;
};

export const browsePacsStudies = async (id: number, filters?: PacsStudyFilters): Promise<PacsStudyBrowseResult> => {
  const params: Record<string, string | number> = {};
  if (filters?.patient_name) params.PatientName = filters.patient_name;
  if (filters?.patient_id) params.PatientID = filters.patient_id;
  if (filters?.modality) params.Modality = filters.modality;
  if (filters?.limit != null) params.limit = filters.limit;
  if (filters?.offset != null) params.offset = filters.offset;

  const { data } = await apiClient.get<{ data: PacsStudyBrowseResult }>(`/admin/pacs-connections/${id}/studies`, {
    params,
  });
  return data.data ?? data;
};

export const setDefaultPacsConnection = async (id: number): Promise<PacsConnection> => {
  const { data } = await apiClient.post<{ data: PacsConnection }>(`/admin/pacs-connections/${id}/set-default`);
  return data.data ?? data;
};
