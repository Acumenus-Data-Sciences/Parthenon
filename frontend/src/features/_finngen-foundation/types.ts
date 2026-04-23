// Re-exports + convenience types for FinnGen SP1 foundation.
// Previously imported paths/components from api.generated.ts (auto-generated,
// gitignored). Removed because CI's frontend job does not regenerate that
// file and the only usage was a placeholder _Touch type below.

/**
 * The top-level FinnGenRun schema, if exported by the Laravel OpenAPI.
 * If not present yet in generated types (SP1), we define a stable local
 * type with the same shape the API returns; consumers that want the
 * generated version can migrate when backend adds schemas to scribe.
 */
export type FinnGenRun = {
  id: string;
  user_id: number;
  source_key: string;
  analysis_type: FinnGenAnalysisType;
  params: Record<string, unknown>;
  status: FinnGenRunStatus;
  progress: {
    step?: string;
    pct?: number;
    message?: string;
    updated_at?: string;
  } | null;
  artifacts: Record<string, string>;
  summary: Record<string, unknown> | null;
  error: {
    code?: string;
    category?: string;
    message?: string;
    [k: string]: unknown;
  } | null;
  pinned: boolean;
  artifacts_pruned: boolean;
  darkstar_job_id: string | null;
  horizon_job_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FinnGenAnalysisType =
  | "romopapi.code_counts"
  | "romopapi.report"
  | "romopapi.setup"
  | "hades.overlap"
  | "hades.demographics"
  | "hades.counts"
  | "co2.codewas"
  | "co2.time_codewas"
  | "co2.overlaps"
  | "co2.demographics"
  | "co2.gwas"
  | "co2.endpoint_profile"
  | "co2.test.extra"
  | "cohort.generate"
  | "cohort.match"
  | "cohort.materialize"
  | "endpoint.generate"
  | "gwas.regenie.step1"
  | "gwas.regenie.step2"
  | "finngen.prs.compute";

export type FinnGenRunStatus =
  | "queued"
  | "running"
  | "canceling"
  | "succeeded"
  | "failed"
  | "canceled";

export const FINNGEN_TERMINAL_STATUSES: readonly FinnGenRunStatus[] = [
  "succeeded",
  "failed",
  "canceled",
];

export const FINNGEN_ACTIVE_STATUSES: readonly FinnGenRunStatus[] = [
  "queued",
  "running",
  "canceling",
];

export type FinnGenAnalysisModule = {
  key: string;
  label: string;
  description: string;
  darkstar_endpoint: string;
  enabled: boolean;
  min_role: string;
  settings_schema: Record<string, unknown> | null;
  default_settings: Record<string, unknown> | null;
  result_schema: Record<string, unknown> | null;
  result_component: string | null;
};

export type CreateFinnGenRunBody = {
  analysis_type: FinnGenAnalysisType;
  source_key: string;
  params: Record<string, unknown>;
};

export type FinnGenRunsListResponse = {
  data: FinnGenRun[];
  meta: {
    page: number;
    per_page: number;
    total: number;
  };
};

