import apiClient, { toLaravelPaginated } from "@/lib/api-client";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PhenotypeEntry {
  cohort_id: number;
  cohort_name: string;
  description: string | null;
  logic_description: string | null;
  tags: string[] | null;
  domain: string | null;
  severity: string | null;
  is_imported: boolean;
  imported_cohort_id: number | null;
  expression_json: unknown | null;
}

export interface PhenotypeStats {
  total: number;
  with_expression: number;
  imported: number;
  domains: number;
}

export interface PhenotypeListParams {
  search?: string;
  domain?: string;
  page?: number;
  per_page?: number;
}

export interface PaginatedPhenotypes {
  items: PhenotypeEntry[];
  total: number;
  page: number;
  limit: number;
}

// ── API functions ──────────────────────────────────────────────────────────

export async function fetchPhenotypes(
  params: PhenotypeListParams = {},
): Promise<PaginatedPhenotypes> {
  const response = await apiClient.get("/phenotype-library", { params });
  return toLaravelPaginated<PhenotypeEntry>(response.data);
}

export async function fetchPhenotype(id: number): Promise<PhenotypeEntry> {
  const response = await apiClient.get(`/phenotype-library/${id}`);
  return response.data.data as PhenotypeEntry;
}

export async function importPhenotype(
  id: number,
): Promise<{ cohort_definition_id: number }> {
  const response = await apiClient.post(`/phenotype-library/${id}/import`);
  return { cohort_definition_id: response.data.data.id as number };
}

export async function fetchDomains(): Promise<string[]> {
  const response = await apiClient.get("/phenotype-library/domains");
  return response.data.data as string[];
}

export async function fetchStats(): Promise<PhenotypeStats> {
  const response = await apiClient.get("/phenotype-library/stats");
  return response.data.data as PhenotypeStats;
}
