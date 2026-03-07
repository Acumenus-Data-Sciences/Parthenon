import { useQuery } from "@tanstack/react-query";
import { radiogenomicsApi } from "../api/radiogenomicsApi";

const KEYS = {
  panel: (personId: number) => ["radiogenomics", "panel", personId] as const,
  interactions: (params?: Record<string, string>) => ["radiogenomics", "interactions", params] as const,
};

export function useRadiogenomicsPanel(personId: number, sourceId?: number) {
  return useQuery({
    queryKey: KEYS.panel(personId),
    queryFn: () => radiogenomicsApi.getPatientPanel(personId, sourceId),
    enabled: personId > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useVariantDrugInteractions(params?: { gene?: string; drug?: string; relationship?: string }) {
  return useQuery({
    queryKey: KEYS.interactions(params as Record<string, string>),
    queryFn: () => radiogenomicsApi.getVariantDrugInteractions(params),
    staleTime: 30 * 60 * 1000,
  });
}
