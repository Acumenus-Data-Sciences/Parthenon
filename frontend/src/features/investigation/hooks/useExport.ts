import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { exportJson, exportPdf, listVersions, createVersion } from "../api";

export function useExportJson() {
  return useMutation({
    mutationFn: (investigationId: number) => exportJson(investigationId),
  });
}

export function useExportPdf() {
  return useMutation({
    mutationFn: (investigationId: number) => exportPdf(investigationId),
  });
}

export function useVersions(investigationId: number) {
  return useQuery({
    queryKey: ["investigation-versions", investigationId],
    queryFn: () => listVersions(investigationId),
    enabled: !!investigationId,
  });
}

export function useCreateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (investigationId: number) => createVersion(investigationId),
    onSuccess: (_data, investigationId) => {
      void qc.invalidateQueries({ queryKey: ["investigation-versions", investigationId] });
    },
  });
}
