import { useQuery } from "@tanstack/react-query";

import apiClient from "@/lib/api-client";
import { useFeatureFlagsStore } from "@/stores/featureFlagsStore";
import type { FeatureFlag } from "@/types/featureFlags";

interface FeatureFlagsResponse {
  data: FeatureFlag[];
}

/**
 * Fetches deployment-level feature flags from `/api/v1/system/feature-flags`
 * and hydrates the {@link useFeatureFlagsStore}.
 *
 * Stale time: 5 minutes — feature flags are deployment-level and rarely
 * change inside a session. Auth/login flows that flip server-side state
 * should call `useFeatureFlagsStore.getState().reset()` and refetch.
 */
export function useFeatureFlagsQuery() {
  const setFlags = useFeatureFlagsStore((s) => s.setFlags);
  const setError = useFeatureFlagsStore((s) => s.setError);

  return useQuery({
    queryKey: ["system", "feature-flags"],
    queryFn: async (): Promise<FeatureFlag[]> => {
      try {
        const response = await apiClient.get<FeatureFlagsResponse>("/system/feature-flags");
        const flags = response.data.data;
        setFlags(flags);
        return flags;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load feature flags";
        setError(message);
        throw e;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
