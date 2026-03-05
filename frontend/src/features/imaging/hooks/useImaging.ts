import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { imagingApi } from "../api/imagingApi";

export const IMAGING_KEYS = {
  stats: ["imaging", "stats"] as const,
  studies: (params?: object) => ["imaging", "studies", params] as const,
  study: (id: number) => ["imaging", "study", id] as const,
  features: (params?: object) => ["imaging", "features", params] as const,
  criteria: (params?: object) => ["imaging", "criteria", params] as const,
  population: (sourceId: number) => ["imaging", "population", sourceId] as const,
};

export function useImagingStats() {
  return useQuery({
    queryKey: IMAGING_KEYS.stats,
    queryFn: imagingApi.getStats,
  });
}

export function useImagingStudies(params?: Parameters<typeof imagingApi.getStudies>[0]) {
  return useQuery({
    queryKey: IMAGING_KEYS.studies(params),
    queryFn: () => imagingApi.getStudies(params),
  });
}

export function useImagingStudy(id: number) {
  return useQuery({
    queryKey: IMAGING_KEYS.study(id),
    queryFn: () => imagingApi.getStudy(id),
    enabled: id > 0,
  });
}

export function useImagingFeatures(params?: Parameters<typeof imagingApi.getFeatures>[0]) {
  return useQuery({
    queryKey: IMAGING_KEYS.features(params),
    queryFn: () => imagingApi.getFeatures(params),
  });
}

export function useImagingCriteria(params?: { type?: string }) {
  return useQuery({
    queryKey: IMAGING_KEYS.criteria(params),
    queryFn: () => imagingApi.getCriteria(params),
  });
}

export function useCreateImagingCriterion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: imagingApi.createCriterion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["imaging", "criteria"] }),
  });
}

export function useDeleteImagingCriterion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: imagingApi.deleteCriterion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["imaging", "criteria"] }),
  });
}

export function useIndexFromDicomweb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: imagingApi.indexFromDicomweb,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["imaging", "studies"] }),
  });
}

export function useIndexSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: imagingApi.indexSeries,
    onSuccess: (_data, studyId) => {
      qc.invalidateQueries({ queryKey: IMAGING_KEYS.study(studyId) });
    },
  });
}

export function useExtractNlp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: imagingApi.extractNlp,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["imaging", "features"] }),
  });
}

export function usePopulationAnalytics(sourceId: number) {
  return useQuery({
    queryKey: IMAGING_KEYS.population(sourceId),
    queryFn: () => imagingApi.getPopulationAnalytics(sourceId),
    enabled: sourceId > 0,
  });
}
