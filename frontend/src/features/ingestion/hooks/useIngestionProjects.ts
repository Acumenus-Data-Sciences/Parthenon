import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchIngestionProjects,
  fetchIngestionProject,
  createIngestionProject,
  deleteIngestionProject,
  stageFiles,
  removeProjectFile,
  fetchStagingPreview,
} from "../api/ingestionApi";

export function useIngestionProjects() {
  return useQuery({
    queryKey: ["ingestion-projects"],
    queryFn: fetchIngestionProjects,
    staleTime: 30_000,
  });
}

export function useIngestionProject(id: number) {
  return useQuery({
    queryKey: ["ingestion-project", id],
    queryFn: () => fetchIngestionProject(id),
    enabled: id > 0,
  });
}

export function useCreateIngestionProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createIngestionProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingestion-projects"] }),
  });
}

export function useDeleteIngestionProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteIngestionProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingestion-projects"] }),
  });
}

export function useStageFiles(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ files, tableNames }: { files: File[]; tableNames: string[] }) =>
      stageFiles(projectId, files, tableNames),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingestion-project", projectId] });
      qc.invalidateQueries({ queryKey: ["ingestion-projects"] });
    },
  });
}

export function useRemoveProjectFile(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) => removeProjectFile(projectId, jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingestion-project", projectId] });
      qc.invalidateQueries({ queryKey: ["ingestion-projects"] });
    },
  });
}

export function useStagingPreview(projectId: number, tableName: string, enabled = true) {
  return useQuery({
    queryKey: ["staging-preview", projectId, tableName],
    queryFn: () => fetchStagingPreview(projectId, tableName),
    enabled: enabled && projectId > 0 && tableName.length > 0,
    staleTime: 60_000,
  });
}
