import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchFhirConnections,
  fetchFhirConnection,
  createFhirConnection,
  updateFhirConnection,
  deleteFhirConnection,
  testFhirConnection,
  startFhirSync,
  fetchFhirSyncRuns,
  type FhirConnectionPayload,
} from "../api/adminApi";

export function useFhirConnections() {
  return useQuery({
    queryKey: ["admin", "fhir-connections"],
    queryFn: fetchFhirConnections,
  });
}

export function useFhirConnection(id: number) {
  return useQuery({
    queryKey: ["admin", "fhir-connections", id],
    queryFn: () => fetchFhirConnection(id),
    enabled: id > 0,
  });
}

export function useCreateFhirConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FhirConnectionPayload) => createFhirConnection(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "fhir-connections"] }),
  });
}

export function useUpdateFhirConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FhirConnectionPayload> }) =>
      updateFhirConnection(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "fhir-connections"] }),
  });
}

export function useDeleteFhirConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteFhirConnection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "fhir-connections"] }),
  });
}

export function useTestFhirConnection() {
  return useMutation({
    mutationFn: (id: number) => testFhirConnection(id),
  });
}

export function useStartFhirSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => startFhirSync(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["admin", "fhir-connections"] });
      qc.invalidateQueries({ queryKey: ["admin", "fhir-connections", id, "sync-runs"] });
    },
  });
}

export function useFhirSyncRuns(connectionId: number) {
  return useQuery({
    queryKey: ["admin", "fhir-connections", connectionId, "sync-runs"],
    queryFn: () => fetchFhirSyncRuns(connectionId),
    enabled: connectionId > 0,
  });
}
