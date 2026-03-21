import apiClient from "@/lib/api-client";
import type {
  Investigation,
  EvidencePin,
  PaginatedResponse,
  InvestigationStatus,
  EvidenceDomain,
  ConceptSearchResult,
  ConceptHierarchy,
  SetOperationType,
  CohortOperationResult,
  OpenTargetsResult,
  GwasCatalogResult,
  GwasUploadResult,
  CrossLinksMap,
  FinnGenSource,
  FinnGenCohortOperationsResult,
  FinnGenCo2AnalysisResult,
  InvestigationVersion,
  DossierExport,
} from "./types";

// ── Study-Agent API functions (migrated from deprecated finngen feature) ───────

export async function previewFinnGenCohortOperations(payload: {
  source: FinnGenSource;
  cohort_definition: Record<string, unknown>;
  execution_mode?: string;
  import_mode?: string;
  operation_type?: string;
  atlas_cohort_ids?: number[];
  atlas_import_behavior?: string;
  cohort_table_name?: string;
  file_name?: string;
  file_format?: string;
  file_row_count?: number;
  file_columns?: string[];
  file_contents?: string;
  selected_cohort_ids?: number[];
  selected_cohort_labels?: string[];
  primary_cohort_id?: number | null;
  matching_enabled?: boolean;
  matching_strategy?: string;
  matching_target?: string;
  matching_covariates?: string[];
  matching_ratio?: number;
  matching_caliper?: number;
  export_target?: string;
}): Promise<FinnGenCohortOperationsResult> {
  const { data } = await apiClient.post("/study-agent/finngen/cohort-operations", payload);
  return data.data ?? data;
}

export async function previewFinnGenCo2Analysis(payload: {
  source: FinnGenSource;
  module_key: string;
  cohort_label?: string;
  outcome_name?: string;
  cohort_context?: Record<string, unknown>;
  comparator_label?: string;
  sensitivity_label?: string;
  burden_domain?: string;
  exposure_window?: string;
  stratify_by?: string;
  time_window_unit?: string;
  time_window_count?: number;
  gwas_trait?: string;
  gwas_method?: string;
}): Promise<FinnGenCo2AnalysisResult> {
  const { data } = await apiClient.post("/study-agent/finngen/co2-analysis", payload);
  return data.data ?? data;
}

// ── Investigations ────────────────────────────────────────────────────

export async function fetchInvestigations(
  status?: InvestigationStatus,
): Promise<PaginatedResponse<Investigation>> {
  const params = status ? { status } : {};
  const { data } = await apiClient.get("/investigations", { params });
  return data;
}

export async function fetchInvestigation(
  id: number,
): Promise<Investigation> {
  const { data } = await apiClient.get(`/investigations/${id}`);
  return data.data;
}

export async function createInvestigation(payload: {
  title: string;
  research_question?: string;
}): Promise<Investigation> {
  const { data } = await apiClient.post("/investigations", payload);
  return data;
}

export async function updateInvestigation(
  id: number,
  payload: Partial<Pick<Investigation, "title" | "research_question" | "status">>,
): Promise<Investigation> {
  const { data } = await apiClient.patch(`/investigations/${id}`, payload);
  return data.data;
}

export async function deleteInvestigation(id: number): Promise<void> {
  await apiClient.delete(`/investigations/${id}`);
}

export async function saveDomainState(
  id: number,
  domain: EvidenceDomain,
  state: Record<string, unknown>,
): Promise<{ saved_at: string; domain: string }> {
  const { data } = await apiClient.patch(
    `/investigations/${id}/state/${domain}`,
    { state },
  );
  return data.data;
}

// ── Evidence Pins ─────────────────────────────────────────────────────

export async function fetchPins(
  investigationId: number,
): Promise<EvidencePin[]> {
  const { data } = await apiClient.get(
    `/investigations/${investigationId}/pins`,
  );
  return data.data;
}

export async function createPin(
  investigationId: number,
  payload: {
    domain: string;
    section: string;
    finding_type: string;
    finding_payload: Record<string, unknown>;
    is_key_finding?: boolean;
  },
): Promise<EvidencePin> {
  const { data } = await apiClient.post(
    `/investigations/${investigationId}/pins`,
    payload,
  );
  return data;
}

export async function updatePin(
  investigationId: number,
  pinId: number,
  payload: Partial<
    Pick<
      EvidencePin,
      "sort_order" | "is_key_finding" | "narrative_before" | "narrative_after" | "section"
    >
  >,
): Promise<EvidencePin> {
  const { data } = await apiClient.patch(
    `/investigations/${investigationId}/pins/${pinId}`,
    payload,
  );
  return data.data;
}

export async function deletePin(
  investigationId: number,
  pinId: number,
): Promise<void> {
  await apiClient.delete(
    `/investigations/${investigationId}/pins/${pinId}`,
  );
}

// ── Concept Explorer ──────────────────────────────────────────────────

export async function searchConcepts(
  query: string,
  domain?: string,
  limit = 25,
): Promise<ConceptSearchResult[]> {
  const params: Record<string, string | number> = { q: query, limit };
  if (domain) params.domain = domain;
  const { data } = await apiClient.get("/concept-explorer/search", { params });
  return data.data ?? data;
}

export async function fetchConceptHierarchy(
  conceptId: number,
): Promise<ConceptHierarchy> {
  const { data } = await apiClient.get(
    `/concept-explorer/${conceptId}/hierarchy`,
  );
  return data.data ?? data;
}

