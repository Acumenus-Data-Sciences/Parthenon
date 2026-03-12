import apiClient from "@/lib/api-client";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface FhirIngestError {
  resource_type: string;
  message: string;
}

export interface FhirIngestResult {
  status: string;
  resources_processed: number;
  records_created: Record<string, number>; // table_name → row count
  errors: FhirIngestError[];
  elapsed_seconds: number;
}

export interface FhirHealthStatus {
  status: string;
  binary_found: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// API functions
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/etl/fhir/ingest
 * Accepts a FHIR Bundle object and returns CDM records created.
 */
export async function ingestFhirBundle(bundle: object): Promise<FhirIngestResult> {
  const res = await apiClient.post<{ data: FhirIngestResult }>("/etl/fhir/ingest", bundle);
  return res.data.data;
}

/**
 * POST /api/v1/etl/fhir/batch
 * Accepts FHIR NDJSON string (one resource per line) and returns CDM records created.
 */
export async function ingestFhirBatch(ndjson: string): Promise<FhirIngestResult> {
  const res = await apiClient.post<{ data: FhirIngestResult }>(
    "/etl/fhir/batch",
    ndjson,
    { headers: { "Content-Type": "application/x-ndjson" } },
  );
  return res.data.data;
}

/**
 * GET /api/v1/etl/fhir/health
 * Returns the FhirToCdm sidecar service health.
 */
export async function checkFhirHealth(): Promise<FhirHealthStatus> {
  const res = await apiClient.get<{ data: FhirHealthStatus }>("/etl/fhir/health");
  return res.data.data;
}
