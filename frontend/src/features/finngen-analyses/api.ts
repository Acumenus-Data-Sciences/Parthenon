// frontend/src/features/finngen-analyses/api.ts
import apiClient from "@/lib/api-client";
import type { FinnGenAnalysisModule } from "@/features/_finngen-foundation";

export const finngenAnalysesApi = {
  listModules: async (): Promise<{ data: FinnGenAnalysisModule[] }> => {
    const { data } = await apiClient.get<{ data: FinnGenAnalysisModule[] }>(
      "/finngen/analyses/modules",
    );
    return data;
  },

  getModule: async (key: string): Promise<{ data: FinnGenAnalysisModule }> => {
    const { data } = await apiClient.get<{ data: FinnGenAnalysisModule }>(
      `/finngen/analyses/modules/${encodeURIComponent(key)}`,
    );
    return data;
  },

  getDisplayArtifact: async <T = unknown>(runId: string): Promise<T> => {
    const { data } = await apiClient.get<T>(
      `/finngen/runs/${runId}/artifacts/display`,
    );
    return data;
  },
};
