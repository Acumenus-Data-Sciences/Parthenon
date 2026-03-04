import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getConceptSets,
  getConceptSet,
  resolveConceptSet,
  createConceptSet,
  updateConceptSet,
  deleteConceptSet,
  addConceptSetItem,
  updateConceptSetItem,
  removeConceptSetItem,
  getConceptSetStats,
  copyConceptSet,
  createConceptSetsFromBundle,
  bulkUpdateConceptSetItems,
} from "../api/conceptSetApi";
import type {
  ConceptSetListParams,
  CreateConceptSetPayload,
  UpdateConceptSetPayload,
  AddConceptSetItemPayload,
  UpdateConceptSetItemPayload,
  BulkUpdateConceptSetItemsPayload,
} from "../types/conceptSet";

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useConceptSets(params?: ConceptSetListParams) {
  return useQuery({
    queryKey: ["concept-sets", params],
    queryFn: () => getConceptSets(params),
  });
}

export function useConceptSet(id: number | null) {
  return useQuery({
    queryKey: ["concept-sets", id],
    queryFn: () => getConceptSet(id!),
    enabled: id != null && id > 0,
  });
}

export function useResolveConceptSet(id: number | null) {
  return useQuery({
    queryKey: ["concept-sets", id, "resolve"],
    queryFn: () => resolveConceptSet(id!),
    enabled: id != null && id > 0,
  });
}

export function useConceptSetStats() {
  return useQuery({
    queryKey: ["concept-sets", "stats"],
    queryFn: getConceptSetStats,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateConceptSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateConceptSetPayload) =>
      createConceptSet(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["concept-sets"] });
    },
  });
}

export function useUpdateConceptSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateConceptSetPayload }) =>
      updateConceptSet(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["concept-sets", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["concept-sets"] });
    },
  });
}

export function useDeleteConceptSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteConceptSet(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["concept-sets"] });
    },
  });
}

export function useAddConceptSetItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      setId,
      payload,
    }: {
      setId: number;
      payload: AddConceptSetItemPayload;
    }) => addConceptSetItem(setId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["concept-sets", variables.setId],
      });
    },
  });
}

export function useUpdateConceptSetItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      setId,
      itemId,
      payload,
    }: {
      setId: number;
      itemId: number;
      payload: UpdateConceptSetItemPayload;
    }) => updateConceptSetItem(setId, itemId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["concept-sets", variables.setId],
      });
    },
  });
}

export function useRemoveConceptSetItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ setId, itemId }: { setId: number; itemId: number }) =>
      removeConceptSetItem(setId, itemId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["concept-sets", variables.setId],
      });
    },
  });
}

export function useCopyConceptSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => copyConceptSet(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["concept-sets"] });
    },
  });
}

export function useCreateConceptSetsFromBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createConceptSetsFromBundle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["concept-sets"] });
    },
  });
}

export function useBulkUpdateConceptSetItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      setId,
      payload,
    }: {
      setId: number;
      payload: BulkUpdateConceptSetItemsPayload;
    }) => bulkUpdateConceptSetItems(setId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["concept-sets", variables.setId],
      });
    },
  });
}
