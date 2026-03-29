import { useQuery } from "@tanstack/react-query";
import {
  fetchSurveyInstruments,
  fetchSurveyStats,
  fetchSurveyDomains,
  fetchSurveyInstrument,
  toProInstrument,
} from "../api/surveyApi";
import type { ProInstrument } from "../types/proInstrument";

const SURVEY_KEYS = {
  all: ["survey-instruments"] as const,
  list: (params?: Record<string, unknown>) =>
    [...SURVEY_KEYS.all, "list", params] as const,
  stats: () => [...SURVEY_KEYS.all, "stats"] as const,
  domains: () => [...SURVEY_KEYS.all, "domains"] as const,
  detail: (id: number) => [...SURVEY_KEYS.all, "detail", id] as const,
};

export function useSurveyInstruments(params?: {
  domain?: string;
  omop_coverage?: string;
  license_type?: string;
  has_loinc?: boolean;
  search?: string;
  sort?: string;
  dir?: string;
  per_page?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: SURVEY_KEYS.list(params as Record<string, unknown>),
    queryFn: () => fetchSurveyInstruments(params),
  });
}

export function useSurveyInstrumentsAsProList(): {
  data: ProInstrument[] | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const query = useQuery({
    queryKey: SURVEY_KEYS.list({ per_page: 200 }),
    queryFn: () => fetchSurveyInstruments({ per_page: 200 }),
    select: (response) => response.data.map(toProInstrument),
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useSurveyStats() {
  return useQuery({
    queryKey: SURVEY_KEYS.stats(),
    queryFn: fetchSurveyStats,
  });
}

export function useSurveyDomains() {
  return useQuery({
    queryKey: SURVEY_KEYS.domains(),
    queryFn: fetchSurveyDomains,
  });
}

export function useSurveyInstrument(id: number) {
  return useQuery({
    queryKey: SURVEY_KEYS.detail(id),
    queryFn: () => fetchSurveyInstrument(id),
    enabled: id > 0,
  });
}
