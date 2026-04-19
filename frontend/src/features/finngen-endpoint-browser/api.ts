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
  /**
   * @deprecated Phase 15: use `generation_runs` on EndpointDetailWithPhase15
   * instead. This field is retained for back-compat with the catalog list
   * card (FinnGenEndpointBrowserPage row.generations badges).
   */
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

export async function fetchEndpoint(name: string): Promise<EndpointDetailWithPhase15> {
  const r = await apiClient.get<{ data: EndpointDetailWithPhase15 }>(
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

// ── Phase 15 types ──────────────────────────────────────────────────────────
// Hand-authored from 15-UI-SPEC.md §TypeScript interfaces (lines 293-396).
// Plan 15-04 did NOT run `./deploy.sh --openapi`, so these live here for now.
// If/when OpenAPI regen produces matching entries in `api.generated.ts`, swap
// these for re-exports. See 15-04-SUMMARY.md §"OpenAPI Regen (Deferred)".

export type EndpointRunStatus =
  | "queued"
  | "running"
  | "canceling"
  | "succeeded"
  | "failed"
  | "canceled"
  | "superseded";

export type EndpointGenerationRun = {
  run_id: string;
  source_key: string;
  status: EndpointRunStatus;
  subject_count: number | null;
  created_at: string;
  finished_at: string | null;
};

export type EndpointGwasRun = {
  tracking_id: number;
  run_id: string;
  step1_run_id: string | null;
  source_key: string;
  control_cohort_id: number;
  control_cohort_name: string | null;
  covariate_set_id: number;
  covariate_set_label: string | null;
  case_n: number | null;
  control_n: number | null;
  top_hit_p_value: number | null;
  status: EndpointRunStatus;
  created_at: string;
  finished_at: string | null;
  superseded_by_tracking_id: number | null;
};

export type EligibleControlCohort = {
  cohort_definition_id: number;
  name: string;
  subject_count: number;
  last_generated_at: string;
};

export type CovariateSetSummary = {
  id: number;
  name: string;
  is_default: boolean;
  description: string | null;
};

export type DispatchGwasPayload = {
  source_key: string;
  control_cohort_id: number;
  covariate_set_id?: number | null;
  overwrite?: boolean;
};

export type DispatchGwasResponse = {
  data: {
    gwas_run: EndpointGwasRun;
    cached_step1: boolean;
  };
};

export type GwasDispatchRefusalErrorCode =
  | "unresolvable_concepts"
  | "source_not_found"
  | "source_not_prepared"
  | "endpoint_not_materialized"
  | "control_cohort_not_prepared"
  | "covariate_set_not_found"
  | "duplicate_run"
  | "run_in_flight"
  | "not_owned_run"
  | "endpoint_not_found";

export type GwasDispatchRefusal = {
  message: string;
  error_code: GwasDispatchRefusalErrorCode;
  coverage_bucket?: string;
  source_key?: string;
  endpoint?: string;
  hint?: string;
  existing_run_id?: string;
  gwas_run_tracking_id?: number;
  control_cohort_id?: number;
  covariate_set_id?: number;
};

// EndpointDetail extension — Plan 15-04's show() now appends three Phase 15
// arrays. They're optional so cached/pre-Phase-15 responses still typecheck.
export type EndpointDetailWithPhase15 = EndpointDetail & {
  generation_runs?: EndpointGenerationRun[];
  gwas_runs?: EndpointGwasRun[];
  gwas_ready_sources?: string[];
};

// ── Phase 15 functions ──────────────────────────────────────────────────────

export async function dispatchGwas(
  name: string,
  payload: DispatchGwasPayload,
): Promise<DispatchGwasResponse> {
  try {
    const r = await apiClient.post<DispatchGwasResponse>(
      `/finngen/endpoints/${encodeURIComponent(name)}/gwas`,
      payload,
    );
    return r.data;
  } catch (err: unknown) {
    // 422/409/403/404 carry a typed GwasDispatchRefusal body — unwrap it so
    // callers can `catch (r: GwasDispatchRefusal) { switch (r.error_code) ... }`
    // without reaching into axios internals. See 15-04-SUMMARY.md exception map.
    if (typeof err === "object" && err !== null && "response" in err) {
      const r = (err as { response?: { status?: number; data?: unknown } })
        .response;
      if (
        (r?.status === 422 ||
          r?.status === 409 ||
          r?.status === 403 ||
          r?.status === 404) &&
        r?.data
      ) {
        throw r.data as GwasDispatchRefusal;
      }
    }
    throw err;
  }
}

export async function fetchEligibleControls(
  name: string,
  sourceKey: string,
): Promise<EligibleControlCohort[]> {
  const r = await apiClient.get<{ data: EligibleControlCohort[] }>(
    `/finngen/endpoints/${encodeURIComponent(name)}/eligible-controls`,
    { params: { source_key: sourceKey } },
  );
  return r.data.data;
}

export async function fetchCovariateSets(): Promise<CovariateSetSummary[]> {
  try {
    const r = await apiClient.get<{ data: CovariateSetSummary[] }>(
      `/finngen/gwas-covariate-sets`,
    );
    return r.data.data;
  } catch (err: unknown) {
    // UI-SPEC Assumption 10: if the list endpoint doesn't exist yet, return a
    // single hard-coded default so RunGwasPanel still renders a sensible picker.
    if (typeof err === "object" && err !== null && "response" in err) {
      const r = (err as { response?: { status?: number } }).response;
      if (r?.status === 404) {
        return [
          {
            id: 0,
            name: "Default: age + sex + 10 PCs",
            is_default: true,
            description: null,
          },
        ];
      }
    }
    throw err;
  }
}
