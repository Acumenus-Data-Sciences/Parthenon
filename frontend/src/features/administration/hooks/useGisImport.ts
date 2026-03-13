import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  uploadGisFile,
  analyzeImport,
  askAbbyColumn,
  saveMapping,
  saveConfig,
  validateImport,
  executeImport,
  fetchImportStatus,
  rollbackImport,
  fetchImportHistory,
} from "../api/gisImportApi";
import type { ColumnMapping, ImportConfig } from "../types/gisImport";

const IMPORT_KEY = "gis-import";

export function useUploadGisFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadGisFile(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: [IMPORT_KEY] }),
  });
}

export function useAnalyzeImport() {
  return useMutation({
    mutationFn: (importId: number) => analyzeImport(importId),
  });
}

export function useAskAbbyColumn() {
  return useMutation({
    mutationFn: ({
      importId,
      column,
      question,
    }: {
      importId: number;
      column: string;
      question: string;
    }) => askAbbyColumn(importId, column, question),
  });
}

export function useSaveMapping() {
  return useMutation({
    mutationFn: ({
      importId,
      mapping,
    }: {
      importId: number;
      mapping: ColumnMapping;
    }) => saveMapping(importId, mapping),
  });
}

export function useSaveConfig() {
  return useMutation({
    mutationFn: ({
      importId,
      config,
    }: {
      importId: number;
      config: ImportConfig;
    }) => saveConfig(importId, config),
  });
}

export function useValidateImport() {
  return useMutation({
    mutationFn: (importId: number) => validateImport(importId),
  });
}

export function useExecuteImport() {
  return useMutation({
    mutationFn: (importId: number) => executeImport(importId),
  });
}

export function useImportStatus(importId: number | null) {
  return useQuery({
    queryKey: [IMPORT_KEY, "status", importId],
    queryFn: () => fetchImportStatus(importId!),
    enabled: importId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "importing" || status === "queued" ? 2000 : false;
    },
  });
}

export function useRollbackImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (importId: number) => rollbackImport(importId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [IMPORT_KEY] }),
  });
}

export function useImportHistory() {
  return useQuery({
    queryKey: [IMPORT_KEY, "history"],
    queryFn: fetchImportHistory,
    staleTime: 30_000,
  });
}
