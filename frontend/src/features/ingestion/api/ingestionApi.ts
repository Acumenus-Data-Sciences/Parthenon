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

export async function uploadFile(
  file: File,
  sourceId: number,
): Promise<IngestionJob> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("source_id", String(sourceId));

  const { data } = await apiClient.post<IngestionJob>(
    "/ingestion/upload",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return data;
}

export async function fetchJobs(params?: {
  source_id?: number;
  status?: string;
}): Promise<IngestionJob[]> {
  const { data } = await apiClient.get<IngestionJob[]>("/ingestion/jobs", {
    params,
  });
  return data;
}

export async function fetchJob(id: number): Promise<IngestionJob> {
  const { data } = await apiClient.get<IngestionJob>(`/ingestion/jobs/${id}`);
  return data;
}

export async function fetchProfile(jobId: number): Promise<SourceProfile> {
  const { data } = await apiClient.get<SourceProfile>(
    `/ingestion/jobs/${jobId}/profile`,
  );
  return data;
}

export async function deleteJob(id: number): Promise<void> {
  await apiClient.delete(`/ingestion/jobs/${id}`);
}

export async function retryJob(id: number): Promise<IngestionJob> {
  const { data } = await apiClient.post<IngestionJob>(
    `/ingestion/jobs/${id}/retry`,
  );
  return data;
}

export async function fetchMappings(
  jobId: number,
  params?: Record<string, string>,
): Promise<ConceptMapping[]> {
  const { data } = await apiClient.get<ConceptMapping[]>(
    `/ingestion/jobs/${jobId}/mappings`,
    { params },
  );
  return data;
}

export async function fetchMappingStats(jobId: number): Promise<MappingStats> {
  const { data } = await apiClient.get<MappingStats>(
    `/ingestion/jobs/${jobId}/mappings/stats`,
  );
  return data;
}

export async function submitReview(
  jobId: number,
  mappingId: number,
  review: ReviewRequest,
): Promise<ConceptMapping> {
  const { data } = await apiClient.post<ConceptMapping>(
    `/ingestion/jobs/${jobId}/mappings/${mappingId}/review`,
    review,
  );
  return data;
}

export async function submitBatchReview(
  jobId: number,
  reviews: BatchReviewRequest,
): Promise<{ reviewed: number }> {
  const { data } = await apiClient.post<{ reviewed: number }>(
    `/ingestion/jobs/${jobId}/mappings/batch-review`,
    reviews,
  );
  return data;
}

export async function fetchCandidates(
  jobId: number,
  mappingId: number,
): Promise<ConceptMapping["candidates"]> {
  const { data } = await apiClient.get<ConceptMapping["candidates"]>(
    `/ingestion/jobs/${jobId}/mappings/${mappingId}/candidates`,
  );
  return data;
}

// Schema Mapping API
export async function suggestSchemaMapping(
  jobId: number,
): Promise<SchemaMapping[]> {
  const { data } = await apiClient.post<SchemaMapping[]>(
    `/ingestion/jobs/${jobId}/schema-mapping/suggest`,
  );
  return data;
}

export async function fetchSchemaMapping(
  jobId: number,
): Promise<SchemaMapping[]> {
  const { data } = await apiClient.get<SchemaMapping[]>(
    `/ingestion/jobs/${jobId}/schema-mapping`,
  );
  return data;
}

export async function updateSchemaMapping(
  jobId: number,
  mappings: Partial<SchemaMapping>[],
): Promise<SchemaMapping[]> {
  const { data } = await apiClient.put<SchemaMapping[]>(
    `/ingestion/jobs/${jobId}/schema-mapping`,
    { mappings },
  );
  return data;
}

export async function confirmSchemaMapping(
  jobId: number,
): Promise<{ confirmed: number }> {
  const { data } = await apiClient.post<{ confirmed: number }>(
    `/ingestion/jobs/${jobId}/schema-mapping/confirm`,
  );
  return data;
}

// Validation API
export async function fetchValidation(
  jobId: number,
): Promise<ValidationResult[]> {
  const { data } = await apiClient.get<ValidationResult[]>(
    `/ingestion/jobs/${jobId}/validation`,
  );
  return data;
}

export async function fetchValidationSummary(
  jobId: number,
): Promise<ValidationSummary> {
  const { data } = await apiClient.get<ValidationSummary>(
    `/ingestion/jobs/${jobId}/validation/summary`,
  );
  return data;
}
