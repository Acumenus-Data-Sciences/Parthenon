import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createPublicationDraft,
  deletePublicationDraft,
  fetchPublicationDraft,
  fetchPublicationDrafts,
  updatePublicationDraft,
} from "../api/publishApi";
import type {
  PublicationDraft,
  PublicationDraftInput,
} from "../types/publish";

const KEYS = {
  list: ["publish", "drafts"] as const,
  detail: (id: number) => ["publish", "drafts", id] as const,
};

export function useDraftList() {
  return useQuery<PublicationDraft[]>({
    queryKey: KEYS.list,
    queryFn: fetchPublicationDrafts,
  });
}

export function useDraft(draftId: number | null) {
  return useQuery<PublicationDraft>({
    queryKey: draftId !== null ? KEYS.detail(draftId) : ["publish", "drafts", "noop"],
    queryFn: () => fetchPublicationDraft(draftId as number),
    enabled: draftId !== null,
  });
}

export function useCreateDraft() {
  const qc = useQueryClient();
  return useMutation<PublicationDraft, Error, PublicationDraftInput>({
    mutationFn: createPublicationDraft,
    onSuccess: (draft) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.setQueryData(KEYS.detail(draft.id), draft);
    },
  });
}

export function useUpdateDraft(draftId: number) {
  const qc = useQueryClient();
  return useMutation<PublicationDraft, Error, Partial<PublicationDraftInput>>({
    mutationFn: (payload) => updatePublicationDraft(draftId, payload),
    onSuccess: (draft) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.setQueryData(KEYS.detail(draft.id), draft);
    },
  });
}

export function useUpdateDraftById() {
  const qc = useQueryClient();
  return useMutation<
    PublicationDraft,
    Error,
    { id: number; payload: Partial<PublicationDraftInput> }
  >({
    mutationFn: ({ id, payload }) => updatePublicationDraft(id, payload),
    onSuccess: (draft) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.setQueryData(KEYS.detail(draft.id), draft);
    },
  });
}

export function useDeleteDraft() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: deletePublicationDraft,
    onSuccess: (_void, id) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.removeQueries({ queryKey: KEYS.detail(id) });
    },
  });
}
