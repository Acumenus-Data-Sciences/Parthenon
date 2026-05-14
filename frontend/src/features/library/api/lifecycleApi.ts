import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type {
  BulkLifecycleResponse,
  LibraryEntity,
  LifecycleResponse,
} from "../types";

export function usePromoteItem(entity: LibraryEntity) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number): Promise<LifecycleResponse> => {
      const { data } = await apiClient.post<LifecycleResponse>(
        `/${entity}/${id}/promote`,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [entity] }),
  });
}

export function useArchiveItem(entity: LibraryEntity) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number): Promise<LifecycleResponse> => {
      const { data } = await apiClient.post<LifecycleResponse>(
        `/${entity}/${id}/archive`,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [entity] }),
  });
}

export function useRestoreItem(entity: LibraryEntity) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number): Promise<LifecycleResponse> => {
      const { data } = await apiClient.post<LifecycleResponse>(
        `/${entity}/${id}/restore`,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [entity] }),
  });
}

export function useBulkArchive(entity: LibraryEntity) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]): Promise<BulkLifecycleResponse> => {
      const { data } = await apiClient.post<BulkLifecycleResponse>(
        `/${entity}/bulk-archive`,
        { ids },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [entity] }),
  });
}

export function useBulkRestore(entity: LibraryEntity) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]): Promise<BulkLifecycleResponse> => {
      const { data } = await apiClient.post<BulkLifecycleResponse>(
        `/${entity}/bulk-restore`,
        { ids },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [entity] }),
  });
}
