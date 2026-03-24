import apiClient from "@/lib/api-client";

const BASE = (sourceId: number) => `/sources/${sourceId}/achilles`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap<T>(body: any): T {
  if (body && typeof body === "object" && "data" in body && !Array.isArray(body)) {
    return body.data as T;
  }
  return body as T;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface AchillesRunStep {
  analysis_id: number;
  analysis_name: string;
  category: string;
  status: "pending" | "running" | "completed" | "failed";
  elapsed_seconds: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface AchillesRunCategory {
  category: string;
  total: number;
  completed: number;
  failed: number;
  running: number;
  steps: AchillesRunStep[];
}

export interface AchillesRunProgress {
  run_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  total_analyses: number;
  completed_analyses: number;
  failed_analyses: number;
  started_at: string | null;
  completed_at: string | null;
  categories: AchillesRunCategory[];
}

export interface AchillesRunSummary {
  run_id: string;
  status: string;
  total_analyses: number;
  completed_analyses: number;
  failed_analyses: number;
  categories: string[] | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface RunAchillesResponse {
  run_id: string;
  total_analyses: number;
  message: string;
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function runAchilles(
  sourceId: number,
  options?: { categories?: string[]; fresh?: boolean },
): Promise<RunAchillesResponse> {
  const { data } = await apiClient.post(`${BASE(sourceId)}/run`, options);
  return unwrap<RunAchillesResponse>(data);
}

export async function fetchAchillesRuns(
  sourceId: number,
): Promise<AchillesRunSummary[]> {
  const { data } = await apiClient.get(`${BASE(sourceId)}/runs`);
  return unwrap<AchillesRunSummary[]>(data);
}

export async function fetchAchillesProgress(
  sourceId: number,
  runId: string,
): Promise<AchillesRunProgress> {
  const { data } = await apiClient.get(`${BASE(sourceId)}/runs/${runId}/progress`);
  return unwrap<AchillesRunProgress>(data);
}
