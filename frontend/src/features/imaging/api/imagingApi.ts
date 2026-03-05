import apiClient from "@/lib/api-client";
import type {
  ImagingStats,
  ImagingStudy,
  ImagingFeature,
  ImagingCohortCriterion,
  PopulationAnalytics,
  PaginatedResponse,
} from "../types";

export const imagingApi = {
  // Stats
  getStats: () =>
    apiClient.get<{ data: ImagingStats }>("/imaging/stats").then((r) => r.data.data),

  // Studies
  getStudies: (params?: {
    source_id?: number;
    modality?: string;
    person_id?: number;
    per_page?: number;
    page?: number;
  }) =>
    apiClient
      .get<PaginatedResponse<ImagingStudy>>("/imaging/studies", { params })
      .then((r) => r.data),

  getStudy: (id: number) =>
    apiClient.get<{ data: ImagingStudy }>(`/imaging/studies/${id}`).then((r) => r.data.data),

  indexFromDicomweb: (payload: { source_id: number; limit?: number; modality?: string }) =>
    apiClient
      .post<{ data: { indexed: number; updated: number; errors: number } }>(
        "/imaging/studies/index-from-dicomweb",
        payload,
      )
      .then((r) => r.data.data),

  indexSeries: (studyId: number) =>
    apiClient
      .post<{ data: { indexed: number; errors: number } }>(
        `/imaging/studies/${studyId}/index-series`,
      )
      .then((r) => r.data.data),

  extractNlp: (studyId: number) =>
    apiClient
      .post<{ data: { extracted: number; mapped: number; errors: number } }>(
        `/imaging/studies/${studyId}/extract-nlp`,
      )
      .then((r) => r.data.data),

  // Features
  getFeatures: (params?: {
    study_id?: number;
    source_id?: number;
    feature_type?: string;
    per_page?: number;
  }) =>
    apiClient
      .get<PaginatedResponse<ImagingFeature>>("/imaging/features", { params })
      .then((r) => r.data),

  // Criteria
  getCriteria: (params?: { type?: string }) =>
    apiClient
      .get<{ data: ImagingCohortCriterion[] }>("/imaging/criteria", { params })
      .then((r) => r.data.data),

  createCriterion: (payload: {
    name: string;
    criteria_type: string;
    criteria_definition: Record<string, unknown>;
    description?: string;
    is_shared?: boolean;
  }) =>
    apiClient
      .post<{ data: ImagingCohortCriterion }>("/imaging/criteria", payload)
      .then((r) => r.data.data),

  deleteCriterion: (id: number) => apiClient.delete(`/imaging/criteria/${id}`),

  // Population analytics
  getPopulationAnalytics: (sourceId: number, modality?: string) =>
    apiClient
      .get<{ data: PopulationAnalytics }>("/imaging/analytics/population", {
        params: { source_id: sourceId, modality },
      })
      .then((r) => r.data.data),
};
