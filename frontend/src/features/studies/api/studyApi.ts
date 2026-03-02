import apiClient from "@/lib/api-client";
import type {
  Study,
  StudyAnalysisEntry,
  StudyProgress,
} from "../types/study";
import type { PaginatedResponse } from "@/features/analyses/types/analysis";

const BASE = "/studies";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listStudies(params?: {
  page?: number;
}): Promise<PaginatedResponse<Study>> {
  const { data } = await apiClient.get<PaginatedResponse<Study>>(BASE, {
    params,
  });
  return data;
}

export async function getStudy(id: number): Promise<Study> {
  const { data } = await apiClient.get<Study>(`${BASE}/${id}`);
  return data;
}

export async function createStudy(payload: {
  name: string;
  description?: string;
  study_type: string;
  metadata?: Record<string, unknown>;
}): Promise<Study> {
  const { data } = await apiClient.post<Study>(BASE, payload);
  return data;
}

export async function updateStudy(
  id: number,
  payload: Partial<{
    name: string;
    description: string;
    study_type: string;
    metadata: Record<string, unknown>;
  }>,
): Promise<Study> {
  const { data } = await apiClient.put<Study>(`${BASE}/${id}`, payload);
  return data;
}

export async function deleteStudy(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
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
  const { data } = await apiClient.post<StudyAnalysisEntry>(
    `${BASE}/${studyId}/analyses`,
    payload,
  );
  return data;
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
    `${BASE}/${studyId}/execute-all`,
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
