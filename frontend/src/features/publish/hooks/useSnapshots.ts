import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSnapshot,
  fetchSnapshots,
  revertSnapshot,
  type CreateSnapshotInput,
  type PublicationSnapshot,
} from "../api/publishApi";
import type { PublicationDraft } from "../types/publish";

const KEYS = {
  list: (draftId: number) => ["publish", "drafts", draftId, "snapshots"] as const,
};

export function useSnapshotsList(draftId: number | null) {
  return useQuery<PublicationSnapshot[]>({
    queryKey: draftId !== null ? KEYS.list(draftId) : ["publish", "snapshots", "noop"],
    queryFn: () => fetchSnapshots(draftId as number),
    enabled: draftId !== null,
  });
}

export function useCreateSnapshot(draftId: number) {
  const qc = useQueryClient();
  return useMutation<PublicationSnapshot, Error, CreateSnapshotInput>({
    mutationFn: (payload) => createSnapshot(draftId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.list(draftId) }),
  });
}

export function useRevertSnapshot(draftId: number) {
  const qc = useQueryClient();
  return useMutation<PublicationDraft, Error, number>({
    mutationFn: (snapshotId) => revertSnapshot(draftId, snapshotId),
    onSuccess: (draft) => {
      qc.invalidateQueries({ queryKey: ["publish", "drafts"] });
      qc.setQueryData(["publish", "drafts", draft.id], draft);
      qc.invalidateQueries({ queryKey: KEYS.list(draftId) });
    },
  });
}
