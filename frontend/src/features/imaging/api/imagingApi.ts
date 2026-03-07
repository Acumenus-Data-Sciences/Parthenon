import apiClient from "@/lib/api-client";
import type {
  ImagingStats,
  ImagingStudy,
  ImagingFeature,
  ImagingCohortCriterion,
  ImagingMeasurement,
  ImagingResponseAssessment,
  PopulationAnalytics,
  PatientTimeline,
  PatientWithImaging,
  MeasurementTrend,
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

  // Local DICOM import (triggers server-side Python scan)
  importLocal: (payload: { source_id: number; dir?: string }) =>
    apiClient
      .post<{ data: { studies_imported: number; series_imported: number; instances_imported: number } }>(
        "/imaging/import-local/trigger",
        payload,
      )
      .then((r) => r.data.data),

  // ── Imaging Outcomes Research ──────────────────────────────────────────

  // Patient timeline
  getPatientTimeline: (personId: number) =>
    apiClient
      .get<{ data: PatientTimeline }>(`/imaging/patients/${personId}/timeline`)
      .then((r) => r.data.data),

  getPatientStudies: (personId: number) =>
    apiClient
      .get<{ data: ImagingStudy[] }>(`/imaging/patients/${personId}/studies`)
      .then((r) => r.data.data),

  // Patients with imaging
  getPatientsWithImaging: (params?: {
    min_studies?: number;
    modality?: string;
    per_page?: number;
    page?: number;
  }) =>
    apiClient
      .get<PaginatedResponse<PatientWithImaging>>("/imaging/patients", { params })
      .then((r) => r.data),

  // Study-person linking
  linkStudyToPerson: (studyId: number, personId: number) =>
    apiClient
      .post<{ data: ImagingStudy }>(`/imaging/studies/${studyId}/link-person`, { person_id: personId })
      .then((r) => r.data.data),

  bulkLinkStudies: (studyIds: number[], personId: number) =>
    apiClient
      .post<{ data: { linked: number } }>("/imaging/studies/bulk-link", {
        study_ids: studyIds,
        person_id: personId,
      })
      .then((r) => r.data.data),

  autoLinkStudies: () =>
    apiClient
      .post<{ data: { linked: number } }>("/imaging/studies/auto-link")
      .then((r) => r.data.data),

  // Measurements
  getStudyMeasurements: (studyId: number) =>
    apiClient
      .get<{ data: ImagingMeasurement[] }>(`/imaging/studies/${studyId}/measurements`)
      .then((r) => r.data.data),

  createMeasurement: (studyId: number, payload: {
    measurement_type: string;
    measurement_name: string;
    value_as_number: number;
    unit: string;
    body_site?: string;
    laterality?: string;
    series_id?: number;
    algorithm_name?: string;
    confidence?: number;
    measured_at?: string;
    is_target_lesion?: boolean;
    target_lesion_number?: number;
  }) =>
    apiClient
      .post<{ data: ImagingMeasurement }>(`/imaging/studies/${studyId}/measurements`, payload)
      .then((r) => r.data.data),

  updateMeasurement: (measurementId: number, payload: Partial<ImagingMeasurement>) =>
    apiClient
      .put<{ data: ImagingMeasurement }>(`/imaging/measurements/${measurementId}`, payload)
      .then((r) => r.data.data),

  deleteMeasurement: (measurementId: number) =>
    apiClient.delete(`/imaging/measurements/${measurementId}`),

  getPatientMeasurements: (personId: number, params?: {
    measurement_type?: string;
    body_site?: string;
  }) =>
    apiClient
      .get<{ data: ImagingMeasurement[] }>(`/imaging/patients/${personId}/measurements`, { params })
      .then((r) => r.data.data),

  getMeasurementTrends: (personId: number, measurementType: string, bodySite?: string) =>
    apiClient
      .get<{ data: MeasurementTrend[] }>(`/imaging/patients/${personId}/measurements/trends`, {
        params: { measurement_type: measurementType, body_site: bodySite },
      })
      .then((r) => r.data.data),

  // Response assessments
  getPatientResponseAssessments: (personId: number) =>
    apiClient
      .get<{ data: ImagingResponseAssessment[] }>(`/imaging/patients/${personId}/response-assessments`)
      .then((r) => r.data.data),

  createResponseAssessment: (personId: number, payload: {
    criteria_type: string;
    assessment_date: string;
    baseline_study_id: number;
    current_study_id: number;
    response_category: string;
    body_site?: string;
    baseline_value?: number;
    nadir_value?: number;
    current_value?: number;
    percent_change_from_baseline?: number;
    percent_change_from_nadir?: number;
    rationale?: string;
    is_confirmed?: boolean;
  }) =>
    apiClient
      .post<{ data: ImagingResponseAssessment }>(`/imaging/patients/${personId}/response-assessments`, payload)
      .then((r) => r.data.data),

  // AI-powered measurement extraction
  aiExtractMeasurements: (studyId: number) =>
    apiClient
      .post<{ data: { extracted: number; measurement_types: string[] } }>(
        `/imaging/studies/${studyId}/ai-extract`,
      )
      .then((r) => r.data.data),

  suggestTemplate: (studyId: number) =>
    apiClient
      .get<{ data: { template: string; fields: Array<{ type: string; name: string; unit: string }> } }>(
        `/imaging/studies/${studyId}/suggest-template`,
      )
      .then((r) => r.data.data),
};
