import apiClient from "@/lib/api-client";

// Mirrors backend FhirR4Controller::RESOURCE_TYPES.
export const FHIR_RESOURCE_TYPES = [
  "Patient",
  "Condition",
  "Encounter",
  "Observation",
  "MedicationStatement",
  "Procedure",
  "Immunization",
  "AllergyIntolerance",
] as const;

export type FhirResourceType = (typeof FHIR_RESOURCE_TYPES)[number];

export type FhirExportStatus = "pending" | "processing" | "completed" | "failed";

export interface FhirExportFile {
  resource_type: string;
  url: string;
  count: number;
}

export interface FhirExportJob {
  id: string;
  status: FhirExportStatus;
  resource_types: string[] | null;
  files: FhirExportFile[] | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
}

export interface StartFhirExportResponse {
  id: string;
  status: FhirExportStatus;
  message?: string;
}

export interface StartFhirExportPayload {
  source_id: number;
  resource_types?: string[];
  patient_ids?: number[];
}

export async function startFhirExport(
  payload: StartFhirExportPayload,
): Promise<StartFhirExportResponse> {
  // The literal `$export` path matches the backend route (FHIR Bulk Data spec).
  const { data } = await apiClient.post<StartFhirExportResponse>("/fhir/$export", payload);
  return data;
}

export async function fetchFhirExportStatus(id: string): Promise<FhirExportJob> {
  const { data } = await apiClient.get<FhirExportJob>(`/fhir/$export/${id}`);
  return data;
}

export async function downloadFhirExportFile(id: string, file: string): Promise<void> {
  const { data } = await apiClient.get(`/fhir/$export/${id}/download/${file}`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data as Blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${file}.ndjson`;
  anchor.click();
  URL.revokeObjectURL(url);
}
