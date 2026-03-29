import apiClient from "@/lib/api-client";

/* ── Types ──────────────────────────────────────────────────────────── */

export interface PoseidonSchedule {
  id: number;
  source_id: number;
  schedule_type: "manual" | "cron" | "sensor";
  cron_expr: string | null;
  sensor_config: Record<string, unknown> | null;
  is_active: boolean;
  dbt_selector: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  runs_count?: number;
  source?: { id: number; source_name: string; source_key: string };
}

export interface PoseidonRun {
  id: number;
  dagster_run_id: string;
  source_id: number | null;
  schedule_id: number | null;
  run_type: "incremental" | "full_refresh" | "vocabulary";
  status: "pending" | "running" | "success" | "failed" | "cancelled";
  started_at: string | null;
  completed_at: string | null;
  stats: {
    rows_inserted?: number;
    rows_updated?: number;
    models_run?: number;
    tests_passed?: number;
    tests_failed?: number;
  } | null;
  error_message: string | null;
  triggered_by: "manual" | "schedule" | "sensor";
  created_by: number | null;
  created_at: string;
  updated_at: string;
  source?: { id: number; source_name: string; source_key: string };
  schedule?: PoseidonSchedule;
}

export interface PoseidonRunStats {
  total: number;
  success: number;
  failed: number;
  active: number;
}

export interface PoseidonDashboard {
  active_schedules: number;
  total_schedules: number;
  active_runs: number;
  run_stats: PoseidonRunStats;
  recent_runs: PoseidonRun[];
  schedules: PoseidonSchedule[];
}

export interface PoseidonLineageNode {
  key: string;
  dependencies: string[];
}

export interface PoseidonFreshness {
  table: string;
  last_materialized: string | null;
}

/* ── API calls ──────────────────────────────────────────────────────── */

export function fetchPoseidonDashboard(): Promise<PoseidonDashboard> {
  return apiClient.get("/poseidon/dashboard").then((r) => r.data.data);
}

export function fetchPoseidonSchedules(): Promise<PoseidonSchedule[]> {
  return apiClient.get("/poseidon/schedules").then((r) => r.data.data);
}

export function createPoseidonSchedule(
  data: Pick<PoseidonSchedule, "source_id" | "schedule_type" | "cron_expr" | "is_active" | "dbt_selector">,
): Promise<PoseidonSchedule> {
  return apiClient.post("/poseidon/schedules", data).then((r) => r.data.data);
}

export function updatePoseidonSchedule(
  id: number,
  data: Partial<Pick<PoseidonSchedule, "schedule_type" | "cron_expr" | "is_active" | "dbt_selector" | "sensor_config">>,
): Promise<PoseidonSchedule> {
  return apiClient.put(`/poseidon/schedules/${id}`, data).then((r) => r.data.data);
}

export function deletePoseidonSchedule(id: number): Promise<void> {
  return apiClient.delete(`/poseidon/schedules/${id}`);
}

export function fetchPoseidonRuns(params?: {
  source_id?: number;
  status?: string;
  per_page?: number;
}): Promise<{ data: PoseidonRun[]; meta?: { total: number } }> {
  return apiClient.get("/poseidon/runs", { params }).then((r) => r.data);
}

export function fetchPoseidonRun(id: number): Promise<PoseidonRun> {
  return apiClient.get(`/poseidon/runs/${id}`).then((r) => r.data.data);
}

export function triggerPoseidonRun(data: {
  source_id?: number;
  run_type: "incremental" | "full_refresh" | "vocabulary";
  schedule_id?: number;
  dbt_selector?: string;
}): Promise<PoseidonRun> {
  return apiClient.post("/poseidon/runs/trigger", data).then((r) => r.data.data);
}

export function cancelPoseidonRun(id: number): Promise<PoseidonRun> {
  return apiClient.post(`/poseidon/runs/${id}/cancel`).then((r) => r.data.data);
}

export function fetchPoseidonFreshness(): Promise<Record<string, PoseidonFreshness>> {
  return apiClient.get("/poseidon/freshness").then((r) => r.data.data);
}

export function fetchPoseidonLineage(): Promise<PoseidonLineageNode[]> {
  return apiClient.get("/poseidon/lineage").then((r) => r.data.data);
}
