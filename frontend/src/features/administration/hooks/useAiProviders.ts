import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateAiProvider,
  disableAiProvider,
  enableAiProvider,
  fetchAgentSettings,
  fetchAiProvider,
  fetchAiProviders,
  fetchHadesPackageInventory,
  fetchLiveKitConfig,
  fetchServiceDetail,
  fetchSystemHealth,
  setAgentSettings,
  testAiProvider,
  testLiveKitConnection,
  updateAiProvider,
  updateLiveKitConfig,
} from "../api/adminApi";

// Feature-flags query key — must match the key used in useFeatureFlagsQuery
// (frontend/src/features/system/api.ts) so invalidation refreshes useFlag().
const FEATURE_FLAGS_KEY = ["system", "feature-flags"] as const;

const QUERY_KEY = "ai-providers";
const HEALTH_KEY = "system-health";
const HADES_PACKAGES_KEY = "hades-packages";

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

export function useHadesPackageInventory() {
  return useQuery({
    queryKey: [HADES_PACKAGES_KEY],
    queryFn: fetchHadesPackageInventory,
    refetchInterval: 60_000,
  });
}

// ── LiveKit Config ────────────────────────────────────────────────────────────

const LIVEKIT_KEY = "livekit-config";

export function useLiveKitConfig() {
  return useQuery({ queryKey: [LIVEKIT_KEY], queryFn: fetchLiveKitConfig });
}

export function useUpdateLiveKitConfig() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: updateLiveKitConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIVEKIT_KEY] });
      qc.invalidateQueries({ queryKey: [HEALTH_KEY] });
    },
  });
}

export function useTestLiveKitConnection() {
  return useMutation({ mutationFn: testLiveKitConnection });
}

// ── AI Agents Feature Flag ────────────────────────────────────────────────────

const AGENT_SETTINGS_KEY = "ai-agents";

export function useAgentSettings() {
  return useQuery({
    queryKey: [AGENT_SETTINGS_KEY],
    queryFn: fetchAgentSettings,
  });
}

export function useSetAgentSettings() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (enabled: boolean) => setAgentSettings(enabled),
    onSuccess: () => {
      // Invalidate the agent settings cache so the toggle reflects the new state.
      void qc.invalidateQueries({ queryKey: [AGENT_SETTINGS_KEY] });
      // Invalidate the feature-flags query so useFlag("ai.agents") refreshes
      // app-wide. FlagsLoader calls useFeatureFlagsQuery which uses this key;
      // the refetch re-runs setFlags() on the store, updating every subscriber.
      void qc.invalidateQueries({ queryKey: [...FEATURE_FLAGS_KEY] });
    },
  });
}
