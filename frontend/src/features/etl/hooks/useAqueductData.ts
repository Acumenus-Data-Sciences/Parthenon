import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchEtlProjects,
  fetchEtlProject,
  createEtlProject,
  updateEtlProject,
  deleteEtlProject,
  fetchTableMappings,
  createTableMapping,
  updateTableMapping,
  deleteTableMapping,
  fetchFieldMappings,
  bulkUpsertFieldMappings,
  type EtlFieldMapping,
} from "../api";

export function useEtlProjects() {
  return useQuery({
    queryKey: ["aqueduct", "projects"],
    queryFn: fetchEtlProjects,
    staleTime: 60_000,
  });
}

export function useEtlProject(projectId: number) {
  return useQuery({
    queryKey: ["aqueduct", "project", projectId],
    queryFn: () => fetchEtlProject(projectId),
    enabled: projectId > 0,
  });
}

export function useCreateEtlProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createEtlProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aqueduct", "projects"] }),
  });
}

export function useUpdateEtlProject(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: { name?: string; status?: string; notes?: string }) =>
      updateEtlProject(projectId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aqueduct", "project", projectId] });
      qc.invalidateQueries({ queryKey: ["aqueduct", "projects"] });
    },
  });
}

export function useDeleteEtlProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteEtlProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aqueduct", "projects"] }),
  });
}

export function useTableMappings(projectId: number) {
  return useQuery({
    queryKey: ["aqueduct", "table-mappings", projectId],
    queryFn: () => fetchTableMappings(projectId),
    enabled: projectId > 0,
  });
}

export function useCreateTableMapping(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { source_table: string; target_table: string; logic?: string; is_stem?: boolean }) =>
      createTableMapping(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aqueduct", "table-mappings", projectId] });
      qc.invalidateQueries({ queryKey: ["aqueduct", "project", projectId] });
    },
  });
}

export function useUpdateTableMapping(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mappingId, ...updates }: { mappingId: number; logic?: string; is_completed?: boolean }) =>
      updateTableMapping(projectId, mappingId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aqueduct", "table-mappings", projectId] });
    },
  });
}

export function useDeleteTableMapping(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mappingId: number) => deleteTableMapping(projectId, mappingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aqueduct", "table-mappings", projectId] });
      qc.invalidateQueries({ queryKey: ["aqueduct", "project", projectId] });
    },
  });
}

export function useFieldMappings(projectId: number, mappingId: number) {
  return useQuery({
    queryKey: ["aqueduct", "field-mappings", projectId, mappingId],
    queryFn: () => fetchFieldMappings(projectId, mappingId),
    enabled: projectId > 0 && mappingId > 0,
  });
}

export function useBulkUpsertFields(projectId: number, mappingId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fields, updatedAt }: {
      fields: Array<Partial<EtlFieldMapping> & { target_column: string }>;
      updatedAt: string;
    }) => bulkUpsertFieldMappings(projectId, mappingId, fields, updatedAt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aqueduct", "field-mappings", projectId, mappingId] });
      qc.invalidateQueries({ queryKey: ["aqueduct", "table-mappings", projectId] });
    },
  });
}
