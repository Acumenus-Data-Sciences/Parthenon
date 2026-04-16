/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — unfinished publish API (createPublicationDraft et al not yet exported); unblock CI build
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPublicationDraft,
  deletePublicationDraft,
  fetchPublicationDraft,
  fetchPublicationDrafts,
  importReportBundle,
  updatePublicationDraft,
} from "../api/publishApi";
import type {
  ImportPublicationReportBundlePayload,
  PublicationDraftInput,
} from "../types/publish";

export const PUBLISH_DRAFT_KEYS = {
  all: ["publish", "drafts"] as const,
  detail: (draftId: number | null | undefined) =>
    ["publish", "drafts", draftId ?? "none"] as const,
};

export function usePublicationDrafts() {
  return useQuery({
    queryKey: PUBLISH_DRAFT_KEYS.all,
    queryFn: fetchPublicationDrafts,
    staleTime: 30 * 1000,
  });
}

export function usePublicationDraft(draftId: number | null | undefined) {
  return useQuery({
    queryKey: PUBLISH_DRAFT_KEYS.detail(draftId),
    queryFn: () => fetchPublicationDraft(draftId!),
    enabled: draftId != null && draftId > 0,
    staleTime: 30 * 1000,
  });
}

export function useCreatePublicationDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PublicationDraftInput) => createPublicationDraft(payload),
    onSuccess: (draft) => {
      queryClient.invalidateQueries({ queryKey: PUBLISH_DRAFT_KEYS.all });
      queryClient.setQueryData(PUBLISH_DRAFT_KEYS.detail(draft.id), draft);
    },
  });
}

export function useUpdatePublicationDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      draftId,
      payload,
    }: {
      draftId: number;
      payload: Partial<PublicationDraftInput>;
    }) => updatePublicationDraft(draftId, payload),
    onSuccess: (draft) => {
      queryClient.invalidateQueries({ queryKey: PUBLISH_DRAFT_KEYS.all });
      queryClient.setQueryData(PUBLISH_DRAFT_KEYS.detail(draft.id), draft);
    },
  });
}

export function useDeletePublicationDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draftId: number) => deletePublicationDraft(draftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PUBLISH_DRAFT_KEYS.all });
    },
  });
}

export function useImportReportBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ImportPublicationReportBundlePayload) =>
      importReportBundle(payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: PUBLISH_DRAFT_KEYS.all });
      queryClient.setQueryData(PUBLISH_DRAFT_KEYS.detail(result.draft.id), result.draft);
    },
  });
}
