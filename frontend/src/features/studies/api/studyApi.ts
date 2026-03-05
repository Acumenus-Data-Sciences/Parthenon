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
  StudyResult,
  StudySynthesis,
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
  per_page?: number;
  search?: string;
  status?: string;
  study_type?: string;
  phase?: string;
  my_studies?: boolean;
}): Promise<{ data: Study[]; total: number; current_page: number; last_page: number; per_page: number }> {
  const { data } = await apiClient.get(BASE, { params });
  return data;
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
  slugOrId: string | number,
): Promise<StudyAnalysisEntry[]> {
  const { data } = await apiClient.get(
    `${BASE}/${slugOrId}/analyses`,
  );
  return data.data ?? data;
}

export async function addStudyAnalysis(
  slugOrId: string | number,
  payload: { analysis_type: string; analysis_id: number },
): Promise<StudyAnalysisEntry> {
  const { data } = await apiClient.post(
    `${BASE}/${slugOrId}/analyses`,
    payload,
  );
  return data.data ?? data;
}

export async function removeStudyAnalysis(
  slugOrId: string | number,
  entryId: number,
): Promise<void> {
  await apiClient.delete(`${BASE}/${slugOrId}/analyses/${entryId}`);
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export async function executeAllStudyAnalyses(
  slugOrId: string | number,
  sourceId: number,
): Promise<{ message: string }> {
  const { data } = await apiClient.post(
    `${BASE}/${slugOrId}/execute`,
    { source_id: sourceId },
  );
  return data.data ?? data;
}

export async function getStudyProgress(
  slugOrId: string | number,
): Promise<StudyProgress> {
  const { data } = await apiClient.get(
    `${BASE}/${slugOrId}/progress`,
  );
  return data.data ?? data;
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
// Results
// ---------------------------------------------------------------------------

export async function listStudyResults(
  slug: string,
  params?: { result_type?: string; site_id?: number; publishable_only?: boolean; page?: number; per_page?: number },
): Promise<PaginatedResponse<StudyResult>> {
  const { data } = await apiClient.get(`${BASE}/${slug}/results`, { params });
  return toLaravelPaginated<StudyResult>(data);
}

export async function getStudyResult(slug: string, resultId: number): Promise<StudyResult> {
  const { data } = await apiClient.get(`${BASE}/${slug}/results/${resultId}`);
  return data.data ?? data;
}

export async function updateStudyResult(
  slug: string,
  resultId: number,
  payload: { is_primary?: boolean; is_publishable?: boolean },
): Promise<StudyResult> {
  const { data } = await apiClient.put(`${BASE}/${slug}/results/${resultId}`, payload);
  return data.data ?? data;
}

// ---------------------------------------------------------------------------
// Synthesis
// ---------------------------------------------------------------------------

export async function listStudySyntheses(slug: string): Promise<StudySynthesis[]> {
  const { data } = await apiClient.get(`${BASE}/${slug}/synthesis`);
  return data.data ?? data;
}

export async function createStudySynthesis(
  slug: string,
  payload: {
    study_analysis_id?: number;
    synthesis_type: string;
    input_result_ids: number[];
    method_settings?: Record<string, unknown>;
  },
): Promise<StudySynthesis> {
  const { data } = await apiClient.post(`${BASE}/${slug}/synthesis`, payload);
  return data.data ?? data;
}

export async function getStudySynthesis(slug: string, synthesisId: number): Promise<StudySynthesis> {
  const { data } = await apiClient.get(`${BASE}/${slug}/synthesis/${synthesisId}`);
  return data.data ?? data;
}

export async function deleteStudySynthesis(slug: string, synthesisId: number): Promise<void> {
  await apiClient.delete(`${BASE}/${slug}/synthesis/${synthesisId}`);
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
