import apiClient from "@/lib/api-client";
import type { Source } from "@/types/models";

export async function fetchSources(): Promise<Source[]> {
  const { data } = await apiClient.get<Source[]>("/sources");
  return data;
}

export async function createSource(
  source: Omit<Source, "id" | "daimons" | "created_at" | "updated_at">,
): Promise<Source> {
  const { data } = await apiClient.post<Source>("/sources", source);
  return data;
}

export async function deleteSource(id: number): Promise<void> {
  await apiClient.delete(`/sources/${id}`);
}