export async function fetchConceptCount(
  conceptId: number,
): Promise<{ concept_id: number; patient_count: number }> {
  const { data } = await apiClient.get(
    `/concept-explorer/${conceptId}/count`,
  );
  return data.data ?? data;
}

// ── Clinical Analysis ─────────────────────────────────────────────────

export async function createAnalysis(
  apiPrefix: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data } = await apiClient.post(`/${apiPrefix}`, payload);
  return data.data ?? data;
}

export async function executeAnalysis(
  apiPrefix: string,
  analysisId: number,
  sourceId?: number,
): Promise<unknown> {
  const payload = sourceId ? { source_id: sourceId } : {};
  const { data } = await apiClient.post(
    `/${apiPrefix}/${analysisId}/execute`,
    payload,
  );
  return data.data ?? data;
}

export async function fetchExecution(
  apiPrefix: string,
  analysisId: number,
  executionId: number,
): Promise<unknown> {
  const { data } = await apiClient.get(
    `/${apiPrefix}/${analysisId}/executions/${executionId}`,
  );
  return data.data ?? data;
}

export async function fetchExecutions(
  apiPrefix: string,
  analysisId: number,
): Promise<unknown[]> {
  const { data } = await apiClient.get(
    `/${apiPrefix}/${analysisId}/executions`,
  );
  return data.data ?? data;
}

// ── Genomic Evidence ──────────────────────────────────────────────────

export async function queryOpenTargets(
  investigationId: number,
  queryType: "gene" | "disease",
  term: string,
): Promise<OpenTargetsResult> {
  const { data } = await apiClient.post(
    `/investigations/${investigationId}/genomic/query-opentargets`,
    { query_type: queryType, term },
  );
  return data.data;
}

export async function queryGwasCatalog(
  investigationId: number,
  queryType: "trait" | "gene",
  term: string,
  size = 20,
): Promise<GwasCatalogResult> {
  const { data } = await apiClient.post(
    `/investigations/${investigationId}/genomic/query-gwas-catalog`,
    { query_type: queryType, term, size },
  );
  return data.data;
}

export async function uploadGwas(
  investigationId: number,
  file: File,
  columnMapping?: Record<string, string>,
): Promise<GwasUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  if (columnMapping) {
    Object.entries(columnMapping).forEach(([key, value]) => {
      formData.append(`column_mapping[${key}]`, value);
    });
  }
  const { data } = await apiClient.post(
    `/investigations/${investigationId}/genomic/upload-gwas`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data.data;
}

export async function fetchCrossLinks(
  investigationId: number,
): Promise<CrossLinksMap> {
  const { data } = await apiClient.get(
    `/investigations/${investigationId}/cross-links`,
  );
  return data.data;
}

// ── Export ─────────────────────────────────────────────────────────────

export async function exportJson(investigationId: number): Promise<DossierExport> {
  const { data } = await apiClient.get(`/investigations/${investigationId}/export/json`);
  return data.data;
}

export async function exportPdf(investigationId: number): Promise<Blob> {
  const response = await apiClient.get(`/investigations/${investigationId}/export/pdf`, {
    responseType: "blob",
  });
  return response.data;
}

// ── Versions ───────────────────────────────────────────────────────────

export async function listVersions(investigationId: number): Promise<InvestigationVersion[]> {
  const { data } = await apiClient.get(`/investigations/${investigationId}/versions`);
  return data.data;
}

export async function createVersion(investigationId: number): Promise<InvestigationVersion> {
  const { data } = await apiClient.post(`/investigations/${investigationId}/versions`);
  return data;
}

// ── Cohort Operations ──────────────────────────────────────────────────

export async function executeCohortOperation(
  source: FinnGenSource,
  selectedCohortIds: number[],
  selectedCohortLabels: string[],
  primaryCohortId: number | null,
  operationType: SetOperationType,
): Promise<CohortOperationResult> {
  // NOTE: previewFinnGenCohortOperations requires a full FinnGenSource object
  // and requires cohort_definition (pass empty object for parthenon import mode)
  const result = await previewFinnGenCohortOperations({
    source,
    cohort_definition: {},
    import_mode: "parthenon",
    operation_type: operationType,
    selected_cohort_ids: selectedCohortIds,
    selected_cohort_labels: selectedCohortLabels,
    primary_cohort_id: primaryCohortId,
    matching_enabled: false,
  });

  const data = result as Record<string, unknown>;
  const attritionRaw = (data.attrition ?? []) as Array<Record<string, unknown>>;
  const resultCount =
    ((data.compile_summary as Record<string, unknown>)?.result_rows as number) ?? 0;

  return {
    compile_summary: (data.compile_summary ?? {}) as Record<string, unknown>,
    attrition: attritionRaw.map((step, i) => ({
      label: String(step.label ?? step.step ?? `Step ${i + 1}`),
      count: Number(step.count ?? step.persons ?? 0),
      percent: Number(step.percent ?? step.retention ?? 100),
    })),
    result_count: resultCount,
    operation_type: operationType,
    export_summary: (data.export_summary ?? {}) as Record<string, unknown>,
    matching_summary: data.matching_summary as Record<string, unknown> | undefined,
    handoff_ready: Boolean(data.handoff_ready ?? false),
  };
}
