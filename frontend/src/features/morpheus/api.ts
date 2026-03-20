import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

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

const BASE = '/api/v1/morpheus/patients';

export function useMorpheusPatients(limit = 100) {
  return useQuery({
    queryKey: ['morpheus', 'patients', limit],
    queryFn: async () => {
      const res = await apiClient.get(`${BASE}?limit=${limit}`);
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
