// Plan 16-04 owns this file. Plan 16-05 creates this minimal scaffold so
// components compile while Plan 04 runs in parallel; the merger should prefer
// Plan 04's richer implementation (adds fetchManhattan, fetchTopVariants,
// fetchManhattanRegion, fetchGencodeGenes + in-flight response type).
//
// The TS interfaces below MUST stay shape-compatible with Plan 04's
// gwas-results.ts (16-04-PLAN Task 2 lines 213-305) — same field names,
// optionality, and union membership.
import apiClient from "@/lib/api-client";

export interface ManhattanVariant {
  chrom: string;
  pos: number;
  neg_log_p: number;
  snp_id?: string | null;
}

export interface ManhattanPayload {
  variants: ManhattanVariant[];
  genome: { chrom_offsets: Record<string, number> };
  thinning: {
    bins: number;
    threshold: number;
    variant_count_before: number;
    variant_count_after: number;
  };
}

export interface ManhattanInFlightResponse {
  status: "queued" | "running";
  run_id: string;
  message: string;
}

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

export async function fetchManhattan(
  runId: string,
  binCount: number,
): Promise<ManhattanPayload | ManhattanInFlightResponse> {
  const r = await apiClient.get(
    `/finngen/runs/${encodeURIComponent(runId)}/manhattan`,
    {
      params: { bin_count: binCount },
      validateStatus: (s: number) => s === 200 || s === 202,
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
  const r = await apiClient.get(
    `/finngen/runs/${encodeURIComponent(runId)}/manhattan/region`,
    { params: { chrom, start, end } },
  );
  return r.data;
}

export async function fetchTopVariants(
  runId: string,
  sort: string,
  dir: "asc" | "desc",
  limit: number,
): Promise<TopVariantsPayload> {
  const r = await apiClient.get(
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
  const r = await apiClient.get(`/gencode/genes`, {
    params: {
      chrom,
      start,
      end,
      include_pseudogenes: includePseudogenes ? 1 : 0,
    },
  });
  return r.data;
}
