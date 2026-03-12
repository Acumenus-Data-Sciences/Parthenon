import apiClient from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface FhirExportFile {
  resource_type: string;
  url: string;
  count: number;
}

export interface FhirExportJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  resource_types: string[];
  files: FhirExportFile[] | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
}

export interface StartExportParams {
  source_id: number;
  resource_types?: string[];
  patient_ids?: number[];
}

export async function startFhirExport(
  params: StartExportParams,
): Promise<{ id: string }> {
  const { data } = await apiClient.post<{ id: string }>("/fhir/$export", params);
  return data;
}

export async function getFhirExportStatus(id: string): Promise<FhirExportJob> {
  const { data } = await apiClient.get<FhirExportJob>(`/fhir/$export/${id}`);
  return data;
}

export function useStartFhirExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startFhirExport,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fhir-exports"] });
    },
  });
}

export function useFhirExportStatus(id: string | null) {
  return useQuery({
    queryKey: ["fhir-export", id],
    queryFn: () => getFhirExportStatus(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 3000 : false;
    },
  });
}
