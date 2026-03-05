import apiClient from "@/lib/api-client";
import type { User, Role, AuthProviderSetting, AiProviderSetting, SystemHealth } from "@/types/models";

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
