import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ── Dataset types ────────────────────────────────────────────────────────────

export interface MorpheusDataset {
  dataset_id: number;
  name: string;
  schema_name: string;
  description: string | null;
  source_type: string | null;
  patient_count: number | null;
  status: string;
}

export function useMorpheusDatasets() {
  return useQuery({
    queryKey: ['morpheus', 'datasets'],
    queryFn: async () => {
      const res = await apiClient.get('/morpheus/datasets');
      return res.data.data as MorpheusDataset[];
    },
  });
}

// ── Patient types ────────────────────────────────────────────────────────────

export interface MorpheusPatient {
  subject_id: string;
  gender: string;
  anchor_age: string;
  anchor_year: string;
  anchor_year_group: string;
  dod: string | null;
  admission_count: number;
  icu_stay_count?: number;
  total_los_days: number | null;
  longest_icu_los: number | null;
  primary_diagnosis: string | null;
  primary_icd_code: string | null;
  deceased: boolean;
}

export interface MorpheusAdmission {
  hadm_id: string;
  admittime: string;
  dischtime: string;
  deathtime: string | null;
  admission_type: string;
  admission_location: string;
  discharge_location: string;
  insurance: string;
  language: string;
  marital_status: string;
  race: string;
  hospital_expire_flag: string;
  los_days: number;
}

export interface MorpheusTransfer {
  transfer_id: string;
  hadm_id: string;
  eventtype: string;
  careunit: string | null;
  intime: string;
  outtime: string | null;
  duration_hours: number | null;
}

export interface MorpheusIcuStay {
  stay_id: string;
  hadm_id: string;
  first_careunit: string;
  last_careunit: string;
  intime: string;
  outtime: string;
  los_days: number;
}

export interface MorpheusDiagnosis {
  hadm_id: string;
  seq_num: string;
  icd_code: string;
  icd_version: string;
  description: string;
  concept_id: number | null;
  standard_concept_name: string | null;
}

export interface MorpheusVital {
  stay_id: string;
  charttime: string;
  itemid: string;
  label: string;
  abbreviation: string;
  category: string;
  value: string | null;
  valuenum: string | null;
  valueuom: string | null;
}

export interface MorpheusMedication {
  hadm_id: string;
  starttime: string;
  stoptime: string | null;
  drug: string;
  drug_type: string;
  route: string;
  dose_val_rx: string;
  dose_unit_rx: string;
}

export interface MorpheusLabResult {
  labevent_id: string;
  hadm_id: string;
  charttime: string;
  itemid: string;
  label: string;
  fluid: string;
  category: string;
  value: string | null;
  valuenum: string | null;
  valueuom: string | null;
  ref_range_lower: string | null;
  ref_range_upper: string | null;
  flag: string | null;
}

export interface MorpheusMicrobiology {
  microevent_id: string;
  hadm_id: string;
  chartdate: string;
  spec_type_desc: string;
  test_name: string;
  org_name: string | null;
  ab_name: string | null;
  interpretation: string | null;
  dilution_comparison: string | null;
  dilution_value: string | null;
}

export interface MorpheusEventCounts {
  [domain: string]: number;
}

export interface DashboardMetrics {
  total_patients: number;
  total_admissions: number;
  icu_admission_rate: number;
  mortality_rate: number;
  avg_los_days: number;
  avg_icu_los_days: number;
}

export interface DashboardTrend {
  month: string;
  admissions: number;
  deaths: number;
  mortality_rate: number;
  avg_los: number;
}

export interface TopDiagnosis {
  icd_code: string;
  icd_version: string;
  description: string;
  patient_count: number;
}

export interface TopProcedure {
  icd_code: string;
  icd_version: string;
  description: string;
  patient_count: number;
}

export interface DemographicBreakdown {
  gender: Record<string, number>;
  age_groups: Array<{ range: string; count: number }>;
}

export interface LosDistribution {
  bucket: string;
  count: number;
}

export interface IcuUnitStats {
  careunit: string;
  admission_count: number;
  avg_los_days: number;
}

export interface MortalityByType {
  admission_type: string;
  total: number;
  deaths: number;
  rate: number;
}

