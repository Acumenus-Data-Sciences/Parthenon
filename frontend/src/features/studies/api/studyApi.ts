import apiClient, { toLaravelPaginated } from "@/lib/api-client";
import type {
  Study,
  StudyAnalysisEntry,
  StudyProgress,
  StudyStats,
  StudyCreatePayload,
  StudyUpdatePayload,
  StudySite,
  StudyTeamMember,
  StudyCohort,
  StudyMilestone,
  StudyArtifact,
  StudyActivityLogEntry,
  StudyTransitionResponse,
} from "../types/study";
import type { PaginatedResponse } from "@/features/analyses/types/analysis";

const BASE = "/studies";

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getStudyStats(): Promise<StudyStats> {
  const { data } = await apiClient.get(`${BASE}/stats`);
  return data.data ?? data;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listStudies(params?: {
  page?: number;
  search?: string;
  status?: string;
  study_type?: string;
  phase?: string;
  my_studies?: boolean;
}): Promise<PaginatedResponse<Study>> {
  const { data } = await apiClient.get(BASE, { params });
  return toLaravelPaginated<Study>(data);
}

export async function getStudy(idOrSlug: number | string): Promise<Study> {
  const { data } = await apiClient.get(`${BASE}/${idOrSlug}`);
  return data.data ?? data;
}

export async function createStudy(
  payload: StudyCreatePayload,
): Promise<Study> {
  const { data } = await apiClient.post(BASE, payload);
  return data.data ?? data;
}

export async function updateStudy(
  idOrSlug: number | string,
  payload: StudyUpdatePayload,
): Promise<Study> {
  const { data } = await apiClient.put(`${BASE}/${idOrSlug}`, payload);
  return data.data ?? data;
}

export async function deleteStudy(idOrSlug: number | string): Promise<void> {
  await apiClient.delete(`${BASE}/${idOrSlug}`);
}

// ---------------------------------------------------------------------------
// Analyses
// ---------------------------------------------------------------------------

export async function listStudyAnalyses(
  studyId: number,
): Promise<StudyAnalysisEntry[]> {
  const { data } = await apiClient.get<StudyAnalysisEntry[]>(
    `${BASE}/${studyId}/analyses`,
  );
  return data;
}

export async function addStudyAnalysis(
  studyId: number,
  payload: { analysis_type: string; analysis_id: number },
): Promise<StudyAnalysisEntry> {
  const { data } = await apiClient.post(
    `${BASE}/${studyId}/analyses`,
    payload,
  );
  return data.data ?? data;
}

export async function removeStudyAnalysis(
  studyId: number,
  entryId: number,
): Promise<void> {
  await apiClient.delete(`${BASE}/${studyId}/analyses/${entryId}`);
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export async function executeAllStudyAnalyses(
  studyId: number,
  sourceId: number,
): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>(
    `${BASE}/${studyId}/execute`,
    { source_id: sourceId },
  );
  return data;
}

export async function getStudyProgress(
  studyId: number,
): Promise<StudyProgress> {
  const { data } = await apiClient.get<StudyProgress>(
    `${BASE}/${studyId}/progress`,
  );
  return data;
}

// ---------------------------------------------------------------------------
// Status Transitions
// ---------------------------------------------------------------------------

export async function transitionStudy(
  slug: string,
  status: string,
): Promise<StudyTransitionResponse> {
  const { data } = await apiClient.post(`${BASE}/${slug}/transition`, {
    status,
  });
  return data;
}

export async function getAllowedTransitions(
  slug: string,
): Promise<{ current_status: string; allowed_transitions: string[] }> {
  const { data } = await apiClient.get(`${BASE}/${slug}/allowed-transitions`);
  return data.data ?? data;
}

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

export async function listStudySites(slug: string): Promise<StudySite[]> {
  const { data } = await apiClient.get(`${BASE}/${slug}/sites`);
  return data.data ?? data;
}

export async function createStudySite(
  slug: string,
  payload: Partial<StudySite>,
): Promise<StudySite> {
  const { data } = await apiClient.post(`${BASE}/${slug}/sites`, payload);
  return data.data ?? data;
}

export async function updateStudySite(
  slug: string,
  siteId: number,
  payload: Partial<StudySite>,
): Promise<StudySite> {
  const { data } = await apiClient.put(
    `${BASE}/${slug}/sites/${siteId}`,
    payload,
  );
  return data.data ?? data;
}

export async function deleteStudySite(
  slug: string,
  siteId: number,
): Promise<void> {
  await apiClient.delete(`${BASE}/${slug}/sites/${siteId}`);
}

// ---------------------------------------------------------------------------
// Team Members
// ---------------------------------------------------------------------------

export async function listStudyTeam(
  slug: string,
): Promise<StudyTeamMember[]> {
  const { data } = await apiClient.get(`${BASE}/${slug}/team`);
  return data.data ?? data;
}

export async function addStudyTeamMember(
  slug: string,
  payload: { user_id: number; role: string; site_id?: number; permissions?: Record<string, boolean> },
): Promise<StudyTeamMember> {
  const { data } = await apiClient.post(`${BASE}/${slug}/team`, payload);
  return data.data ?? data;
}

export async function updateStudyTeamMember(
  slug: string,
  memberId: number,
  payload: Partial<StudyTeamMember>,
): Promise<StudyTeamMember> {
  const { data } = await apiClient.put(
    `${BASE}/${slug}/team/${memberId}`,
    payload,
  );
  return data.data ?? data;
}

export async function removeStudyTeamMember(
  slug: string,
  memberId: number,
): Promise<void> {
  await apiClient.delete(`${BASE}/${slug}/team/${memberId}`);
}

// ---------------------------------------------------------------------------
// Cohorts
// ---------------------------------------------------------------------------

export async function listStudyCohorts(
  slug: string,
): Promise<StudyCohort[]> {
  const { data } = await apiClient.get(`${BASE}/${slug}/cohorts`);
  return data.data ?? data;
}

export async function addStudyCohort(
  slug: string,
  payload: Partial<StudyCohort>,
): Promise<StudyCohort> {
  const { data } = await apiClient.post(`${BASE}/${slug}/cohorts`, payload);
  return data.data ?? data;
}

export async function updateStudyCohort(
  slug: string,
  cohortId: number,
  payload: Partial<StudyCohort>,
): Promise<StudyCohort> {
  const { data } = await apiClient.put(
    `${BASE}/${slug}/cohorts/${cohortId}`,
    payload,
  );
  return data.data ?? data;
}

export async function removeStudyCohort(
  slug: string,
  cohortId: number,
): Promise<void> {
  await apiClient.delete(`${BASE}/${slug}/cohorts/${cohortId}`);
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export async function listStudyMilestones(
  slug: string,
): Promise<StudyMilestone[]> {
  const { data } = await apiClient.get(`${BASE}/${slug}/milestones`);
  return data.data ?? data;
}

export async function createStudyMilestone(
  slug: string,
  payload: Partial<StudyMilestone>,
): Promise<StudyMilestone> {
  const { data } = await apiClient.post(
    `${BASE}/${slug}/milestones`,
    payload,
  );
  return data.data ?? data;
}

export async function updateStudyMilestone(
  slug: string,
  milestoneId: number,
  payload: Partial<StudyMilestone>,
): Promise<StudyMilestone> {
  const { data } = await apiClient.put(
    `${BASE}/${slug}/milestones/${milestoneId}`,
    payload,
  );
  return data.data ?? data;
}

export async function deleteStudyMilestone(
  slug: string,
  milestoneId: number,
): Promise<void> {
  await apiClient.delete(`${BASE}/${slug}/milestones/${milestoneId}`);
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export async function listStudyArtifacts(
  slug: string,
): Promise<StudyArtifact[]> {
  const { data } = await apiClient.get(`${BASE}/${slug}/artifacts`);
  return data.data ?? data;
}

export async function createStudyArtifact(
  slug: string,
  payload: Partial<StudyArtifact>,
): Promise<StudyArtifact> {
  const { data } = await apiClient.post(
    `${BASE}/${slug}/artifacts`,
    payload,
  );
  return data.data ?? data;
}

export async function updateStudyArtifact(
  slug: string,
  artifactId: number,
  payload: Partial<StudyArtifact>,
): Promise<StudyArtifact> {
  const { data } = await apiClient.put(
    `${BASE}/${slug}/artifacts/${artifactId}`,
    payload,
  );
  return data.data ?? data;
}

export async function deleteStudyArtifact(
  slug: string,
  artifactId: number,
): Promise<void> {
  await apiClient.delete(`${BASE}/${slug}/artifacts/${artifactId}`);
}

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------

export async function listStudyActivity(
  slug: string,
  params?: { page?: number },
): Promise<PaginatedResponse<StudyActivityLogEntry>> {
  const { data } = await apiClient.get(`${BASE}/${slug}/activity`, { params });
  return toLaravelPaginated<StudyActivityLogEntry>(data);
}
