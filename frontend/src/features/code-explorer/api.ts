import apiClient from "@/lib/api-client";
import { finngenApi } from "@/features/_finngen-foundation";
import type {
  AncestorDirection,
  AncestorsResponse,
  CodeCountsResponse,
  RelationshipsResponse,
  SourceReadiness,
} from "./types";

export const codeExplorerApi = {
  sourceReadiness: async (sourceKey: string): Promise<SourceReadiness> => {
    const { data } = await apiClient.get<SourceReadiness>(
      "/finngen/code-explorer/source-readiness",
      { params: { source: sourceKey } },
    );
    return data;
  },

  counts: async (sourceKey: string, conceptId: number): Promise<CodeCountsResponse> => {
    const { data } = await apiClient.get<CodeCountsResponse>(
      "/finngen/code-explorer/counts",
      { params: { source: sourceKey, concept_id: conceptId } },
    );
    return data;
  },

  relationships: async (sourceKey: string, conceptId: number): Promise<RelationshipsResponse> => {
    const { data } = await apiClient.get<RelationshipsResponse>(
      "/finngen/code-explorer/relationships",
      { params: { source: sourceKey, concept_id: conceptId } },
    );
    return data;
  },

  ancestors: async (
    sourceKey: string,
    conceptId: number,
    direction: AncestorDirection = "both",
    maxDepth = 3,
  ): Promise<AncestorsResponse> => {
    const { data } = await apiClient.get<AncestorsResponse>(
      "/finngen/code-explorer/ancestors",
      {
        params: {
          source: sourceKey,
          concept_id: conceptId,
          direction,
          max_depth: maxDepth,
        },
      },
    );
    return data;
  },

  createReport: async (sourceKey: string, conceptId: number, idempotencyKey: string) => {
    const { data } = await apiClient.post(
      "/finngen/code-explorer/report",
      { source_key: sourceKey, concept_id: conceptId },
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  },

  initializeSource: async (sourceKey: string, idempotencyKey: string) => {
    const { data } = await apiClient.post(
      "/finngen/code-explorer/initialize-source",
      { source_key: sourceKey },
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  },

  myReports: async () => finngenApi.listRuns({ analysis_type: "romopapi.report" }),
};
