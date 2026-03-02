import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listStudies,
  getStudy,
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

export function useStudies(page?: number) {
  return useQuery({
    queryKey: ["studies", { page }],
    queryFn: () => listStudies({ page }),
  });
}

export function useStudy(id: number | null) {
  return useQuery({
    queryKey: ["studies", id],
    queryFn: () => getStudy(id!),
    enabled: id != null && id > 0,
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
    mutationFn: (payload: {
      name: string;
      description?: string;
      study_type: string;
      metadata?: Record<string, unknown>;
    }) => createStudy(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies"] });
    },
  });
}

export function useUpdateStudy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<{
        name: string;
        description: string;
        study_type: string;
        metadata: Record<string, unknown>;
      }>;
    }) => updateStudy(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["studies", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["studies"] });
    },
  });
}

export function useDeleteStudy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteStudy(id),
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
