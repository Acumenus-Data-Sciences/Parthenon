import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

/**
 * App-level feature flags. Plan 2 owns the schema; Plan 3 only reads.
 * Other unrelated keys (e.g. text-to-sql dialect) coexist on the same payload.
 */
export interface AppSettingsPayload {
  ingestion: {
    templates_enabled: boolean;
  };
  // Other namespaces (e.g. text_to_sql) are intentionally not typed here —
  // they are owned by their respective features.
  [k: string]: unknown;
}

export function useAppSettings(): UseQueryResult<AppSettingsPayload> {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AppSettingsPayload }>(
        "/app-settings",
      );
      return data.data;
    },
    // 10s instead of 60s: app-settings drives the Aqueduct sub-tab gate, and
    // the backend already caches its templates-service health probe for 30s
    // server-side. A short SPA staleTime means the UI catches a flag flip
    // (e.g. templates service goes up/down) within seconds without hammering
    // the backend.
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}

export function useTemplatesEnabled(): boolean {
  const { data } = useAppSettings();
  return Boolean(data?.ingestion?.templates_enabled);
}
