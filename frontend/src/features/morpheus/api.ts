import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// Types for Morpheus patient data
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

const BASE = '/api/v1/morpheus/patients';

export function useMorpheusPatients(filters: PatientFilters = {}, limit = 100, offset = 0) {
  return useQuery({
    queryKey: ['morpheus', 'patients', filters, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
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

export function useMorpheusPatientSearch(query: string) {
  return useQuery({
    queryKey: ['morpheus', 'patients', 'search', query],
    queryFn: async () => {
      const res = await apiClient.get(`${BASE}/search?q=${encodeURIComponent(query)}`);
      return res.data.data as MorpheusPatient[];
    },
    enabled: query.length >= 1,
  });
}

export function useMorpheusPatient(subjectId: string | undefined) {
  return useQuery({
    queryKey: ['morpheus', 'patient', subjectId],
    queryFn: async () => {
      const res = await apiClient.get(`${BASE}/${subjectId}`);
      return res.data.data;
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusAdmissions(subjectId: string | undefined) {
  return useQuery({
    queryKey: ['morpheus', 'admissions', subjectId],
    queryFn: async () => {
      const res = await apiClient.get(`${BASE}/${subjectId}/admissions`);
      return res.data.data as MorpheusAdmission[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusTransfers(subjectId: string | undefined, hadmId?: string) {
  return useQuery({
    queryKey: ['morpheus', 'transfers', subjectId, hadmId],
    queryFn: async () => {
      const url = hadmId ? `${BASE}/${subjectId}/transfers?hadm_id=${hadmId}` : `${BASE}/${subjectId}/transfers`;
      const res = await apiClient.get(url);
      return res.data.data as MorpheusTransfer[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusIcuStays(subjectId: string | undefined, hadmId?: string) {
  return useQuery({
    queryKey: ['morpheus', 'icu-stays', subjectId, hadmId],
    queryFn: async () => {
      const url = hadmId ? `${BASE}/${subjectId}/icu-stays?hadm_id=${hadmId}` : `${BASE}/${subjectId}/icu-stays`;
      const res = await apiClient.get(url);
      return res.data.data as MorpheusIcuStay[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusDiagnoses(subjectId: string | undefined, hadmId?: string) {
  return useQuery({
    queryKey: ['morpheus', 'diagnoses', subjectId, hadmId],
    queryFn: async () => {
      const url = hadmId ? `${BASE}/${subjectId}/diagnoses?hadm_id=${hadmId}` : `${BASE}/${subjectId}/diagnoses`;
      const res = await apiClient.get(url);
      return res.data.data as MorpheusDiagnosis[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusMedications(subjectId: string | undefined, hadmId?: string) {
  return useQuery({
    queryKey: ['morpheus', 'medications', subjectId, hadmId],
    queryFn: async () => {
      const url = hadmId ? `${BASE}/${subjectId}/medications?hadm_id=${hadmId}` : `${BASE}/${subjectId}/medications`;
      const res = await apiClient.get(url);
      return res.data.data as MorpheusMedication[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusLabResults(subjectId: string | undefined, hadmId?: string) {
  return useQuery({
    queryKey: ['morpheus', 'lab-results', subjectId, hadmId],
    queryFn: async () => {
      const url = hadmId ? `${BASE}/${subjectId}/lab-results?hadm_id=${hadmId}` : `${BASE}/${subjectId}/lab-results`;
      const res = await apiClient.get(url);
      return res.data.data as MorpheusLabResult[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusVitals(subjectId: string | undefined, hadmId?: string, stayId?: string) {
  return useQuery({
    queryKey: ['morpheus', 'vitals', subjectId, hadmId, stayId],
    queryFn: async () => {
      let url = `${BASE}/${subjectId}/vitals`;
      const params = new URLSearchParams();
      if (hadmId) params.set('hadm_id', hadmId);
      if (stayId) params.set('stay_id', stayId);
      const qs = params.toString();
      if (qs) url += `?${qs}`;
      const res = await apiClient.get(url);
      return res.data.data as MorpheusVital[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusMicrobiology(subjectId: string | undefined, hadmId?: string) {
  return useQuery({
    queryKey: ['morpheus', 'microbiology', subjectId, hadmId],
    queryFn: async () => {
      const url = hadmId ? `${BASE}/${subjectId}/microbiology?hadm_id=${hadmId}` : `${BASE}/${subjectId}/microbiology`;
      const res = await apiClient.get(url);
      return res.data.data as MorpheusMicrobiology[];
    },
    enabled: !!subjectId,
  });
}

export function useMorpheusEventCounts(subjectId: string | undefined, hadmId?: string) {
  return useQuery({
    queryKey: ['morpheus', 'event-counts', subjectId, hadmId],
    queryFn: async () => {
      const url = hadmId ? `${BASE}/${subjectId}/event-counts?hadm_id=${hadmId}` : `${BASE}/${subjectId}/event-counts`;
      const res = await apiClient.get(url);
      return res.data.data as MorpheusEventCounts;
    },
    enabled: !!subjectId,
  });
}

// Dashboard hooks
const DASH = '/api/v1/morpheus/dashboard';

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'metrics'],
    queryFn: async () => { const res = await apiClient.get(`${DASH}/metrics`); return res.data.data as DashboardMetrics; },
  });
}

export function useDashboardTrends() {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'trends'],
    queryFn: async () => { const res = await apiClient.get(`${DASH}/trends`); return res.data.data as DashboardTrend[]; },
  });
}

export function useDashboardTopDiagnoses(limit = 10) {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'top-diagnoses', limit],
    queryFn: async () => { const res = await apiClient.get(`${DASH}/top-diagnoses?limit=${limit}`); return res.data.data as TopDiagnosis[]; },
  });
}

export function useDashboardTopProcedures(limit = 10) {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'top-procedures', limit],
    queryFn: async () => { const res = await apiClient.get(`${DASH}/top-procedures?limit=${limit}`); return res.data.data as TopProcedure[]; },
  });
}

export function useDashboardDemographics() {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'demographics'],
    queryFn: async () => { const res = await apiClient.get(`${DASH}/demographics`); return res.data.data as DemographicBreakdown; },
  });
}

export function useDashboardLosDistribution() {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'los-distribution'],
    queryFn: async () => { const res = await apiClient.get(`${DASH}/los-distribution`); return res.data.data as LosDistribution[]; },
  });
}

export function useDashboardIcuUnits() {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'icu-units'],
    queryFn: async () => { const res = await apiClient.get(`${DASH}/icu-units`); return res.data.data as IcuUnitStats[]; },
  });
}

export function useDashboardMortalityByType() {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'mortality-by-type'],
    queryFn: async () => { const res = await apiClient.get(`${DASH}/mortality-by-type`); return res.data.data as MortalityByType[]; },
  });
}
