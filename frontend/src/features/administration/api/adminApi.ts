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
    .get<PaginatedUsers>("/v1/admin/users", { params: filters })
    .then((r) => r.data);

export const fetchUser = (id: number) =>
  apiClient.get<User>(`/v1/admin/users/${id}`).then((r) => r.data);

export const createUser = (data: {
  name: string;
  email: string;
  password: string;
  roles: string[];
}) => apiClient.post<User>("/v1/admin/users", data).then((r) => r.data);

export const updateUser = (
  id: number,
  data: Partial<{ name: string; email: string; password: string; roles: string[] }>,
) => apiClient.put<User>(`/v1/admin/users/${id}`, data).then((r) => r.data);

export const deleteUser = (id: number) =>
  apiClient.delete(`/v1/admin/users/${id}`);

export const syncUserRoles = (id: number, roles: string[]) =>
  apiClient.put<User>(`/v1/admin/users/${id}/roles`, { roles }).then((r) => r.data);

export const fetchAvailableRoles = () =>
  apiClient.get<Role[]>("/v1/admin/users/roles").then((r) => r.data);

// ── Roles & Permissions ───────────────────────────────────────────────────────

export type PermissionsByDomain = Record<string, Array<{ id: number; name: string; guard_name: string }>>;

export const fetchRoles = () =>
  apiClient.get<Role[]>("/v1/admin/roles").then((r) => r.data);

export const fetchRole = (id: number) =>
  apiClient.get<Role>(`/v1/admin/roles/${id}`).then((r) => r.data);

export const fetchPermissions = () =>
  apiClient.get<PermissionsByDomain>("/v1/admin/roles/permissions").then((r) => r.data);

export const createRole = (data: { name: string; permissions: string[] }) =>
  apiClient.post<Role>("/v1/admin/roles", data).then((r) => r.data);

export const updateRole = (
  id: number,
  data: Partial<{ name: string; permissions: string[] }>,
) => apiClient.put<Role>(`/v1/admin/roles/${id}`, data).then((r) => r.data);

export const deleteRole = (id: number) =>
  apiClient.delete(`/v1/admin/roles/${id}`);

// ── Auth Providers ────────────────────────────────────────────────────────────

export interface TestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export const fetchAuthProviders = () =>
  apiClient.get<AuthProviderSetting[]>("/v1/admin/auth-providers").then((r) => r.data);

export const fetchAuthProvider = (type: string) =>
  apiClient.get<AuthProviderSetting>(`/v1/admin/auth-providers/${type}`).then((r) => r.data);

export const updateAuthProvider = (type: string, data: Partial<AuthProviderSetting>) =>
  apiClient.put<AuthProviderSetting>(`/v1/admin/auth-providers/${type}`, data).then((r) => r.data);

export const enableAuthProvider = (type: string) =>
  apiClient.post<AuthProviderSetting>(`/v1/admin/auth-providers/${type}/enable`).then((r) => r.data);

export const disableAuthProvider = (type: string) =>
  apiClient.post<AuthProviderSetting>(`/v1/admin/auth-providers/${type}/disable`).then((r) => r.data);

export const testAuthProvider = (type: string) =>
  apiClient.post<TestResult>(`/v1/admin/auth-providers/${type}/test`).then((r) => r.data);

// ── AI Providers ──────────────────────────────────────────────────────────────

export const fetchAiProviders = () =>
  apiClient.get<AiProviderSetting[]>("/v1/admin/ai-providers").then((r) => r.data);

export const fetchAiProvider = (type: string) =>
  apiClient.get<AiProviderSetting>(`/v1/admin/ai-providers/${type}`).then((r) => r.data);

export const updateAiProvider = (
  type: string,
  data: Partial<Pick<AiProviderSetting, "display_name" | "model"> & { settings: Record<string, string> }>,
) => apiClient.put<AiProviderSetting>(`/v1/admin/ai-providers/${type}`, data).then((r) => r.data);

export const activateAiProvider = (type: string) =>
  apiClient.post<AiProviderSetting>(`/v1/admin/ai-providers/${type}/activate`).then((r) => r.data);

export const enableAiProvider = (type: string) =>
  apiClient.post<AiProviderSetting>(`/v1/admin/ai-providers/${type}/enable`).then((r) => r.data);

export const disableAiProvider = (type: string) =>
  apiClient.post<AiProviderSetting>(`/v1/admin/ai-providers/${type}/disable`).then((r) => r.data);

export const testAiProvider = (type: string) =>
  apiClient.post<TestResult>(`/v1/admin/ai-providers/${type}/test`).then((r) => r.data);

// ── System Health ─────────────────────────────────────────────────────────────

export const fetchSystemHealth = () =>
  apiClient.get<SystemHealth>("/v1/admin/system-health").then((r) => r.data);
