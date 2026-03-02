import apiClient from "@/lib/api-client";
import type {
  IncidenceRateAnalysis,
  IncidenceRateDesign,
  AnalysisExecution,
  PaginatedResponse,
} from "../types/analysis";

const BASE = "/incidence-rates";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listIncidenceRates(params?: {
  page?: number;
}): Promise<PaginatedResponse<IncidenceRateAnalysis>> {
  const { data } = await apiClient.get<
    PaginatedResponse<IncidenceRateAnalysis>
  >(BASE, { params });
  return data;
}

export async function getIncidenceRate(
  id: number,
): Promise<IncidenceRateAnalysis> {
  const { data } = await apiClient.get<IncidenceRateAnalysis>(`${BASE}/${id}`);
  return data;
}

export async function createIncidenceRate(payload: {
  name: string;
  description?: string;
  design_json: IncidenceRateDesign;
}): Promise<IncidenceRateAnalysis> {
  const { data } = await apiClient.post<IncidenceRateAnalysis>(BASE, payload);
  return data;
}

export async function updateIncidenceRate(
  id: number,
  payload: Partial<{
    name: string;
    description: string;
    design_json: IncidenceRateDesign;
  }>,
): Promise<IncidenceRateAnalysis> {
  const { data } = await apiClient.put<IncidenceRateAnalysis>(
    `${BASE}/${id}`,
    payload,
  );
  return data;
}

export async function deleteIncidenceRate(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export async function executeIncidenceRate(
  id: number,
  sourceId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.post<AnalysisExecution>(
    `${BASE}/${id}/execute`,
    { source_id: sourceId },
  );
  return data;
}

export async function listIRExecutions(
  id: number,
): Promise<AnalysisExecution[]> {
  const { data } = await apiClient.get<AnalysisExecution[]>(
    `${BASE}/${id}/executions`,
  );
  return data;
}

export async function getIRExecution(
  id: number,
  executionId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.get<AnalysisExecution>(
    `${BASE}/${id}/executions/${executionId}`,
  );
  return data;
}
