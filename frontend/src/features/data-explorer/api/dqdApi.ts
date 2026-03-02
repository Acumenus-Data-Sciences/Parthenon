import apiClient from "@/lib/api-client";
import type {
  DqdRun,
  DqdRunSummary,
  DqdCheckResult,
} from "../types/dataExplorer";

const BASE = (sourceId: number) => `/sources/${sourceId}/dqd`;

export async function fetchDqdRuns(sourceId: number): Promise<DqdRun[]> {
  const { data } = await apiClient.get<DqdRun[]>(`${BASE(sourceId)}/runs`);
  return data;
}

export async function fetchDqdRun(
  sourceId: number,
  runId: string,
): Promise<DqdRunSummary> {
  const { data } = await apiClient.get<DqdRunSummary>(
    `${BASE(sourceId)}/runs/${runId}`,
  );
  return data;
}

export async function fetchDqdResults(
  sourceId: number,
  runId: string,
  params?: {
    category?: string;
    table?: string;
    passed?: boolean;
    page?: number;
    per_page?: number;
  },
): Promise<{
  data: DqdCheckResult[];
  total: number;
  page: number;
  per_page: number;
}> {
  const { data } = await apiClient.get<{
    data: DqdCheckResult[];
    total: number;
    page: number;
    per_page: number;
  }>(`${BASE(sourceId)}/runs/${runId}/results`, { params });
  return data;
}

export async function fetchDqdSummary(
  sourceId: number,
  runId: string,
): Promise<DqdRunSummary> {
  const { data } = await apiClient.get<DqdRunSummary>(
    `${BASE(sourceId)}/runs/${runId}/summary`,
  );
  return data;
}

export async function fetchDqdTableResults(
  sourceId: number,
  runId: string,
  table: string,
): Promise<DqdCheckResult[]> {
  const { data } = await apiClient.get<DqdCheckResult[]>(
    `${BASE(sourceId)}/runs/${runId}/tables/${table}`,
  );
  return data;
}

export async function dispatchDqdRun(
  sourceId: number,
  params?: { category?: string; table?: string },
): Promise<{ run_id: string; message: string }> {
  const { data } = await apiClient.post<{ run_id: string; message: string }>(
    `${BASE(sourceId)}/run`,
    params,
  );
  return data;
}

export async function fetchLatestDqd(
  sourceId: number,
): Promise<DqdRunSummary | null> {
  try {
    const { data } = await apiClient.get<DqdRunSummary>(
      `${BASE(sourceId)}/latest`,
    );
    return data;
  } catch {
    return null;
  }
}

export async function deleteDqdRun(
  sourceId: number,
  runId: string,
): Promise<void> {
  await apiClient.delete(`${BASE(sourceId)}/runs/${runId}`);
}
