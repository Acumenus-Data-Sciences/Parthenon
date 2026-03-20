import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvestigation,
  fetchInvestigation,
  fetchInvestigations,
  saveDomainState,
  updateInvestigation,
} from "../api";
import type { EvidenceDomain, InvestigationStatus } from "../types";

export function useInvestigations(status?: InvestigationStatus) {
  return useQuery({
    queryKey: ["investigations", status],
    queryFn: () => fetchInvestigations(status),
  });
}

export function useInvestigation(id: number | undefined) {
  return useQuery({
    queryKey: ["investigation", id],
    queryFn: () => fetchInvestigation(id!),
    enabled: !!id,
  });
}

export function useCreateInvestigation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInvestigation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["investigations"] });
    },
  });
}

export function useUpdateInvestigation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Parameters<typeof updateInvestigation>[1];
    }) => updateInvestigation(id, payload),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ["investigations"] });
      void queryClient.invalidateQueries({ queryKey: ["investigation", id] });
    },
  });
}

export function useSaveDomainState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      domain,
      state,
    }: {
      id: number;
      domain: EvidenceDomain;
      state: Record<string, unknown>;
    }) => saveDomainState(id, domain, state),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ["investigation", id] });
    },
  });
}
