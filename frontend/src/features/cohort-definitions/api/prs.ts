// Phase 17 GENOMICS-08 — frontend API shims for the cohort PRS endpoints.
// Contract frozen in .planning/phases/17-pgs-prs/17-CONTEXT.md D-13..D-16.
import apiClient from "@/lib/api-client";

export interface PrsHistogramBin {
  bin: number;
  bin_lo: number;
  bin_hi: number;
  n: number;
}

export interface PrsSummary {
  mean: number | null;
  stddev: number | null;
  min: number | null;
  max: number | null;
  median: number | null;
  iqr_q1: number | null;
  iqr_q3: number | null;
}

export interface PrsQuintiles {
  q20: number | null;
  q40: number | null;
  q60: number | null;
  q80: number | null;
}

export interface PrsScoreResult {
  score_id: string;
  pgs_name: string | null;
  trait_reported: string | null;
  scored_at: string;
  subject_count: number;
  summary: PrsSummary;
  quintiles: PrsQuintiles;
  histogram: PrsHistogramBin[];
}

export interface CohortPrsResponse {
  scores: PrsScoreResult[];
}

export interface PgsCatalogScore {
  score_id: string;
  pgs_name: string | null;
  trait_reported: string | null;
  variants_number: number | null;
}

export interface PgsCatalogScoresResponse {
  scores: PgsCatalogScore[];
}

export interface ComputePrsRequest {
  source_key: string;
  score_id: string;
  cohort_definition_id?: number;
  overwrite_existing?: boolean;
}

export interface ComputePrsRunEnvelope {
  run: { id: string; status: string };
  analysis_type: "finngen.prs.compute";
  cohort_definition_id: number;
  score_id: string;
  source_key: string;
  finngen_endpoint_generation_id: number | null;
}

export interface ComputePrsResponse {
  data: ComputePrsRunEnvelope;
}

export async function fetchCohortPrsScores(
  cohortId: number,
  bins = 50,
): Promise<CohortPrsResponse> {
  const { data } = await apiClient.get<CohortPrsResponse>(
    `/cohort-definitions/${cohortId}/prs`,
    { params: { bins } },
  );
  return data;
}

export async function fetchPgsCatalogScores(): Promise<PgsCatalogScoresResponse> {
  const { data } = await apiClient.get<PgsCatalogScoresResponse>(
    "/pgs-catalog/scores",
  );
  return data;
}

export async function dispatchComputePrs(
  endpointName: string,
  req: ComputePrsRequest,
): Promise<ComputePrsResponse> {
  const { data } = await apiClient.post<ComputePrsResponse>(
    `/finngen/endpoints/${endpointName}/prs`,
    req,
  );
  return data;
}

// Plain URL builder — caller uses in a regular <a href> so the browser
// streams the CSV download and honors Content-Disposition: attachment.
export function buildPrsDownloadUrl(cohortId: number, scoreId: string): string {
  const base = apiClient.defaults.baseURL ?? "";
  return `${base}/cohort-definitions/${cohortId}/prs/${encodeURIComponent(scoreId)}/download`;
}
