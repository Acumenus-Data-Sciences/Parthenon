import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { heorApi } from "../api/heorApi";

export const HEOR_KEYS = {
  stats: ["heor", "stats"] as const,
  analyses: ["heor", "analyses"] as const,
  analysis: (id: number) => ["heor", "analysis", id] as const,
  results: (id: number) => ["heor", "results", id] as const,
  contracts: ["heor", "contracts"] as const,
};

export function useHeorStats() {
  return useQuery({ queryKey: HEOR_KEYS.stats, queryFn: heorApi.getStats });
}

export function useHeorAnalyses() {
  return useQuery({ queryKey: HEOR_KEYS.analyses, queryFn: () => heorApi.getAnalyses() });
}

export function useHeorAnalysis(id: number) {
  return useQuery({
    queryKey: HEOR_KEYS.analysis(id),
    queryFn: () => heorApi.getAnalysis(id),
    enabled: id > 0,
  });
}

export function useCreateHeorAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: heorApi.createAnalysis,
    onSuccess: () => qc.invalidateQueries({ queryKey: HEOR_KEYS.analyses }),
  });
}

export function useDeleteHeorAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: heorApi.deleteAnalysis,
    onSuccess: () => qc.invalidateQueries({ queryKey: HEOR_KEYS.analyses }),
  });
}

export function useCreateScenario(analysisId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof heorApi.createScenario>[1]) =>
      heorApi.createScenario(analysisId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: HEOR_KEYS.analysis(analysisId) }),
  });
}

export function useDeleteScenario(analysisId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scenarioId: number) => heorApi.deleteScenario(analysisId, scenarioId),
    onSuccess: () => qc.invalidateQueries({ queryKey: HEOR_KEYS.analysis(analysisId) }),
  });
}

export function useCreateParameter(analysisId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof heorApi.createParameter>[1]) =>
      heorApi.createParameter(analysisId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: HEOR_KEYS.analysis(analysisId) }),
  });
}

export function useDeleteParameter(analysisId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paramId: number) => heorApi.deleteParameter(analysisId, paramId),
    onSuccess: () => qc.invalidateQueries({ queryKey: HEOR_KEYS.analysis(analysisId) }),
  });
}

export function useRunAnalysis(analysisId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => heorApi.runAnalysis(analysisId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HEOR_KEYS.analysis(analysisId) });
      qc.invalidateQueries({ queryKey: HEOR_KEYS.results(analysisId) });
    },
  });
}

export function useHeorResults(analysisId: number) {
  return useQuery({
    queryKey: HEOR_KEYS.results(analysisId),
    queryFn: () => heorApi.getResults(analysisId),
    enabled: analysisId > 0,
  });
}

export function useHeorContracts() {
  return useQuery({ queryKey: HEOR_KEYS.contracts, queryFn: heorApi.getContracts });
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: heorApi.createContract,
    onSuccess: () => qc.invalidateQueries({ queryKey: HEOR_KEYS.contracts }),
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: heorApi.deleteContract,
    onSuccess: () => qc.invalidateQueries({ queryKey: HEOR_KEYS.contracts }),
  });
}

export function useSimulateRebate() {
  return useMutation({
    mutationFn: ({ contractId, observedRate }: { contractId: number; observedRate: number }) =>
      heorApi.simulateRebate(contractId, observedRate),
  });
}
