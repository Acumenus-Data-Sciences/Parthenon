import apiClient from "@/lib/api-client";
import type {
  IngestionJob,
  SourceProfile,
  ConceptMapping,
  MappingStats,
  ReviewRequest,
  BatchReviewRequest,
  SchemaMapping,
  ValidationResult,
  ValidationSummary,
} from "@/types/ingestion";

/** Unwrap Laravel's { data: T } envelope — returns T whether wrapped or not */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap<T>(body: any): T {
  if (body && typeof body === "object" && "data" in body && !Array.isArray(body)) {
    return body.data as T;
  }
  return body as T;
}

export async function uploadFile(
  file: File,
  sourceId: number,
): Promise<IngestionJob> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("source_id", String(sourceId));

  const { data } = await apiClient.post(
    "/ingestion/upload",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return unwrap<IngestionJob>(data);
}

export async function fetchJobs(params?: {
  source_id?: number;
  status?: string;
}): Promise<IngestionJob[]> {
  const { data } = await apiClient.get("/ingestion/jobs", {
    params,
  });
  return unwrap<IngestionJob[]>(data);
}

export async function fetchJob(id: number): Promise<IngestionJob> {
  const { data } = await apiClient.get(`/ingestion/jobs/${id}`);
  return unwrap<IngestionJob>(data);
}

export async function fetchProfile(jobId: number): Promise<SourceProfile> {
  const { data } = await apiClient.get(
    `/ingestion/jobs/${jobId}/profile`,
  );
  return unwrap<SourceProfile>(data);
}

export async function deleteJob(id: number): Promise<void> {
  await apiClient.delete(`/ingestion/jobs/${id}`);
}

export async function retryJob(id: number): Promise<IngestionJob> {
  const { data } = await apiClient.post(
    `/ingestion/jobs/${id}/retry`,
  );
  return unwrap<IngestionJob>(data);
}

export async function fetchMappings(
  jobId: number,
  params?: Record<string, string>,
): Promise<ConceptMapping[]> {
  const { data } = await apiClient.get(
    `/ingestion/jobs/${jobId}/mappings`,
    { params },
  );
  return unwrap<ConceptMapping[]>(data);
}

export async function fetchMappingStats(jobId: number): Promise<MappingStats> {
  const { data } = await apiClient.get(
    `/ingestion/jobs/${jobId}/mappings/stats`,
  );
  return unwrap<MappingStats>(data);
}

export async function submitReview(
  jobId: number,
  mappingId: number,
  review: ReviewRequest,
): Promise<ConceptMapping> {
  const { data } = await apiClient.post(
    `/ingestion/jobs/${jobId}/mappings/${mappingId}/review`,
    review,
  );
  return unwrap<ConceptMapping>(data);
}

export async function submitBatchReview(
  jobId: number,
  reviews: BatchReviewRequest,
): Promise<{ reviewed: number }> {
  const { data } = await apiClient.post(
    `/ingestion/jobs/${jobId}/mappings/batch-review`,
    reviews,
  );
  return unwrap<{ reviewed: number }>(data);
}

export async function fetchCandidates(
  jobId: number,
  mappingId: number,
): Promise<ConceptMapping["candidates"]> {
  const { data } = await apiClient.get(
    `/ingestion/jobs/${jobId}/mappings/${mappingId}/candidates`,
  );
  return unwrap<ConceptMapping["candidates"]>(data);
}

// Solr-powered mapping search (cross-job)
export interface MappingSearchResult {
  data: ConceptMapping[];
  total: number;
  facets: Record<string, Record<string, number>>;
  engine: string;
}

export async function searchMappings(
  params: Record<string, string | number | boolean>,
): Promise<MappingSearchResult> {
  const { data } = await apiClient.get(
    "/ingestion/mappings/search",
    { params },
  );
  return unwrap<MappingSearchResult>(data);
}

// Schema Mapping API
export async function suggestSchemaMapping(
  jobId: number,
): Promise<SchemaMapping[]> {
  const { data } = await apiClient.post(
    `/ingestion/jobs/${jobId}/schema-mapping/suggest`,
  );
  return unwrap<SchemaMapping[]>(data);
}

export async function fetchSchemaMapping(
  jobId: number,
): Promise<SchemaMapping[]> {
  const { data } = await apiClient.get(
    `/ingestion/jobs/${jobId}/schema-mapping`,
  );
  return unwrap<SchemaMapping[]>(data);
}

export async function updateSchemaMapping(
  jobId: number,
  mappings: Partial<SchemaMapping>[],
): Promise<SchemaMapping[]> {
  const { data } = await apiClient.put(
    `/ingestion/jobs/${jobId}/schema-mapping`,
    { mappings },
  );
  return unwrap<SchemaMapping[]>(data);
}

export async function confirmSchemaMapping(
  jobId: number,
): Promise<{ confirmed: number }> {
  const { data } = await apiClient.post(
    `/ingestion/jobs/${jobId}/schema-mapping/confirm`,
  );
  return unwrap<{ confirmed: number }>(data);
}

// Validation API
export async function fetchValidation(
  jobId: number,
): Promise<ValidationResult[]> {
  const { data } = await apiClient.get(
    `/ingestion/jobs/${jobId}/validation`,
  );
  return unwrap<ValidationResult[]>(data);
}

export async function fetchValidationSummary(
  jobId: number,
): Promise<ValidationSummary> {
  const { data } = await apiClient.get(
    `/ingestion/jobs/${jobId}/validation/summary`,
  );
  return unwrap<ValidationSummary>(data);
}
