import apiClient from "@/lib/api-client";
import type { User, Role, AuthProviderSetting, AiProviderSetting, SystemHealth, SystemHealthService } from "@/types/models";

// ── Users ─────────────────────────────────────────────────────────────────────

export interface PaginatedUsers {
  data: User[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface UserFilters {
  search?: string;
  role?: string;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}

export const fetchUsers = (filters: UserFilters = {}) =>
  apiClient
    .get<PaginatedUsers>("/admin/users", { params: filters })
    .then((r) => r.data);

export const fetchUser = (id: number) =>
  apiClient.get<User>(`/admin/users/${id}`).then((r) => r.data);

export const createUser = (data: {
  name: string;
  email: string;
  password: string;
  roles: string[];
}) => apiClient.post<User>("/admin/users", data).then((r) => r.data);

export const updateUser = (
  id: number,
  data: Partial<{ name: string; email: string; password: string; roles: string[] }>,
) => apiClient.put<User>(`/admin/users/${id}`, data).then((r) => r.data);

export const deleteUser = (id: number) =>
  apiClient.delete(`/admin/users/${id}`);

export const syncUserRoles = (id: number, roles: string[]) =>
  apiClient.put<User>(`/admin/users/${id}/roles`, { roles }).then((r) => r.data);

export const fetchAvailableRoles = () =>
  apiClient.get<Role[]>("/admin/users/roles").then((r) => r.data);

export const sendBroadcastEmail = (data: { subject: string; body: string }) =>
  apiClient
    .post<{ message: string; recipient_count: number; failed_count: number }>("/admin/users/broadcast-email", data)
    .then((r) => r.data);

// ── Roles & Permissions ───────────────────────────────────────────────────────

export type PermissionsByDomain = Record<string, Array<{ id: number; name: string; guard_name: string }>>;

export const fetchRoles = () =>
  apiClient.get<Role[]>("/admin/roles").then((r) => r.data);

export const fetchRole = (id: number) =>
  apiClient.get<Role>(`/admin/roles/${id}`).then((r) => r.data);

export const fetchPermissions = () =>
  apiClient.get<PermissionsByDomain>("/admin/roles/permissions").then((r) => r.data);

export const createRole = (data: { name: string; permissions: string[] }) =>
  apiClient.post<Role>("/admin/roles", data).then((r) => r.data);

export const updateRole = (
  id: number,
  data: Partial<{ name: string; permissions: string[] }>,
) => apiClient.put<Role>(`/admin/roles/${id}`, data).then((r) => r.data);

export const deleteRole = (id: number) =>
  apiClient.delete(`/admin/roles/${id}`);

// ── Auth Providers ────────────────────────────────────────────────────────────

export interface TestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export const fetchAuthProviders = () =>
  apiClient.get<AuthProviderSetting[]>("/admin/auth-providers").then((r) => r.data);

export const fetchAuthProvider = (type: string) =>
  apiClient.get<AuthProviderSetting>(`/admin/auth-providers/${type}`).then((r) => r.data);

export const updateAuthProvider = (type: string, data: Partial<AuthProviderSetting>) =>
  apiClient.put<AuthProviderSetting>(`/admin/auth-providers/${type}`, data).then((r) => r.data);

export const enableAuthProvider = (type: string) =>
  apiClient.post<AuthProviderSetting>(`/admin/auth-providers/${type}/enable`).then((r) => r.data);

export const disableAuthProvider = (type: string) =>
  apiClient.post<AuthProviderSetting>(`/admin/auth-providers/${type}/disable`).then((r) => r.data);

export const testAuthProvider = (type: string) =>
  apiClient.post<TestResult>(`/admin/auth-providers/${type}/test`).then((r) => r.data);

// ── AI Providers ──────────────────────────────────────────────────────────────

export const fetchAiProviders = () =>
  apiClient.get<AiProviderSetting[]>("/admin/ai-providers").then((r) => r.data);

export const fetchAiProvider = (type: string) =>
  apiClient.get<AiProviderSetting>(`/admin/ai-providers/${type}`).then((r) => r.data);

export const updateAiProvider = (
  type: string,
  data: Partial<Pick<AiProviderSetting, "display_name" | "model"> & { settings: Record<string, string> }>,
) => apiClient.put<AiProviderSetting>(`/admin/ai-providers/${type}`, data).then((r) => r.data);

export const activateAiProvider = (type: string) =>
  apiClient.post<AiProviderSetting>(`/admin/ai-providers/${type}/activate`).then((r) => r.data);

export const enableAiProvider = (type: string) =>
  apiClient.post<AiProviderSetting>(`/admin/ai-providers/${type}/enable`).then((r) => r.data);

export const disableAiProvider = (type: string) =>
  apiClient.post<AiProviderSetting>(`/admin/ai-providers/${type}/disable`).then((r) => r.data);

export const testAiProvider = (type: string) =>
  apiClient.post<TestResult>(`/admin/ai-providers/${type}/test`).then((r) => r.data);

// ── System Health ─────────────────────────────────────────────────────────────

export const fetchSystemHealth = () =>
  apiClient.get<SystemHealth>("/admin/system-health").then((r) => r.data);

export interface ServiceLogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export interface ServiceDetail {
  service: SystemHealthService;
  logs: ServiceLogEntry[];
  metrics: Record<string, unknown>;
  checked_at: string;
}

export const fetchServiceDetail = (key: string) =>
  apiClient.get<ServiceDetail>(`/admin/system-health/${key}`).then((r) => r.data);

// ── LiveKit Configuration ─────────────────────────────────────────────────────

export interface LiveKitConfig {
  provider: "cloud" | "self-hosted" | "env";
  url: string;
  has_api_key: boolean;
  has_api_secret: boolean;
  env_url: string;
  env_has_key: boolean;
  env_has_secret: boolean;
}

export const fetchLiveKitConfig = () =>
  apiClient.get<{ data: LiveKitConfig }>("/admin/livekit-config").then((r) => r.data.data);

export const updateLiveKitConfig = (data: {
  provider: string;
  url?: string;
  api_key?: string;
  api_secret?: string;
}) => apiClient.put("/admin/livekit-config", data).then((r) => r.data);

export const testLiveKitConnection = (url: string) =>
  apiClient.post<{ reachable: boolean; message: string }>("/admin/livekit-config/test", { url }).then((r) => r.data);

// ── Vocabulary Imports ────────────────────────────────────────────────────────

export type VocabImportStatus = "pending" | "running" | "completed" | "failed";

export interface VocabularyImport {
  id: number;
  user_id: number;
  source_id: number | null;
  status: VocabImportStatus;
  progress_percentage: number;
  file_name: string;
  file_size: number | null;
  log_output: string | null;
  error_message: string | null;
  rows_loaded: number | null;
  target_schema: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  user?: { id: number; name: string; email: string };
  source?: { id: number; source_name: string; source_key: string } | null;
}

export const fetchVocabImports = () =>
  apiClient
    .get<{ data: VocabularyImport[] }>("/admin/vocabulary/imports")
    .then((r) => r.data.data);

export const fetchVocabImport = (id: number) =>
  apiClient
    .get<{ data: VocabularyImport }>(`/admin/vocabulary/imports/${id}`)
    .then((r) => r.data.data);

export const uploadVocabZip = (file: File, sourceId?: number) => {
  const form = new FormData();
  form.append("file", file);
  if (sourceId) form.append("source_id", String(sourceId));
  return apiClient
    .post<{ data: VocabularyImport }>("/admin/vocabulary/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data.data);
};

export const deleteVocabImport = (id: number) =>
  apiClient.delete(`/admin/vocabulary/imports/${id}`);

// ── FHIR EHR Connections ────────────────────────────────────────────────────

export interface FhirConnection {
  id: number;
  site_name: string;
  site_key: string;
  ehr_vendor: "epic" | "cerner" | "other";
  fhir_base_url: string;
  token_endpoint: string;
  client_id: string;
  has_private_key: boolean;
  jwks_url: string | null;
  scopes: string;
  group_id: string | null;
  export_resource_types: string | null;
  target_source_id: number | null;
  sync_config: Record<string, unknown> | null;
  is_active: boolean;
  incremental_enabled: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_records: number;
  sync_runs_count?: number;
  target_source?: { id: number; source_name: string } | null;
  creator?: { id: number; name: string };
  created_at: string;
  updated_at: string;
}

export interface FhirConnectionPayload {
  site_name: string;
  site_key: string;
  ehr_vendor: string;
  fhir_base_url: string;
  token_endpoint: string;
  client_id: string;
  private_key_pem?: string;
  jwks_url?: string;
  scopes?: string;
  group_id?: string;
  export_resource_types?: string;
  target_source_id?: number | null;
  sync_config?: Record<string, unknown>;
  is_active?: boolean;
  incremental_enabled?: boolean;
}

export interface FhirTestResult {
  success: boolean;
  message: string;
  steps: Array<{ step: string; status: string; detail?: string }>;
  elapsed_ms: number;
}

export interface FhirSyncRun {
  id: number;
  fhir_connection_id: number;
  status: string;
  export_url: string | null;
  since_param: string | null;
  resource_types: string[] | null;
  files_downloaded: number;
  records_extracted: number;
  records_mapped: number;
  records_written: number;
  records_failed: number;
  mapping_coverage: number | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  triggered_by_user?: { id: number; name: string } | null;
  triggered_by?: { id: number; name: string } | null;
  connection?: { id: number; site_name: string; site_key: string } | null;
  created_at: string;
}

export const fetchFhirConnections = () =>
  apiClient.get<{ data: FhirConnection[] }>("/admin/fhir-connections").then((r) => r.data.data);

export const fetchFhirConnection = (id: number) =>
  apiClient.get<{ data: FhirConnection }>(`/admin/fhir-connections/${id}`).then((r) => r.data.data);

export const createFhirConnection = (data: FhirConnectionPayload) =>
  apiClient.post<{ data: FhirConnection }>("/admin/fhir-connections", data).then((r) => r.data.data);

export const updateFhirConnection = (id: number, data: Partial<FhirConnectionPayload>) =>
  apiClient.put<{ data: FhirConnection }>(`/admin/fhir-connections/${id}`, data).then((r) => r.data.data);

export const deleteFhirConnection = (id: number) =>
  apiClient.delete(`/admin/fhir-connections/${id}`);

export const testFhirConnection = (id: number) =>
  apiClient.post<FhirTestResult>(`/admin/fhir-connections/${id}/test`).then((r) => r.data);

export const startFhirSync = (id: number, forceFull = false) =>
  apiClient.post<{ data: FhirSyncRun }>(`/admin/fhir-connections/${id}/sync`, { force_full: forceFull }).then((r) => r.data.data);

export const fetchFhirSyncRuns = (connectionId: number) =>
  apiClient.get<{ data: FhirSyncRun[] }>(`/admin/fhir-connections/${connectionId}/sync-runs`).then((r) => r.data.data);

export const fetchFhirSyncRunDetail = (connectionId: number, runId: number) =>
  apiClient.get<{ data: FhirSyncRun }>(`/admin/fhir-connections/${connectionId}/sync-runs/${runId}`).then((r) => r.data.data);

export interface FhirSyncDashboard {
  summary: {
    total_connections: number;
    active_connections: number;
    total_runs: number;
    completed_runs: number;
    failed_runs: number;
    active_runs: number;
    total_extracted: number;
    total_mapped: number;
    total_written: number;
    total_failed: number;
    avg_coverage: number | null;
  };
  connections: Array<{
    id: number;
    site_name: string;
    site_key: string;
    ehr_vendor: string;
    is_active: boolean;
    last_sync_at: string | null;
    last_sync_status: string | null;
    last_sync_records: number;
    total_runs: number;
  }>;
  recent_runs: FhirSyncRun[];
  timeline: Array<{ date: string; completed: number; failed: number; total: number }>;
}

export const fetchFhirSyncDashboard = () =>
  apiClient.get<{ data: FhirSyncDashboard }>("/admin/fhir-sync/dashboard").then((r) => r.data.data);

// ── User Audit Log ─────────────────────────────────────────────────────────────

export interface UserAuditEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  feature: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, string> | null;
  occurred_at: string;
}

export interface PaginatedAuditLog {
  data: UserAuditEntry[];
  meta: { total: number; per_page: number; current_page: number; last_page: number };
}

export interface AuditSummary {
  logins_today: number;
  active_users_week: number;
  top_features: Array<{ feature: string; count: number }>;
  recent_logins: UserAuditEntry[];
}

export interface AuditFilters {
  user_id?: number;
  action?: string;
  feature?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

export const fetchAuditLog = (filters: AuditFilters = {}) =>
  apiClient.get<PaginatedAuditLog>("/admin/user-audit", { params: filters }).then((r) => r.data);

export const fetchAuditSummary = () =>
  apiClient.get<AuditSummary>("/admin/user-audit/summary").then((r) => r.data);

export const fetchUserAuditLog = (userId: number, params?: { per_page?: number; page?: number }) =>
  apiClient.get<PaginatedAuditLog>(`/admin/users/${userId}/audit`, { params }).then((r) => r.data);
