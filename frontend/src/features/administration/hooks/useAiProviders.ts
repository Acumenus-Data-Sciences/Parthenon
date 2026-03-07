import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateAiProvider,
  disableAiProvider,
  enableAiProvider,
  fetchAiProvider,
  fetchAiProviders,
  fetchServiceDetail,
  fetchSystemHealth,
  testAiProvider,
  updateAiProvider,
} from "../api/adminApi";

const QUERY_KEY = "ai-providers";
const HEALTH_KEY = "system-health";

export function useAiProviders() {
  return useQuery({ queryKey: [QUERY_KEY], queryFn: fetchAiProviders });
}

export function useAiProvider(type: string) {
  return useQuery({ queryKey: [QUERY_KEY, type], queryFn: () => fetchAiProvider(type) });
}

export function useUpdateAiProvider() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ type, data }: { type: string; data: Parameters<typeof updateAiProvider>[1] }) =>
      updateAiProvider(type, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useActivateAiProvider() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (type: string) => activateAiProvider(type),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useToggleAiProvider() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ type, enabled }: { type: string; enabled: boolean }) =>
      enabled ? enableAiProvider(type) : disableAiProvider(type),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useTestAiProvider() {
  return useMutation({
    mutationFn: (type: string) => testAiProvider(type),
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: [HEALTH_KEY],
    queryFn: fetchSystemHealth,
    refetchInterval: 30_000,
  });
}

export function useServiceDetail(key: string) {
  return useQuery({
    queryKey: [HEALTH_KEY, key],
    queryFn: () => fetchServiceDetail(key),
    refetchInterval: 15_000,
    enabled: !!key,
  });
}
