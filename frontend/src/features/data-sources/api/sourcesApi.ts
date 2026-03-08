import apiClient from "@/lib/api-client";
import type { Source, WebApiImportResult, WebApiRegistry } from "@/types/models";

// ---------------------------------------------------------------------------
// Sources CRUD
// ---------------------------------------------------------------------------

export async function fetchSources(): Promise<Source[]> {
  const { data } = await apiClient.get<Source[]>("/sources");
  return data;
}

export async function fetchSource(id: number): Promise<Source> {
  const { data } = await apiClient.get<Source>(`/sources/${id}`);
  return data;
}

export async function createSource(
  source: Omit<Source, "id" | "daimons" | "created_at" | "updated_at" | "restricted_to_roles" | "imported_from_webapi"> & {
    restricted_to_roles?: string[];
    daimons?: { daimon_type: string; table_qualifier: string; priority?: number }[];
  },
): Promise<Source> {
  const { data } = await apiClient.post<Source>("/sources", source);
  return data;
}

export async function updateSource(
  id: number,
  payload: Partial<
    Omit<Source, "id" | "daimons" | "created_at" | "updated_at" | "imported_from_webapi"> & {
      daimons?: { daimon_type: string; table_qualifier: string; priority?: number }[];
    }
  >,
): Promise<Source> {
  const { data } = await apiClient.put<Source>(`/sources/${id}`, payload);
  return data;
}

export async function deleteSource(id: number): Promise<void> {
  await apiClient.delete(`/sources/${id}`);
}

export async function setDefaultSource(id: number): Promise<Source> {
  const { data } = await apiClient.put<Source>(`/sources/${id}/set-default`);
  return data;
}

export async function clearDefaultSource(): Promise<void> {
  await apiClient.delete("/sources/default");
}

// ---------------------------------------------------------------------------
// §9.5 — WebAPI import
// ---------------------------------------------------------------------------

export async function importFromWebApi(payload: {
  webapi_url: string;
  auth_type?: string;
  auth_credentials?: string;
}): Promise<WebApiImportResult> {
  const { data } = await apiClient.post<{ data: WebApiImportResult }>(
    "/sources/import-webapi",
    payload,
  );
  return data.data ?? (data as unknown as WebApiImportResult);
}

// ---------------------------------------------------------------------------
// §9.5 — WebAPI Registry (admin)
// ---------------------------------------------------------------------------

export async function fetchWebApiRegistries(): Promise<WebApiRegistry[]> {
  const { data } = await apiClient.get<{ data: WebApiRegistry[] }>(
    "/admin/webapi-registries",
  );
  return data.data ?? (data as unknown as WebApiRegistry[]);
}

export async function createWebApiRegistry(payload: {
  name: string;
  base_url: string;
  auth_type?: string;
  auth_credentials?: string;
}): Promise<WebApiRegistry> {
  const { data } = await apiClient.post<{ data: WebApiRegistry }>(
    "/admin/webapi-registries",
    payload,
  );
  return data.data ?? (data as unknown as WebApiRegistry);
}

export async function updateWebApiRegistry(
  id: number,
  payload: Partial<{
    name: string;
    base_url: string;
    auth_type: string;
    auth_credentials: string;
    is_active: boolean;
  }>,
): Promise<WebApiRegistry> {
  const { data } = await apiClient.put<{ data: WebApiRegistry }>(
    `/admin/webapi-registries/${id}`,
    payload,
  );
  return data.data ?? (data as unknown as WebApiRegistry);
}

export async function deleteWebApiRegistry(id: number): Promise<void> {
  await apiClient.delete(`/admin/webapi-registries/${id}`);
}

export async function syncWebApiRegistry(
  id: number,
): Promise<WebApiImportResult> {
  const { data } = await apiClient.post<{ data: WebApiImportResult }>(
    `/admin/webapi-registries/${id}/sync`,
  );
  return data.data ?? (data as unknown as WebApiImportResult);
}
