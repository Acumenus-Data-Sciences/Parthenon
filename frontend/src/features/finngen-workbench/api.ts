// frontend/src/features/finngen-workbench/api.ts
import apiClient from "@/lib/api-client";
import type { OperationNode } from "./lib/operationTree";
import type {
  CreateWorkbenchSessionPayload,
  UpdateWorkbenchSessionPayload,
  WorkbenchSession,
} from "./types";

const BASE = "/finngen/workbench/sessions";
const PREVIEW_URL = "/finngen/workbench/preview-counts";

export type PreviewCountsResponse = {
  total: number;
  cohort_ids: number[];
  operation_string: string;
};

export type PreviewCountsValidationError = {
  node_id: string;
  code: string;
  message: string;
};

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

  /**
   * SP4 Phase C — preview the row count for an operation tree without
   * materializing it. Returns total subjects + the compiled operation
   * string + the cohort_ids referenced by the tree.
   */
  previewCounts: async (
    sourceKey: string,
    tree: OperationNode,
  ): Promise<{ data: PreviewCountsResponse }> => {
    const { data } = await apiClient.post<{ data: PreviewCountsResponse }>(
      PREVIEW_URL,
      { source_key: sourceKey, tree },
    );
    return data;
  },
};
