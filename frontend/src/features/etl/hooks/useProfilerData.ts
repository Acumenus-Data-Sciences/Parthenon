import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchProfileHistory,
  fetchProfile,
  runPersistedScan,
  deleteProfile,
} from "../api";

export function useProfileHistory(sourceId: number) {
  return useQuery({
    queryKey: ["profiler", "history", sourceId],
    queryFn: () => fetchProfileHistory(sourceId),
    enabled: sourceId > 0,
    staleTime: 60_000,
  });
}

export function useProfile(sourceId: number, profileId: number) {
  return useQuery({
    queryKey: ["profiler", "detail", sourceId, profileId],
    queryFn: () => fetchProfile(sourceId, profileId),
    enabled: sourceId > 0 && profileId > 0,
  });
}

export function useRunScan(sourceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: { tables?: string[]; sample_rows?: number }) =>
      runPersistedScan(sourceId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiler", "history", sourceId] });
    },
  });
}

export function useDeleteProfile(sourceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: number) => deleteProfile(sourceId, profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiler", "history", sourceId] });
    },
  });
}
