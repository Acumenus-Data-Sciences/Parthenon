import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { imagingApi } from "../api/imagingApi";

export const IMAGING_KEYS = {
  stats: ["imaging", "stats"] as const,
  studies: (params?: object) => ["imaging", "studies", params] as const,
  study: (id: number) => ["imaging", "study", id] as const,
  features: (params?: object) => ["imaging", "features", params] as const,
  criteria: (params?: object) => ["imaging", "criteria", params] as const,
  population: (sourceId: number) => ["imaging", "population", sourceId] as const,
  // Outcomes research keys
  patients: (params?: object) => ["imaging", "patients", params] as const,
  patientTimeline: (personId: number) => ["imaging", "timeline", personId] as const,
  patientStudies: (personId: number) => ["imaging", "patient-studies", personId] as const,
  studyMeasurements: (studyId: number) => ["imaging", "study-measurements", studyId] as const,
  patientMeasurements: (personId: number, params?: object) => ["imaging", "patient-measurements", personId, params] as const,
  measurementTrends: (personId: number, type: string, site?: string) => ["imaging", "trends", personId, type, site] as const,
  responseAssessments: (personId: number) => ["imaging", "response-assessments", personId] as const,
};

// ── Existing hooks (unchanged) ──────────────────────────────────────────

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["imaging", "studies"] });
      qc.invalidateQueries({ queryKey: ["imaging", "stats"] });
    },
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

export function useImportLocalDicom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: imagingApi.importLocal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["imaging", "studies"] });
      qc.invalidateQueries({ queryKey: ["imaging", "stats"] });
    },
  });
}

// ── Imaging Outcomes Research hooks ─────────────────────────────────────

export function usePatientsWithImaging(params?: Parameters<typeof imagingApi.getPatientsWithImaging>[0]) {
  return useQuery({
    queryKey: IMAGING_KEYS.patients(params),
    queryFn: () => imagingApi.getPatientsWithImaging(params),
  });
}

export function usePatientTimeline(personId: number) {
  return useQuery({
    queryKey: IMAGING_KEYS.patientTimeline(personId),
    queryFn: () => imagingApi.getPatientTimeline(personId),
    enabled: personId > 0,
  });
}

export function usePatientStudies(personId: number) {
  return useQuery({
    queryKey: IMAGING_KEYS.patientStudies(personId),
    queryFn: () => imagingApi.getPatientStudies(personId),
    enabled: personId > 0,
  });
}

export function useLinkStudyToPerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studyId, personId }: { studyId: number; personId: number }) =>
      imagingApi.linkStudyToPerson(studyId, personId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["imaging", "studies"] });
      qc.invalidateQueries({ queryKey: ["imaging", "patients"] });
      qc.invalidateQueries({ queryKey: ["imaging", "stats"] });
    },
  });
}

export function useAutoLinkStudies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: imagingApi.autoLinkStudies,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["imaging", "studies"] });
      qc.invalidateQueries({ queryKey: ["imaging", "patients"] });
      qc.invalidateQueries({ queryKey: ["imaging", "stats"] });
    },
  });
}

// Measurements

export function useStudyMeasurements(studyId: number) {
  return useQuery({
    queryKey: IMAGING_KEYS.studyMeasurements(studyId),
    queryFn: () => imagingApi.getStudyMeasurements(studyId),
    enabled: studyId > 0,
  });
}

export function useCreateMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studyId, ...payload }: Parameters<typeof imagingApi.createMeasurement>[1] & { studyId: number }) =>
      imagingApi.createMeasurement(studyId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: IMAGING_KEYS.studyMeasurements(variables.studyId) });
      qc.invalidateQueries({ queryKey: ["imaging", "patient-measurements"] });
      qc.invalidateQueries({ queryKey: ["imaging", "trends"] });
      qc.invalidateQueries({ queryKey: ["imaging", "timeline"] });
    },
  });
}

export function useDeleteMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: imagingApi.deleteMeasurement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["imaging", "study-measurements"] });
      qc.invalidateQueries({ queryKey: ["imaging", "patient-measurements"] });
      qc.invalidateQueries({ queryKey: ["imaging", "trends"] });
      qc.invalidateQueries({ queryKey: ["imaging", "timeline"] });
    },
  });
}

export function usePatientMeasurements(personId: number, params?: { measurement_type?: string; body_site?: string }) {
  return useQuery({
    queryKey: IMAGING_KEYS.patientMeasurements(personId, params),
    queryFn: () => imagingApi.getPatientMeasurements(personId, params),
    enabled: personId > 0,
  });
}

export function useMeasurementTrends(personId: number, measurementType: string, bodySite?: string) {
  return useQuery({
    queryKey: IMAGING_KEYS.measurementTrends(personId, measurementType, bodySite),
    queryFn: () => imagingApi.getMeasurementTrends(personId, measurementType, bodySite),
    enabled: personId > 0 && measurementType.length > 0,
  });
}

// Response assessments

export function usePatientResponseAssessments(personId: number) {
  return useQuery({
    queryKey: IMAGING_KEYS.responseAssessments(personId),
    queryFn: () => imagingApi.getPatientResponseAssessments(personId),
    enabled: personId > 0,
  });
}

export function useCreateResponseAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, ...payload }: Parameters<typeof imagingApi.createResponseAssessment>[1] & { personId: number }) =>
      imagingApi.createResponseAssessment(personId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: IMAGING_KEYS.responseAssessments(variables.personId) });
    },
  });
}

export function useComputeResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, ...payload }: { personId: number; current_study_id: number; baseline_study_id?: number; criteria_type?: string }) =>
      imagingApi.computeResponse(personId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: IMAGING_KEYS.responseAssessments(variables.personId) });
      qc.invalidateQueries({ queryKey: ["imaging", "timeline"] });
    },
  });
}

// AI extraction

export function useAiExtractMeasurements() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: imagingApi.aiExtractMeasurements,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["imaging", "study-measurements"] });
      qc.invalidateQueries({ queryKey: ["imaging", "patient-measurements"] });
      qc.invalidateQueries({ queryKey: ["imaging", "timeline"] });
    },
  });
}

export function useSuggestTemplate(studyId: number) {
  return useQuery({
    queryKey: ["imaging", "suggest-template", studyId] as const,
    queryFn: () => imagingApi.suggestTemplate(studyId),
    enabled: studyId > 0,
  });
}
