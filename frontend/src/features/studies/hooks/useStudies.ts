import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  StudyCreatePayload,
  StudyUpdatePayload,
  StudySite,
  StudyTeamMember,
  StudyCohort,
  StudyMilestone,
  StudyArtifact,
} from "../types/study";
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
  transitionStudy,
  getAllowedTransitions,
  listStudySites,
  createStudySite,
  updateStudySite,
  deleteStudySite,
  listStudyTeam,
  addStudyTeamMember,
  updateStudyTeamMember,
  removeStudyTeamMember,
  listStudyCohorts,
  addStudyCohort,
  updateStudyCohort,
  removeStudyCohort,
  listStudyMilestones,
  createStudyMilestone,
  updateStudyMilestone,
  deleteStudyMilestone,
  listStudyArtifacts,
  createStudyArtifact,
  updateStudyArtifact,
  deleteStudyArtifact,
  listStudyActivity,
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

// ---------------------------------------------------------------------------
// Status Transitions
// ---------------------------------------------------------------------------

export function useAllowedTransitions(slug: string | null) {
  return useQuery({
    queryKey: ["studies", slug, "transitions"],
    queryFn: () => getAllowedTransitions(slug!),
    enabled: slug != null && slug !== "",
  });
}

export function useTransitionStudy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slug, status }: { slug: string; status: string }) =>
      transitionStudy(slug, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["studies", variables.slug] });
      queryClient.invalidateQueries({ queryKey: ["studies"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

export function useStudySites(slug: string | null) {
  return useQuery({
    queryKey: ["studies", slug, "sites"],
    queryFn: () => listStudySites(slug!),
    enabled: slug != null && slug !== "",
  });
}

export function useCreateStudySite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, payload }: { slug: string; payload: Partial<StudySite> }) =>
      createStudySite(slug, payload),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["studies", v.slug, "sites"] });
    },
  });
}

export function useUpdateStudySite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, siteId, payload }: { slug: string; siteId: number; payload: Partial<StudySite> }) =>
      updateStudySite(slug, siteId, payload),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["studies", v.slug, "sites"] });
    },
  });
}

export function useDeleteStudySite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, siteId }: { slug: string; siteId: number }) =>
      deleteStudySite(slug, siteId),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["studies", v.slug, "sites"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Team Members
// ---------------------------------------------------------------------------

export function useStudyTeam(slug: string | null) {
  return useQuery({
    queryKey: ["studies", slug, "team"],
    queryFn: () => listStudyTeam(slug!),
    enabled: slug != null && slug !== "",
  });
}

export function useAddStudyTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, payload }: { slug: string; payload: { user_id: number; role: string; site_id?: number } }) =>
      addStudyTeamMember(slug, payload),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["studies", v.slug, "team"] });
    },
  });
}

export function useUpdateStudyTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, memberId, payload }: { slug: string; memberId: number; payload: Partial<StudyTeamMember> }) =>
      updateStudyTeamMember(slug, memberId, payload),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["studies", v.slug, "team"] });
    },
  });
}

export function useRemoveStudyTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, memberId }: { slug: string; memberId: number }) =>
      removeStudyTeamMember(slug, memberId),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["studies", v.slug, "team"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Cohorts
// ---------------------------------------------------------------------------

export function useStudyCohorts(slug: string | null) {
  return useQuery({
    queryKey: ["studies", slug, "cohorts"],
    queryFn: () => listStudyCohorts(slug!),
    enabled: slug != null && slug !== "",
  });
}

export function useAddStudyCohort() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, payload }: { slug: string; payload: Partial<StudyCohort> }) =>
      addStudyCohort(slug, payload),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["studies", v.slug, "cohorts"] });
    },
  });
}

export function useUpdateStudyCohort() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, cohortId, payload }: { slug: string; cohortId: number; payload: Partial<StudyCohort> }) =>
      updateStudyCohort(slug, cohortId, payload),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["studies", v.slug, "cohorts"] });
    },
  });
}

export function useRemoveStudyCohort() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, cohortId }: { slug: string; cohortId: number }) =>
      removeStudyCohort(slug, cohortId),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["studies", v.slug, "cohorts"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export function useStudyMilestones(slug: string | null) {
  return useQuery({
    queryKey: ["studies", slug, "milestones"],
    queryFn: () => listStudyMilestones(slug!),
    enabled: slug != null && slug !== "",
  });
}

export function useCreateStudyMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, payload }: { slug: string; payload: Partial<StudyMilestone> }) =>
      createStudyMilestone(slug, payload),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["studies", v.slug, "milestones"] });
    },
  });
}

export function useUpdateStudyMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, milestoneId, payload }: { slug: string; milestoneId: number; payload: Partial<StudyMilestone> }) =>
      updateStudyMilestone(slug, milestoneId, payload),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["studies", v.slug, "milestones"] });
    },
  });
}

export function useDeleteStudyMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, milestoneId }: { slug: string; milestoneId: number }) =>
      deleteStudyMilestone(slug, milestoneId),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["studies", v.slug, "milestones"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export function useStudyArtifacts(slug: string | null) {
  return useQuery({
    queryKey: ["studies", slug, "artifacts"],
    queryFn: () => listStudyArtifacts(slug!),
    enabled: slug != null && slug !== "",
  });
}

export function useCreateStudyArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, payload }: { slug: string; payload: Partial<StudyArtifact> }) =>
      createStudyArtifact(slug, payload),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["studies", v.slug, "artifacts"] });
    },
  });
}

export function useUpdateStudyArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, artifactId, payload }: { slug: string; artifactId: number; payload: Partial<StudyArtifact> }) =>
      updateStudyArtifact(slug, artifactId, payload),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["studies", v.slug, "artifacts"] });
    },
  });
}

export function useDeleteStudyArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, artifactId }: { slug: string; artifactId: number }) =>
      deleteStudyArtifact(slug, artifactId),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["studies", v.slug, "artifacts"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------

export function useStudyActivity(slug: string | null, page?: number) {
  return useQuery({
    queryKey: ["studies", slug, "activity", { page }],
    queryFn: () => listStudyActivity(slug!, { page }),
    enabled: slug != null && slug !== "",
  });
}
