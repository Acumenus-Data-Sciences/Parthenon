import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPoseidonDashboard,
  fetchPoseidonRuns,
  fetchPoseidonRun,
  fetchPoseidonFreshness,
  fetchPoseidonLineage,
  triggerPoseidonRun,
  cancelPoseidonRun,
  createPoseidonSchedule,
  updatePoseidonSchedule,
  deletePoseidonSchedule,
} from "../api/poseidonApi";
import type { PoseidonSchedule } from "../api/poseidonApi";

const KEYS = {
  dashboard: ["poseidon", "dashboard"] as const,
  runs: (params?: Record<string, unknown>) => ["poseidon", "runs", params] as const,
  run: (id: number) => ["poseidon", "run", id] as const,
  freshness: ["poseidon", "freshness"] as const,
  lineage: ["poseidon", "lineage"] as const,
};

export function usePoseidonDashboard() {
  return useQuery({
    queryKey: KEYS.dashboard,
    queryFn: fetchPoseidonDashboard,
    refetchInterval: 15_000,
  });
}

export function usePoseidonRuns(params?: { source_id?: number; status?: string }) {
  return useQuery({
    queryKey: KEYS.runs(params),
    queryFn: () => fetchPoseidonRuns(params),
    refetchInterval: 10_000,
  });
}

export function usePoseidonRun(id: number) {
  return useQuery({
    queryKey: KEYS.run(id),
    queryFn: () => fetchPoseidonRun(id),
    refetchInterval: 5_000,
  });
}

export function usePoseidonFreshness() {
  return useQuery({
    queryKey: KEYS.freshness,
    queryFn: fetchPoseidonFreshness,
    refetchInterval: 30_000,
  });
}

export function usePoseidonLineage() {
  return useQuery({
    queryKey: KEYS.lineage,
    queryFn: fetchPoseidonLineage,
  });
}

export function useTriggerPoseidonRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: triggerPoseidonRun,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["poseidon"] });
    },
  });
}

export function useCancelPoseidonRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelPoseidonRun,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["poseidon"] });
    },
  });
}

export function useCreatePoseidonSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Pick<PoseidonSchedule, "source_id" | "schedule_type" | "cron_expr" | "is_active" | "dbt_selector">) =>
      createPoseidonSchedule(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["poseidon"] });
    },
  });
}

export function useUpdatePoseidonSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Pick<PoseidonSchedule, "schedule_type" | "cron_expr" | "is_active" | "dbt_selector" | "sensor_config">>) =>
      updatePoseidonSchedule(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["poseidon"] });
    },
  });
}

export function useDeletePoseidonSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePoseidonSchedule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["poseidon"] });
    },
  });
}
