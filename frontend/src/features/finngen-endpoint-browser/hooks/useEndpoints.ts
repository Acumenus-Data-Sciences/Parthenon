// TanStack Query hooks for the FinnGen Endpoint Browser.
import { useMutation, useQuery, keepPreviousData } from "@tanstack/react-query";
import { finngenWorkbenchApi } from "@/features/finngen-workbench/api";
import {
  fetchEndpoint,
  fetchEndpointStats,
  fetchEndpoints,
  generateEndpoint,
  type GenerateEndpointPayload,
  type ListEndpointsParams,
} from "../api";

export function useEndpointStats() {
  return useQuery({
    queryKey: ["finngen-endpoints", "stats"],
    queryFn: fetchEndpointStats,
    staleTime: 60_000,
  });
}

export function useEndpointList(params: ListEndpointsParams) {
  return useQuery({
    queryKey: ["finngen-endpoints", "list", params],
    queryFn: () => fetchEndpoints(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useEndpointDetail(name: string | null) {
  return useQuery({
    queryKey: ["finngen-endpoints", "detail", name],
    queryFn: () => fetchEndpoint(name ?? ""),
    enabled: !!name,
    staleTime: 60_000,
  });
}

export function useGenerateEndpoint(name: string | null) {
  return useMutation({
    mutationFn: (payload: GenerateEndpointPayload) =>
      generateEndpoint(name ?? "", payload),
  });
}

// Genomics #2.6 — open a generated endpoint as a fresh workbench session
// with the cohort_definition_id pre-loaded as the root operation tree leaf.
// Closes the catalog → workbench loop so researchers can immediately layer
// UNION/INTERSECT/MINUS operations on top of a FinnGen-derived cohort.
export type OpenInWorkbenchParams = {
  endpointName: string;
  longname: string | null;
  cohortDefinitionId: number;
  sourceKey: string;
};

export function useOpenInWorkbench() {
  return useMutation({
    mutationFn: async (p: OpenInWorkbenchParams) => {
      const sessionState = {
        operation_tree: {
          kind: "cohort" as const,
          id: "n0",
          cohort_id: p.cohortDefinitionId,
        },
        selected_cohort_ids: [p.cohortDefinitionId],
        // Marker so the workbench UI knows this session was seeded from a
        // FinnGen endpoint (cheap follow-up: render an attribution badge).
        seeded_from: {
          kind: "finngen-endpoint",
          endpoint_name: p.endpointName,
        },
      };
      const created = await finngenWorkbenchApi.create({
        source_key: p.sourceKey,
        name: `${p.endpointName} on ${p.sourceKey}`,
        description: p.longname
          ? `Seeded from FinnGen endpoint ${p.endpointName} — ${p.longname}`
          : `Seeded from FinnGen endpoint ${p.endpointName}`,
        session_state: sessionState,
      });
      return created.data;
    },
  });
}
