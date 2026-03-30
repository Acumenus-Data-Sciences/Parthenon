import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cloneSurveyInstrument,
  createSurveyInstrument,
  createSurveyItem,
  deleteSurveyInstrument,
  deleteSurveyItem,
  fetchSurveyInstruments,
  fetchSurveyStats,
  fetchSurveyDomains,
  fetchSurveyInstrument,
  toProInstrument,
  updateSurveyInstrument,
  updateSurveyItem,
  type SurveyInstrumentPayload,
  type SurveyItemPayload,
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

export function useCreateSurveyInstrument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SurveyInstrumentPayload) => createSurveyInstrument(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.all });
    },
  });
}

export function useUpdateSurveyInstrument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SurveyInstrumentPayload }) =>
      updateSurveyInstrument(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.detail(variables.id) });
    },
  });
}

export function useCloneSurveyInstrument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload?: { name?: string; abbreviation?: string } }) =>
      cloneSurveyInstrument(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.detail(data.id) });
    },
  });
}

export function useDeleteSurveyInstrument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteSurveyInstrument(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.all });
      queryClient.removeQueries({ queryKey: SURVEY_KEYS.detail(id) });
    },
  });
}

export function useCreateSurveyItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ instrumentId, payload }: { instrumentId: number; payload: SurveyItemPayload }) =>
      createSurveyItem(instrumentId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.detail(variables.instrumentId) });
    },
  });
}

export function useUpdateSurveyItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      instrumentId,
      itemId,
      payload,
    }: {
      instrumentId: number;
      itemId: number;
      payload: SurveyItemPayload;
    }) => updateSurveyItem(instrumentId, itemId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.detail(variables.instrumentId) });
    },
  });
}

export function useDeleteSurveyItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ instrumentId, itemId }: { instrumentId: number; itemId: number }) =>
      deleteSurveyItem(instrumentId, itemId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.detail(variables.instrumentId) });
    },
  });
}
