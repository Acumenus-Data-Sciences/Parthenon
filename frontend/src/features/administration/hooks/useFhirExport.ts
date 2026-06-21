import { useMutation, useQuery } from "@tanstack/react-query";
import {
  downloadFhirExportFile,
  fetchFhirExportStatus,
  startFhirExport,
  type FhirExportJob,
  type StartFhirExportPayload,
} from "../api/fhirExportApi";

export function useStartFhirExport() {
  return useMutation({
    mutationFn: (payload: StartFhirExportPayload) => startFhirExport(payload),
  });
}

export function useFhirExportStatus(jobId: string | null) {
  return useQuery({
    queryKey: ["admin", "fhir-export", jobId],
    queryFn: () => fetchFhirExportStatus(jobId as string),
    enabled: !!jobId,
    // Poll until the job reaches a terminal state.
    refetchInterval: (query) => {
      const status = (query.state.data as FhirExportJob | undefined)?.status;
      return status === "completed" || status === "failed" ? false : 3000;
    },
  });
}

export function useDownloadFhirExportFile() {
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: string }) =>
      downloadFhirExportFile(id, file),
  });
}
