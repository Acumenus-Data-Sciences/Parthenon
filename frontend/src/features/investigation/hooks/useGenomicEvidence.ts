import { useMutation, useQuery } from "@tanstack/react-query";
import { queryOpenTargets, queryGwasCatalog, uploadGwas, fetchCrossLinks } from "../api";

export function useOpenTargetsSearch(investigationId: number, queryType: "gene" | "disease", term: string) {
  return useQuery({
    queryKey: ["opentargets", investigationId, queryType, term],
    queryFn: () => queryOpenTargets(investigationId, queryType, term),
    enabled: !!investigationId && term.length >= 2,
    staleTime: 86_400_000,
  });
}

export function useGwasCatalogSearch(investigationId: number, queryType: "trait" | "gene", term: string) {
  return useQuery({
    queryKey: ["gwas-catalog", investigationId, queryType, term],
    queryFn: () => queryGwasCatalog(investigationId, queryType, term),
    enabled: !!investigationId && term.length >= 2,
    staleTime: 86_400_000,
  });
}

export function useUploadGwas() {
  return useMutation({
    mutationFn: ({ investigationId, file, columnMapping }: {
      investigationId: number; file: File; columnMapping?: Record<string, string>;
    }) => uploadGwas(investigationId, file, columnMapping),
  });
}

export function useCrossLinks(investigationId: number) {
  return useQuery({
    queryKey: ["cross-links", investigationId],
    queryFn: () => fetchCrossLinks(investigationId),
    enabled: !!investigationId,
    staleTime: 30_000,
  });
}