export interface PatientFilters {
  icu?: boolean;
  deceased?: boolean;
  admission_type?: string;
  min_los?: number;
  max_los?: number;
  diagnosis?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// ── Helper to build dataset query string ─────────────────────────────────────

function datasetParam(dataset?: string): string {
  return dataset ? `?dataset=${encodeURIComponent(dataset)}` : '';
}

function appendDataset(url: string, dataset?: string): string {
  if (!dataset) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}dataset=${encodeURIComponent(dataset)}`;
}

// ── Patient hooks ────────────────────────────────────────────────────────────

const BASE = '/morpheus/patients';

export function useMorpheusPatients(filters: PatientFilters = {}, limit = 100, offset = 0, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'patients', filters, limit, offset, dataset],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      if (dataset) params.set('dataset', dataset);
      if (filters.icu !== undefined) params.set('icu', String(filters.icu));
      if (filters.deceased !== undefined) params.set('deceased', String(filters.deceased));
      if (filters.admission_type) params.set('admission_type', filters.admission_type);
      if (filters.min_los !== undefined) params.set('min_los', String(filters.min_los));
      if (filters.max_los !== undefined) params.set('max_los', String(filters.max_los));
      if (filters.diagnosis) params.set('diagnosis', filters.diagnosis);
      if (filters.sort) params.set('sort', filters.sort);
      if (filters.order) params.set('order', filters.order);
      const res = await apiClient.get(`${BASE}?${params.toString()}`);
      return res.data as { data: MorpheusPatient[]; total: number };
    },
  });
}

export function useMorpheusPatientSearch(query: string, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'patients', 'search', query, dataset],
    queryFn: async () => {
      const url = appendDataset(`${BASE}/search?q=${encodeURIComponent(query)}`, dataset);
      const res = await apiClient.get(url);
      return res.data.data as MorpheusPatient[];
    },
    enabled: query.length >= 1,
  });
}

export function useMorpheusPatient(subjectId: string | undefined, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'patient', subjectId, dataset],
    queryFn: async () => {
      const res = await apiClient.get(appendDataset(`${BASE}/${subjectId}`, dataset));
      return res.data.data;
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusAdmissions(subjectId: string | undefined, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'admissions', subjectId, dataset],
    queryFn: async () => {
      const res = await apiClient.get(appendDataset(`${BASE}/${subjectId}/admissions`, dataset));
      return res.data.data as MorpheusAdmission[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusTransfers(subjectId: string | undefined, hadmId?: string, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'transfers', subjectId, hadmId, dataset],
    queryFn: async () => {
      let url = `${BASE}/${subjectId}/transfers`;
      if (hadmId) url += `?hadm_id=${hadmId}`;
      const res = await apiClient.get(appendDataset(url, dataset));
      return res.data.data as MorpheusTransfer[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusIcuStays(subjectId: string | undefined, hadmId?: string, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'icu-stays', subjectId, hadmId, dataset],
    queryFn: async () => {
      let url = `${BASE}/${subjectId}/icu-stays`;
      if (hadmId) url += `?hadm_id=${hadmId}`;
      const res = await apiClient.get(appendDataset(url, dataset));
      return res.data.data as MorpheusIcuStay[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusDiagnoses(subjectId: string | undefined, hadmId?: string, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'diagnoses', subjectId, hadmId, dataset],
    queryFn: async () => {
      let url = `${BASE}/${subjectId}/diagnoses`;
      if (hadmId) url += `?hadm_id=${hadmId}`;
      const res = await apiClient.get(appendDataset(url, dataset));
      return res.data.data as MorpheusDiagnosis[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusMedications(subjectId: string | undefined, hadmId?: string, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'medications', subjectId, hadmId, dataset],
    queryFn: async () => {
      let url = `${BASE}/${subjectId}/medications`;
      if (hadmId) url += `?hadm_id=${hadmId}`;
      const res = await apiClient.get(appendDataset(url, dataset));
      return res.data.data as MorpheusMedication[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusLabResults(subjectId: string | undefined, hadmId?: string, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'lab-results', subjectId, hadmId, dataset],
    queryFn: async () => {
      let url = `${BASE}/${subjectId}/lab-results`;
      if (hadmId) url += `?hadm_id=${hadmId}`;
      const res = await apiClient.get(appendDataset(url, dataset));
      return res.data.data as MorpheusLabResult[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusVitals(subjectId: string | undefined, hadmId?: string, stayId?: string, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'vitals', subjectId, hadmId, stayId, dataset],
    queryFn: async () => {
      let url = `${BASE}/${subjectId}/vitals`;
      const params = new URLSearchParams();
      if (hadmId) params.set('hadm_id', hadmId);
      if (stayId) params.set('stay_id', stayId);
      if (dataset) params.set('dataset', dataset);
      const qs = params.toString();
      if (qs) url += `?${qs}`;
      const res = await apiClient.get(url);
      return res.data.data as MorpheusVital[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusMicrobiology(subjectId: string | undefined, hadmId?: string, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'microbiology', subjectId, hadmId, dataset],
    queryFn: async () => {
      let url = `${BASE}/${subjectId}/microbiology`;
      if (hadmId) url += `?hadm_id=${hadmId}`;
      const res = await apiClient.get(appendDataset(url, dataset));
      return res.data.data as MorpheusMicrobiology[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusEventCounts(subjectId: string | undefined, hadmId?: string, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'event-counts', subjectId, hadmId, dataset],
    queryFn: async () => {
      let url = `${BASE}/${subjectId}/event-counts`;
      if (hadmId) url += `?hadm_id=${hadmId}`;
      const res = await apiClient.get(appendDataset(url, dataset));
      return res.data.data as MorpheusEventCounts;
    },
    enabled: !!subjectId,
  });
}

// ── Dashboard hooks ──────────────────────────────────────────────────────────

const DASH = '/morpheus/dashboard';

export function useDashboardMetrics(dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'metrics', dataset],
    queryFn: async () => {
      const res = await apiClient.get(`${DASH}/metrics${datasetParam(dataset)}`);
      return res.data.data as DashboardMetrics;
    },
  });
}

export function useDashboardTrends(dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'trends', dataset],
    queryFn: async () => {
      const res = await apiClient.get(`${DASH}/trends${datasetParam(dataset)}`);
      return res.data.data as DashboardTrend[];
    },
  });
}

export function useDashboardTopDiagnoses(limit = 10, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'top-diagnoses', limit, dataset],
    queryFn: async () => {
      const res = await apiClient.get(appendDataset(`${DASH}/top-diagnoses?limit=${limit}`, dataset));
      return res.data.data as TopDiagnosis[];
    },
  });
}

export function useDashboardTopProcedures(limit = 10, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'top-procedures', limit, dataset],
    queryFn: async () => {
      const res = await apiClient.get(appendDataset(`${DASH}/top-procedures?limit=${limit}`, dataset));
      return res.data.data as TopProcedure[];
    },
  });
}

export function useDashboardDemographics(dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'demographics', dataset],
    queryFn: async () => {
      const res = await apiClient.get(`${DASH}/demographics${datasetParam(dataset)}`);
      return res.data.data as DemographicBreakdown;
    },
  });
}

export function useDashboardLosDistribution(dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'los-distribution', dataset],
    queryFn: async () => {
      const res = await apiClient.get(`${DASH}/los-distribution${datasetParam(dataset)}`);
      return res.data.data as LosDistribution[];
    },
  });
}

export function useDashboardIcuUnits(dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'icu-units', dataset],
    queryFn: async () => {
      const res = await apiClient.get(`${DASH}/icu-units${datasetParam(dataset)}`);
      return res.data.data as IcuUnitStats[];
    },
  });
}

export function useDashboardMortalityByType(dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'mortality-by-type', dataset],
    queryFn: async () => {
      const res = await apiClient.get(`${DASH}/mortality-by-type${datasetParam(dataset)}`);
      return res.data.data as MortalityByType[];
    },
  });
}

// ── Concept Stats (for ConceptDetailDrawer population context) ──────────────

export interface ConceptStats {
  concept_id: number;
  patient_count: number;
  total_patients: number;
  percentage: number;
  mean_value: number | null;
  median_value: number | null;
}

export function useMorpheusConceptStats(conceptId: number | undefined, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'concept-stats', conceptId, dataset],
    queryFn: async () => {
      const res = await apiClient.get(
        appendDataset(`${DASH}/concept-stats/${conceptId}`, dataset),
      );
      return res.data.data as ConceptStats;
    },
    enabled: !!conceptId,
    staleTime: 60_000, // 60s cache per spec
  });
}
