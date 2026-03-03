import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSources,
  fetchSource,
  createSource,
  updateSource,
  deleteSource,
  importFromWebApi,
  fetchWebApiRegistries,
  createWebApiRegistry,
  updateWebApiRegistry,
  deleteWebApiRegistry,
  syncWebApiRegistry,
} from "../api/sourcesApi";

// ---------------------------------------------------------------------------
// Source hooks
// ---------------------------------------------------------------------------

export function useSources() {
  return useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });
}

export function useSource(id: number | null) {
  return useQuery({
    queryKey: ["sources", id],
    queryFn: () => fetchSource(id!),
    enabled: id != null && id > 0,
  });
}

export function useCreateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
  });
}

export function useUpdateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updateSource>[1] }) =>
      updateSource(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sources", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
  });
}

export function useDeleteSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
  });
}

// ---------------------------------------------------------------------------
// WebAPI import
// ---------------------------------------------------------------------------

export function useImportFromWebApi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importFromWebApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
  });
}

// ---------------------------------------------------------------------------
// WebAPI Registry hooks
// ---------------------------------------------------------------------------

export function useWebApiRegistries() {
  return useQuery({
    queryKey: ["webapi-registries"],
    queryFn: fetchWebApiRegistries,
  });
}

export function useCreateWebApiRegistry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWebApiRegistry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webapi-registries"] });
    },
  });
}

export function useUpdateWebApiRegistry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updateWebApiRegistry>[1] }) =>
      updateWebApiRegistry(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webapi-registries"] });
    },
  });
}

export function useDeleteWebApiRegistry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteWebApiRegistry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webapi-registries"] });
    },
  });
}

export function useSyncWebApiRegistry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => syncWebApiRegistry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["webapi-registries"] });
    },
  });
}
