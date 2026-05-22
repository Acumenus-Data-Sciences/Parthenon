import apiClient from "@/lib/api-client";

export const ADMIN_LIBRARY_ITEM_TYPES = [
  "concept_set",
  "cohort_definition",
  "incidence_rate_analysis",
  "pathway_analysis",
  "estimation_analysis",
  "prediction_analysis",
  "feature_analysis",
  "sccs_analysis",
  "evidence_synthesis_analysis",
  "self_controlled_cohort_analysis",
] as const;

export type AdminLibraryItemType = (typeof ADMIN_LIBRARY_ITEM_TYPES)[number];

export type AdminLibraryStatus = "active" | "draft" | "archived";

export interface AdminLibraryOwner {
  id: number;
  name: string;
  email: string;
}

export interface AdminLibraryRow {
  item_type: AdminLibraryItemType;
  id: number;
  name: string | null;
  description: string | null;
  status: AdminLibraryStatus;
  created_at: string | null;
  updated_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  owner: AdminLibraryOwner | null;
}

export interface AdminLibraryListParams {
  type?: AdminLibraryItemType | "";
  owner_id?: number | null;
  status?: AdminLibraryStatus | "all" | "";
  search?: string;
  include_trash?: boolean;
  limit?: number;
}

export interface AdminLibraryListResponse {
  data: AdminLibraryRow[];
  count: number;
  limit: number;
  types: AdminLibraryItemType[];
}

export interface AdminLibraryItemRef {
  type: AdminLibraryItemType;
  id: number;
}

export interface AdminLibraryAttachment {
  study_id: number;
  study_title: string;
}

export interface AdminLibraryBulkDeleteResponse {
  deleted: number[];
  blocked?: Array<{
    id: number;
    type: AdminLibraryItemType;
    attached_to: AdminLibraryAttachment[];
  }>;
  errors?: Array<{
    id: number;
    type: AdminLibraryItemType;
    error: string;
    status?: string;
  }>;
}

export interface AdminLibraryReassignResponse {
  reassigned: Array<{
    id: number;
    type: AdminLibraryItemType;
    previous_author_id?: number;
    unchanged?: boolean;
  }>;
  blocked?: Array<{
    id: number;
    type: AdminLibraryItemType;
    error: string;
    required_permission?: string;
  }>;
  errors?: Array<{ id: number; type: AdminLibraryItemType; error: string }>;
  target: { id: number; email: string };
}

export interface AdminLibraryRestoreResponse {
  restored: number[];
  errors?: Array<{ id: number; type: AdminLibraryItemType; error: string }>;
}

export interface AdminLibraryPurgeResponse {
  purged: number[];
  errors?: Array<{ id: number; type: AdminLibraryItemType; error: string }>;
}

export async function listAdminLibrary(
  params: AdminLibraryListParams,
): Promise<AdminLibraryListResponse> {
  const query: Record<string, string | number | boolean> = {};
  if (params.type) query.type = params.type;
  if (params.owner_id != null) query.owner_id = params.owner_id;
  if (params.status) query.status = params.status;
  if (params.search) query.search = params.search;
  if (params.include_trash) query.include_trash = 1;
  if (params.limit) query.limit = params.limit;

  const { data } = await apiClient.get<AdminLibraryListResponse>(
    "/api/v1/admin/library",
    { params: query },
  );
  return data;
}

export async function bulkDeleteAdminLibrary(
  items: AdminLibraryItemRef[],
): Promise<AdminLibraryBulkDeleteResponse> {
  const { data } = await apiClient.post<AdminLibraryBulkDeleteResponse>(
    "/api/v1/admin/library/bulk-delete",
    { items },
  );
  return data;
}

export async function reassignAdminLibrary(
  target_email: string,
  items: AdminLibraryItemRef[],
): Promise<AdminLibraryReassignResponse> {
  const { data } = await apiClient.post<AdminLibraryReassignResponse>(
    "/api/v1/admin/library/reassign",
    { target_email, items },
  );
  return data;
}

export async function restoreAdminLibrary(
  items: AdminLibraryItemRef[],
): Promise<AdminLibraryRestoreResponse> {
  const { data } = await apiClient.post<AdminLibraryRestoreResponse>(
    "/api/v1/admin/library/restore",
    { items },
  );
  return data;
}

export async function purgeAdminLibrary(
  items: AdminLibraryItemRef[],
): Promise<AdminLibraryPurgeResponse> {
  const { data } = await apiClient.post<AdminLibraryPurgeResponse>(
    "/api/v1/admin/library/purge-now",
    { items },
  );
  return data;
}
