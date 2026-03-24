import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchReleases,
  createRelease,
  updateRelease,
  deleteRelease,
} from "../api/releaseApi";
import type { StoreReleasePayload, UpdateReleasePayload } from "../types/ares";

export function useReleases(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "releases", sourceId],
    queryFn: () => fetchReleases(sourceId!),
    enabled: sourceId != null && sourceId > 0,
  });
}

export function useCreateRelease(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StoreReleasePayload) => createRelease(sourceId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ares", "releases", sourceId] });
    },
  });
}

export function useUpdateRelease(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ releaseId, payload }: { releaseId: number; payload: UpdateReleasePayload }) =>
      updateRelease(sourceId, releaseId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ares", "releases", sourceId] });
    },
  });
}

export function useDeleteRelease(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (releaseId: number) => deleteRelease(sourceId, releaseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ares", "releases", sourceId] });
    },
  });
}
