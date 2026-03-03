import apiClient, { toLaravelPaginated } from "@/lib/api-client";
import type {
  EvidenceSynthesisAnalysis,
  EvidenceSynthesisDesign,
} from "../types/evidenceSynthesis";
import type {
  AnalysisExecution,
  PaginatedResponse,
} from "@/features/analyses/types/analysis";

const BASE = "/evidence-synthesis";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listEvidenceSynthesis(params?: {
  page?: number;
}): Promise<PaginatedResponse<EvidenceSynthesisAnalysis>> {
  const { data } = await apiClient.get(BASE, { params });
  return toLaravelPaginated<EvidenceSynthesisAnalysis>(data);
}

export async function getEvidenceSynthesis(
  id: number,
): Promise<EvidenceSynthesisAnalysis> {
  const { data } = await apiClient.get(`${BASE}/${id}`);
  return data.data ?? data;
}

export async function createEvidenceSynthesis(payload: {
  name: string;
  description?: string;
  design_json: EvidenceSynthesisDesign;
}): Promise<EvidenceSynthesisAnalysis> {
  const { data } = await apiClient.post(BASE, payload);
  return data.data ?? data;
}

export async function updateEvidenceSynthesis(
  id: number,
  payload: Partial<{
    name: string;
    description: string;
    design_json: EvidenceSynthesisDesign;
  }>,
): Promise<EvidenceSynthesisAnalysis> {
  const { data } = await apiClient.put(`${BASE}/${id}`, payload);
  return data.data ?? data;
}

export async function deleteEvidenceSynthesis(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

// ---------------------------------------------------------------------------
// Execution (no source_id needed for meta-analysis)
// ---------------------------------------------------------------------------

export async function executeEvidenceSynthesis(
  id: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.post(`${BASE}/${id}/execute`);
  return data.data ?? data;
}

export async function listEvidenceSynthesisExecutions(
  id: number,
): Promise<AnalysisExecution[]> {
  const { data } = await apiClient.get<AnalysisExecution[]>(
    `${BASE}/${id}/executions`,
  );
  return data;
}

export async function getEvidenceSynthesisExecution(
  id: number,
  executionId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.get<AnalysisExecution>(
    `${BASE}/${id}/executions/${executionId}`,
  );
  return data;
}
