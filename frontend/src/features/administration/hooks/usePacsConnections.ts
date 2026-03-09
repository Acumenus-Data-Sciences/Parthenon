import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPacsConnections,
  createPacsConnection,
  updatePacsConnection,
  deletePacsConnection,
  testPacsConnection,
  refreshPacsStats,
  browsePacsStudies,
  setDefaultPacsConnection,
  type PacsConnectionPayload,
  type PacsStudyFilters,
} from "../api/pacsApi";

export function usePacsConnections() {
  return useQuery({
    queryKey: ["pacs-connections"],
    queryFn: fetchPacsConnections,
  });
}

export function useCreatePacsConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PacsConnectionPayload) => createPacsConnection(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pacs-connections"] }),
  });
}

export function useUpdatePacsConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PacsConnectionPayload> }) =>
      updatePacsConnection(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pacs-connections"] }),
  });
}

export function useDeletePacsConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePacsConnection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pacs-connections"] }),
  });
}

export function useTestPacsConnection() {
  return useMutation({
    mutationFn: (id: number) => testPacsConnection(id),
  });
}

export function useRefreshPacsStats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => refreshPacsStats(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pacs-connections"] }),
  });
}

export function usePacsStudies(connectionId: number | null, filters?: PacsStudyFilters) {
  return useQuery({
    queryKey: ["pacs-connections", connectionId, "studies", filters],
    queryFn: () => browsePacsStudies(connectionId!, filters),
    enabled: connectionId != null,
    staleTime: 30_000,
  });
}

export function useSetDefaultPacs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => setDefaultPacsConnection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pacs-connections"] }),
  });
}
