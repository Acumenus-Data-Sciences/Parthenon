import apiClient from "@/lib/api-client";
import type {
  HeorAnalysis,
  HeorScenario,
  HeorCostParameter,
  HeorResult,
  HeorValueContract,
  HeorStats,
  RebateSimulation,
} from "../types";

export const heorApi = {
  // Stats
  getStats: () =>
    apiClient.get<{ data: HeorStats }>("/heor/stats").then((r) => r.data.data),

  // Analyses
  getAnalyses: (params?: { per_page?: number }) =>
    apiClient.get<{ data: HeorAnalysis[]; total: number }>("/heor/analyses", { params }).then((r) => r.data),

  createAnalysis: (payload: Partial<HeorAnalysis>) =>
    apiClient.post<{ data: HeorAnalysis }>("/heor/analyses", payload).then((r) => r.data.data),

  getAnalysis: (id: number) =>
    apiClient.get<{ data: HeorAnalysis }>(`/heor/analyses/${id}`).then((r) => r.data.data),

  updateAnalysis: (id: number, payload: Partial<HeorAnalysis>) =>
    apiClient.put<{ data: HeorAnalysis }>(`/heor/analyses/${id}`, payload).then((r) => r.data.data),

  deleteAnalysis: (id: number) => apiClient.delete(`/heor/analyses/${id}`),

  // Scenarios
  getScenarios: (analysisId: number) =>
    apiClient.get<{ data: HeorScenario[] }>(`/heor/analyses/${analysisId}/scenarios`).then((r) => r.data.data),

  createScenario: (analysisId: number, payload: Partial<HeorScenario>) =>
    apiClient.post<{ data: HeorScenario }>(`/heor/analyses/${analysisId}/scenarios`, payload).then((r) => r.data.data),

  updateScenario: (analysisId: number, scenarioId: number, payload: Partial<HeorScenario>) =>
    apiClient.put<{ data: HeorScenario }>(`/heor/analyses/${analysisId}/scenarios/${scenarioId}`, payload).then((r) => r.data.data),

  deleteScenario: (analysisId: number, scenarioId: number) =>
    apiClient.delete(`/heor/analyses/${analysisId}/scenarios/${scenarioId}`),

  // Parameters
  getParameters: (analysisId: number) =>
    apiClient.get<{ data: HeorCostParameter[] }>(`/heor/analyses/${analysisId}/parameters`).then((r) => r.data.data),

  createParameter: (analysisId: number, payload: Partial<HeorCostParameter>) =>
    apiClient.post<{ data: HeorCostParameter }>(`/heor/analyses/${analysisId}/parameters`, payload).then((r) => r.data.data),

  updateParameter: (analysisId: number, paramId: number, payload: Partial<HeorCostParameter>) =>
    apiClient.put<{ data: HeorCostParameter }>(`/heor/analyses/${analysisId}/parameters/${paramId}`, payload).then((r) => r.data.data),

  deleteParameter: (analysisId: number, paramId: number) =>
    apiClient.delete(`/heor/analyses/${analysisId}/parameters/${paramId}`),

  // Run
  runAnalysis: (analysisId: number) =>
    apiClient.post<{ data: { scenarios_computed: number; errors: number } }>(`/heor/analyses/${analysisId}/run`).then((r) => r.data.data),

  getResults: (analysisId: number) =>
    apiClient.get<{ data: HeorResult[] }>(`/heor/analyses/${analysisId}/results`).then((r) => r.data.data),

  // Contracts
  getContracts: () =>
    apiClient.get<{ data: HeorValueContract[] }>("/heor/contracts").then((r) => r.data.data),

  createContract: (payload: Partial<HeorValueContract>) =>
    apiClient.post<{ data: HeorValueContract }>("/heor/contracts", payload).then((r) => r.data.data),

  updateContract: (id: number, payload: Partial<HeorValueContract>) =>
    apiClient.put<{ data: HeorValueContract }>(`/heor/contracts/${id}`, payload).then((r) => r.data.data),

  deleteContract: (id: number) => apiClient.delete(`/heor/contracts/${id}`),

  simulateRebate: (contractId: number, observedRate: number) =>
    apiClient.post<{ data: RebateSimulation }>(`/heor/contracts/${contractId}/simulate-rebate`, { observed_rate: observedRate }).then((r) => r.data.data),
};
