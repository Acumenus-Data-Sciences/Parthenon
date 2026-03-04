import apiClient, { toLaravelPaginated } from "@/lib/api-client";
import type {
  Study,
  StudyAnalysisEntry,
  StudyProgress,
  StudyStats,
  StudyCreatePayload,
  StudyUpdatePayload,
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
