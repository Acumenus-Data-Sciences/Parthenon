import apiClient from "@/lib/api-client";
import type { ProInstrument } from "../types/proInstrument";

/* ── API response types ───────────────────────────────────────────── */

export interface SurveyInstrumentApi {
  id: number;
  name: string;
  abbreviation: string;
  version: string;
  description: string | null;
  domain: string;
  item_count: number;
  scoring_method: Record<string, unknown> | null;
  loinc_panel_code: string | null;
  omop_concept_id: number | null;
  license_type: "public" | "proprietary";
  license_detail: string | null;
  is_public_domain: boolean;
  is_active: boolean;
  omop_coverage: "yes" | "partial" | "no";
  items_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SurveyItemApi {
  id: number;
  survey_instrument_id: number;
  item_number: number;
  item_text: string;
  response_type: string;
  omop_concept_id: number | null;
  loinc_code: string | null;
  subscale_name: string | null;
  is_reverse_coded: boolean;
  min_value: string | null;
  max_value: string | null;
  display_order: number;
  answer_options: SurveyAnswerOptionApi[];
}

export interface SurveyAnswerOptionApi {
  id: number;
  survey_item_id: number;
  option_text: string;
  option_value: string | null;
  omop_concept_id: number | null;
  loinc_la_code: string | null;
  display_order: number;
}

export interface SurveyInstrumentDetailApi extends SurveyInstrumentApi {
  items: SurveyItemApi[];
  creator: { id: number; name: string } | null;
  conduct_records_count: number;
}

export interface SurveyStatsApi {
  total_instruments: number;
  domains: number;
  with_loinc: number;
  full_omop: number;
  partial_omop: number;
  no_omop: number;
  public_domain: number;
  instruments_with_items: number;
  total_items: number;
  total_answer_options: number;
}

export interface DomainCountApi {
  domain: string;
  instrument_count: number;
}

/* ── Pagination wrapper ───────────────────────────────────────────── */

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/* ── API functions ────────────────────────────────────────────────── */

export async function fetchSurveyInstruments(params?: {
  domain?: string;
  omop_coverage?: string;
  license_type?: string;
  has_loinc?: boolean;
  search?: string;
  sort?: string;
  dir?: string;
  per_page?: number;
  page?: number;
}): Promise<PaginatedResponse<SurveyInstrumentApi>> {
  const { data } = await apiClient.get<PaginatedResponse<SurveyInstrumentApi>>(
    "/survey-instruments",
    { params },
  );
  return data;
}

export async function fetchSurveyStats(): Promise<SurveyStatsApi> {
  const { data } = await apiClient.get<SurveyStatsApi>(
    "/survey-instruments/stats",
  );
  return data;
}

export async function fetchSurveyDomains(): Promise<DomainCountApi[]> {
  const { data } = await apiClient.get<{ domains: DomainCountApi[] }>(
    "/survey-instruments/domains",
  );
  return data.domains;
}

export async function fetchSurveyInstrument(
  id: number,
): Promise<SurveyInstrumentDetailApi> {
  const { data } = await apiClient.get<SurveyInstrumentDetailApi>(
    `/survey-instruments/${id}`,
  );
  return data;
}

/* ── Adapter: API → frontend ProInstrument type ───────────────────── */

export function toProInstrument(api: SurveyInstrumentApi): ProInstrument {
  return {
    abbreviation: api.abbreviation,
    name: api.name,
    domain: api.domain,
    items: String(api.item_count),
    hasLoinc: api.loinc_panel_code !== null,
    loincCode: api.loinc_panel_code,
    omopCoverage: api.omop_coverage,
    license: api.license_type,
    licenseDetail: api.license_detail ?? (api.license_type === "public" ? "Public Domain" : "Proprietary"),
  };
}
