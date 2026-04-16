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
const MATCH_URL = "/finngen/workbench/match";
const MATERIALIZE_URL = "/finngen/workbench/materialize";

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

export type MatchCohortPayload = {
  source_key: string;
  primary_cohort_id: number;
  comparator_cohort_ids: number[];
  ratio?: number;
  match_sex?: boolean;
  match_birth_year?: boolean;
  max_year_difference?: number;
};

// The match endpoint returns the freshly-created Run record (status=queued).
// Caller polls /api/v1/finngen/runs/{id} for terminal status + summary.counts.
export type MatchCohortRunResponse = {
  id: string;
  status: string;
  analysis_type: string;
  source_key: string;
  params: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// SP4 Polish 2 — materialize endpoint response.
export type MaterializeCohortPayload = {
  source_key: string;
  name: string;
  description?: string | null;
  tree: OperationNode;
};

export type MaterializeCohortResponse = {
  run: MatchCohortRunResponse; // same Run envelope; analysis_type = cohort.materialize
  cohort_definition_id: number;
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

  /**
   * SP4 Phase D — dispatch a cohort.match analysis run. Returns the
   * freshly-created Run record (status=queued); caller polls
   * /api/v1/finngen/runs/{id} for terminal status + summary.counts.
   */
  matchCohort: async (
    payload: MatchCohortPayload,
  ): Promise<{ data: MatchCohortRunResponse }> => {
    const { data } = await apiClient.post<{ data: MatchCohortRunResponse }>(MATCH_URL, payload);
    return data;
  },

  /**
   * SP4 Polish 2 — dispatch a cohort.materialize run. Laravel creates the
   * cohort_definition row, compiles the tree, and hands off to Darkstar.
   * Returns the Run record + the new cohort_definition_id (so the UI can
   * wire the Handoff step once the run is succeeded).
   */
  materializeCohort: async (
    payload: MaterializeCohortPayload,
  ): Promise<{ data: MaterializeCohortResponse }> => {
    const { data } = await apiClient.post<{ data: MaterializeCohortResponse }>(
      MATERIALIZE_URL,
      payload,
    );
    return data;
  },
};
