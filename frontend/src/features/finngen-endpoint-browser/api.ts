// FinnGen Endpoint Browser — API types + queries.
// Consumes /api/v1/finngen/endpoints from EndpointBrowserController.
import apiClient from "@/lib/api-client";

export type CoverageBucket =
  | "FULLY_MAPPED"
  | "PARTIAL"
  | "SPARSE"
  | "UNMAPPED"
  | "CONTROL_ONLY"
  | "UNKNOWN";

// Phase 13 — endpoint portability classification. Distinguishes how
// a FinnGen endpoint resolves on non-Finnish OMOP CDMs:
//   - universal    — every qualifying-event vocab group resolves to a standard concept
//   - partial      — some groups resolve, some are Finnish-only
//   - finland_only — no groups resolve outside Finnish source vocabs
// Mirrors backend App\Enums\CoverageProfile. Keep in sync.
export type CoverageProfile = "universal" | "partial" | "finland_only";

export type EndpointGeneration = {
  source_key: string;
  status: string;
  subject_count: number | null;
  run_id?: string;
  finished_at?: string | null;
  updated_at?: string | null;
};

export type EndpointSummary = {
  id: number;
  name: string;
  description: string | null;
  tags: string[];
  coverage_bucket: CoverageBucket | null;
  coverage_pct: number | null;
  n_tokens_total: number | null;
  n_tokens_resolved: number | null;
  release: string | null;
  level: string | number | null;
  sex_restriction: string | null;
  generations: EndpointGeneration[];
  // Phase 13 — portability classification (null until Plan 06 --overwrite runs).
  coverage_profile: CoverageProfile | null;
};

export type EndpointDetail = {
  id: number;
  name: string;
  longname: string | null;
  description: string | null;
  tags: string[];
  release: string | null;
  coverage_bucket: CoverageBucket | null;
  // Phase 13 — portability classification (null until Plan 06 --overwrite runs).
  coverage_profile: CoverageProfile | null;
  coverage: {
    bucket?: CoverageBucket;
    pct?: number;
    n_tokens_total?: number;
    n_tokens_resolved?: number;
  } | null;
  level: string | number | null;
  sex_restriction: string | null;
  include_endpoints: string[] | null;
  pre_conditions: string | null;
  conditions: string | null;
  source_codes: Record<
    string,
    { raw: string | null; patterns: string[] }
  > | null;
  resolved_concepts: {
    condition_count: number;
    drug_count: number;
    source_concept_count: number;
    truncated: boolean;
  };
  generations: EndpointGeneration[];
  created_at: string | null;
  updated_at: string | null;
};

export type EndpointListResponse = {
  data: EndpointSummary[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

export type EndpointStats = {
  data: {
    total: number;
    by_bucket: Partial<Record<CoverageBucket, number>>;
    top_tags: Array<{ tag: string; n: number }>;
    unmapped: {
      total: number;
      by_vocab: Record<string, number>;
    };
  };
};

export type ListEndpointsParams = {
  q?: string;
  tag?: string;
  bucket?: CoverageBucket | "";
  release?: string;
  per_page?: number;
  page?: number;
};

export async function fetchEndpointStats(): Promise<EndpointStats> {
  const r = await apiClient.get<EndpointStats>("/finngen/endpoints/stats");
  return r.data;
}

export async function fetchEndpoints(
  params: ListEndpointsParams,
): Promise<EndpointListResponse> {
  const r = await apiClient.get<EndpointListResponse>("/finngen/endpoints", {
    params,
  });
  return r.data;
}

export async function fetchEndpoint(name: string): Promise<EndpointDetail> {
  const r = await apiClient.get<{ data: EndpointDetail }>(
    `/finngen/endpoints/${encodeURIComponent(name)}`,
  );
  return r.data.data;
}

// Genomics #2 — materialize an endpoint against a source CDM.
export type GenerateEndpointPayload = {
  source_key: string;
  overwrite_existing?: boolean;
};

export type GenerateEndpointResponse = {
  data: {
    run: {
      id: string;
      status: string;
      analysis_type: string;
      source_key: string;
    };
    cohort_definition_id: number;
    endpoint_name: string;
    source_key: string;
    expected_concept_counts: {
      conditions: number;
      drugs: number;
      source: number;
    };
  };
};

// Phase 13 — 422 response shape when the server refuses a finland_only
// endpoint against a non-Finnish source (T-13-04 guard in
// EndpointBrowserController::generate).
export type GenerateEndpointRefusal = {
  message: string;
  coverage_profile?: CoverageProfile;
  source_key?: string;
  finnish_sources_available?: string[];
};

export async function generateEndpoint(
  name: string,
  payload: GenerateEndpointPayload,
): Promise<GenerateEndpointResponse> {
  try {
    const r = await apiClient.post<GenerateEndpointResponse>(
      `/finngen/endpoints/${encodeURIComponent(name)}/generate`,
      payload,
    );
    return r.data;
  } catch (err: unknown) {
    // Re-throw preserving the 422 body so the UI can surface the server's
    // message verbatim (T-13-04 refusal carries the exact copy the user
    // should see).
    if (typeof err === "object" && err !== null && "response" in err) {
      const r = (err as { response?: { status?: number; data?: unknown } })
        .response;
      if (r?.status === 422 && r?.data) {
        throw r.data;
      }
    }
    throw err;
  }
}
