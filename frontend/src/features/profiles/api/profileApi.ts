import apiClient from "@/lib/api-client";
import type { PatientProfile, CohortMember, ClinicalNote } from "../types/profile";

// ---------------------------------------------------------------------------
// Patient profile
// ---------------------------------------------------------------------------

export async function getPatientProfile(
  sourceId: number,
  personId: number,
): Promise<PatientProfile> {
  // Backend wraps in {data: T} — unwrap the envelope
  const { data } = await apiClient.get<{ data: PatientProfile }>(
    `/sources/${sourceId}/profiles/${personId}`,
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Person search
// ---------------------------------------------------------------------------

export interface PersonSearchResult {
  person_id: number;
  person_source_value: string;
  year_of_birth: number;
  month_of_birth: number | null;
  gender: string;
  race: string;
}

export async function searchPersons(
  sourceId: number,
  query: string,
  limit = 20,
): Promise<PersonSearchResult[]> {
  const { data } = await apiClient.get<{ data: PersonSearchResult[] }>(
    `/sources/${sourceId}/persons/search`,
    { params: { q: query, limit } },
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Profile stats (per-domain row counts for truncation detection)
// ---------------------------------------------------------------------------

/** The per-domain LIMIT applied by the backend profile queries. */
export const PROFILE_DOMAIN_LIMIT = 2000;

export interface ProfileStats {
  condition: number;
  drug: number;
  procedure: number;
  measurement: number;
  observation: number;
  visit: number;
  condition_era: number;
  drug_era: number;
}

export async function getProfileStats(
  sourceId: number,
  personId: number,
): Promise<ProfileStats> {
  const { data } = await apiClient.get<{ data: ProfileStats }>(
    `/sources/${sourceId}/profiles/${personId}/stats`,
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Patient notes
// ---------------------------------------------------------------------------

export interface NotesPaginatedResponse {
  data: ClinicalNote[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export async function getPatientNotes(
  sourceId: number,
  personId: number,
  params?: { page?: number; per_page?: number },
): Promise<NotesPaginatedResponse> {
  const { data } = await apiClient.get<NotesPaginatedResponse>(
    `/sources/${sourceId}/profiles/${personId}/notes`,
    { params },
  );
  return data;
}

// ---------------------------------------------------------------------------
// Cohort members
// ---------------------------------------------------------------------------

export interface CohortMembersPaginatedResponse {
  data: CohortMember[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export async function getCohortMembers(
  sourceId: number,
  cohortId: number,
  params?: { page?: number; per_page?: number },
): Promise<CohortMembersPaginatedResponse> {
  // Backend returns {data: [...], meta: {...}} directly (no extra envelope)
  const { data } = await apiClient.get<CohortMembersPaginatedResponse>(
    `/sources/${sourceId}/cohorts/${cohortId}/members`,
    { params },
  );
  return data;
}
