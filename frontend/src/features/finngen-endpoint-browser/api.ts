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
};

export type EndpointDetail = {
  id: number;
  name: string;
  longname: string | null;
  description: string | null;
  tags: string[];
  release: string | null;
  coverage_bucket: CoverageBucket | null;
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
