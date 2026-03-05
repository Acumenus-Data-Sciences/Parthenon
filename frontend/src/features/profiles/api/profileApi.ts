import apiClient from "@/lib/api-client";
import type { PatientProfile, CohortMember } from "../types/profile";

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
