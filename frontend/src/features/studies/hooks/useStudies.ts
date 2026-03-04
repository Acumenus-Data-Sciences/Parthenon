import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StudyCreatePayload, StudyUpdatePayload } from "../types/study";
import {
  listStudies,
  getStudy,
  getStudyStats,
  createStudy,
  updateStudy,
  deleteStudy,
  listStudyAnalyses,
  addStudyAnalysis,
  removeStudyAnalysis,
  executeAllStudyAnalyses,
  getStudyProgress,
} from "../api/studyApi";

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useStudies(page?: number, search?: string) {
  return useQuery({
    queryKey: ["studies", { page, search }],
    queryFn: () => listStudies({ page, search: search || undefined }),
  });
}

export function useStudyStats() {
  return useQuery({
    queryKey: ["studies", "stats"],
    queryFn: getStudyStats,
  });
}

export function useStudy(idOrSlug: number | string | null) {
  return useQuery({
    queryKey: ["studies", idOrSlug],
    queryFn: () => getStudy(idOrSlug!),
    enabled: idOrSlug != null && idOrSlug !== "",
  });
}

export function useStudyAnalyses(studyId: number | null) {
  return useQuery({
    queryKey: ["studies", studyId, "analyses"],
    queryFn: () => listStudyAnalyses(studyId!),
    enabled: studyId != null && studyId > 0,
  });
}

export function useStudyProgress(studyId: number | null) {
  return useQuery({
    queryKey: ["studies", studyId, "progress"],
    queryFn: () => getStudyProgress(studyId!),
    enabled: studyId != null && studyId > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.overall_status;
      if (status === "running" || status === "pending") {
        return 3000;
      }
      return false;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateStudy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: StudyCreatePayload) => createStudy(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies"] });
    },
  });
}

export function useUpdateStudy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      idOrSlug,
      payload,
    }: {
      idOrSlug: number | string;
      payload: StudyUpdatePayload;
    }) => updateStudy(idOrSlug, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["studies", variables.idOrSlug],
      });
      queryClient.invalidateQueries({ queryKey: ["studies"] });
    },
  });
}

export function useDeleteStudy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (idOrSlug: number | string) => deleteStudy(idOrSlug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies"] });
    },
  });
}

export function useAddStudyAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      studyId,
      payload,
    }: {
      studyId: number;
      payload: { analysis_type: string; analysis_id: number };
    }) => addStudyAnalysis(studyId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["studies", variables.studyId, "analyses"],
      });
      queryClient.invalidateQueries({
        queryKey: ["studies", variables.studyId],
      });
    },
  });
}

export function useRemoveStudyAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      studyId,
      entryId,
    }: {
      studyId: number;
      entryId: number;
    }) => removeStudyAnalysis(studyId, entryId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["studies", variables.studyId, "analyses"],
      });
      queryClient.invalidateQueries({
        queryKey: ["studies", variables.studyId],
      });
    },
  });
}

export function useExecuteAllStudyAnalyses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      studyId,
      sourceId,
    }: {
      studyId: number;
      sourceId: number;
    }) => executeAllStudyAnalyses(studyId, sourceId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["studies", variables.studyId, "progress"],
      });
      queryClient.invalidateQueries({
        queryKey: ["studies", variables.studyId, "analyses"],
      });
      queryClient.invalidateQueries({
        queryKey: ["studies", variables.studyId],
      });
    },
  });
}
