// frontend/src/features/finngen-workbench/api.ts
import apiClient from "@/lib/api-client";
import type {
  CreateWorkbenchSessionPayload,
  UpdateWorkbenchSessionPayload,
  WorkbenchSession,
} from "./types";

const BASE = "/finngen/workbench/sessions";

export const finngenWorkbenchApi = {
  list: async (sourceKey?: string): Promise<{ data: WorkbenchSession[] }> => {
    const params = sourceKey ? { source_key: sourceKey } : undefined;
    const { data } = await apiClient.get<{ data: WorkbenchSession[] }>(BASE, { params });
    return data;
  },

  get: async (id: string): Promise<{ data: WorkbenchSession }> => {
    const { data } = await apiClient.get<{ data: WorkbenchSession }>(
      `${BASE}/${encodeURIComponent(id)}`,
    );
    return data;
  },

  create: async (
    payload: CreateWorkbenchSessionPayload,
  ): Promise<{ data: WorkbenchSession }> => {
    const { data } = await apiClient.post<{ data: WorkbenchSession }>(BASE, payload);
    return data;
  },

  update: async (
    id: string,
    payload: UpdateWorkbenchSessionPayload,
  ): Promise<{ data: WorkbenchSession }> => {
    const { data } = await apiClient.patch<{ data: WorkbenchSession }>(
      `${BASE}/${encodeURIComponent(id)}`,
      payload,
    );
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`${BASE}/${encodeURIComponent(id)}`);
  },
};
