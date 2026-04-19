// Phase 16 (Plan 16-04) — API client + TypeScript types for the 4 GWAS-results
// endpoints delivered by Plans 16-02 + 16-03:
//   GET /api/v1/finngen/runs/{id}/manhattan?bin_count=N
//   GET /api/v1/finngen/runs/{id}/manhattan/region?chrom=X&start=Y&end=Z
//   GET /api/v1/finngen/runs/{id}/top-variants?sort=p_value&dir=asc&limit=50
//   GET /api/v1/gencode/genes?chrom=X&start=Y&end=Z[&include_pseudogenes=0|1]
//
// The manhattan endpoint returns 202 Accepted with a `{status, run_id, message}`
// envelope while the GWAS run is queued/running (RESEARCH Pitfall 3 + Q7
// RESOLVED). `fetchManhattan` opts into `validateStatus` accepting both 200
// and 202 so TanStack Query can surface the in-flight state to the UI.
import apiClient from "@/lib/api-client";

// ── Manhattan (full-chromosome, thinned) ────────────────────────────────────

export interface ManhattanVariant {
  chrom: string;
  pos: number;
  neg_log_p: number;
  snp_id?: string | null;
}

export interface ManhattanThinningSummary {
  bins: number;
  threshold: number;
  variant_count_before: number;
  variant_count_after: number;
}

export interface ManhattanPayload {
  variants: ManhattanVariant[];
  genome: { chrom_offsets: Record<string, number> };
  thinning: ManhattanThinningSummary;
}

/**
 * 202 Accepted envelope returned while the GWAS run is not yet terminal.
 * RESEARCH Q7 RESOLVED: status is one of the in-flight Run statuses.
 */
export interface ManhattanInFlightResponse {
  status: "queued" | "running";
  run_id: string;
  message: string;
}

export type ManhattanResponse = ManhattanPayload | ManhattanInFlightResponse;

// ── Manhattan regional (full-resolution window) ─────────────────────────────

export interface RegionVariant {
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  af: number | null;
  beta: number | null;
  se: number | null;
  p_value: number;
  snp_id: string | null;
}

export interface ManhattanRegionPayload {
  variants: RegionVariant[];
  chrom: string;
  start: number;
  end: number;
}

// ── Top-variants table ──────────────────────────────────────────────────────

export type TopVariantsSortColumn =
  | "p_value"
  | "beta"
  | "se"
  | "af"
  | "chrom"
  | "pos"
  | "snp_id";

export type SortDirection = "asc" | "desc";

export interface TopVariantRow {
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  af: number | null;
  beta: number | null;
  se: number | null;
  p_value: number;
  snp_id: string | null;
  gwas_run_id: string;
}

export interface TopVariantsPayload {
  rows: TopVariantRow[];
  total: number;
}

// ── GENCODE gene track ──────────────────────────────────────────────────────

export interface Gene {
  gene_name: string;
  chrom: string;
  start: number;
  end: number;
  strand: string;
  gene_type: string;
}

export interface GencodePayload {
  genes: Gene[];
  chrom: string;
  start: number;
  end: number;
}

// ── Fetch functions ─────────────────────────────────────────────────────────

/**
 * Fetch the thinned Manhattan payload for a completed GWAS run. Returns 200
 * OK with `ManhattanPayload` when the run has succeeded, or 202 Accepted with
 * `ManhattanInFlightResponse` when it is still queued/running. Callers use
 * `isManhattanInFlight()` to discriminate the union.
 *
 * Non-in-flight error statuses (404 missing run, 410 failed, 409 other
 * non-terminal) propagate as axios errors and are handled by TanStack
 * Query's `retry` guard.
 */
export async function fetchManhattan(
  runId: string,
  binCount: number,
): Promise<ManhattanResponse> {
  const r = await apiClient.get<ManhattanResponse>(
    `/finngen/runs/${encodeURIComponent(runId)}/manhattan`,
    {
      params: { bin_count: binCount },
      validateStatus: (status) => status === 200 || status === 202,
    },
  );
  return r.data;
}

export async function fetchManhattanRegion(
  runId: string,
  chrom: string,
  start: number,
  end: number,
): Promise<ManhattanRegionPayload> {
  const r = await apiClient.get<ManhattanRegionPayload>(
    `/finngen/runs/${encodeURIComponent(runId)}/manhattan/region`,
    { params: { chrom, start, end } },
  );
  return r.data;
}

export async function fetchTopVariants(
  runId: string,
  sort: TopVariantsSortColumn,
  dir: SortDirection,
  limit: number,
): Promise<TopVariantsPayload> {
  const r = await apiClient.get<TopVariantsPayload>(
    `/finngen/runs/${encodeURIComponent(runId)}/top-variants`,
    { params: { sort, dir, limit } },
  );
  return r.data;
}

export async function fetchGencodeGenes(
  chrom: string,
  start: number,
  end: number,
  includePseudogenes = false,
): Promise<GencodePayload> {
  const r = await apiClient.get<GencodePayload>(`/gencode/genes`, {
    params: {
      chrom,
      start,
      end,
      include_pseudogenes: includePseudogenes ? 1 : 0,
    },
  });
  return r.data;
}
