import apiClient from "@/lib/api-client";

export interface AnalysisTypeStats {
  total: number;
  executed: number;
}

export interface AnalysisStats {
  characterizations: AnalysisTypeStats;
  incidence_rates: AnalysisTypeStats;
  pathways: AnalysisTypeStats;
  estimations: AnalysisTypeStats;
  predictions: AnalysisTypeStats;
  sccs: AnalysisTypeStats;
  evidence_synthesis: AnalysisTypeStats;
  grand_total: number;
}

export async function getAnalysisStats(): Promise<AnalysisStats> {
  const { data } = await apiClient.get("/analyses/stats");
  return data.data ?? data;
}
