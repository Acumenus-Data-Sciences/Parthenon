// FHIR Bulk Export API types -- endpoints not yet implemented.
// See FhirExportPage.tsx coming-soon state.

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
