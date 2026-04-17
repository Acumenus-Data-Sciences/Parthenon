// frontend/src/features/finngen-workbench/hooks/useWorkbenchSession.ts
import { useEffect, useRef, useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { finngenWorkbenchApi } from "../api";
import type {
  CreateWorkbenchSessionPayload,
  UpdateWorkbenchSessionPayload,
  WorkbenchSession,
  WorkbenchSessionStateV1,
} from "../types";

const KEY = (id: string | null) => ["finngen", "workbench", "session", id] as const;
const LIST_KEY = (sourceKey?: string) =>
  ["finngen", "workbench", "sessions", sourceKey ?? "all"] as const;

export function useWorkbenchSessions(sourceKey?: string) {
  return useQuery<WorkbenchSession[]>({
    queryKey: LIST_KEY(sourceKey),
    queryFn: async () => {
      const res = await finngenWorkbenchApi.list(sourceKey);
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function useWorkbenchSession(id: string | null) {
  return useQuery<WorkbenchSession>({
    queryKey: KEY(id),
    queryFn: async () => {
      const res = await finngenWorkbenchApi.get(id!);
      return res.data;
    },
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function useCreateWorkbenchSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorkbenchSessionPayload) =>
      finngenWorkbenchApi.create(payload).then((r) => r.data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["finngen", "workbench", "sessions"] });
      qc.setQueryData(KEY(created.id), created);
    },
  });
}

export function useDeleteWorkbenchSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => finngenWorkbenchApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finngen", "workbench", "sessions"] });
    },
  });
}

export type AutosaveStatus = {
  /** Mutation currently firing (POST in flight). */
  saving: boolean;
  /** Local state has diverged from lastSent AND the debounce timer is ticking. */
  pending: boolean;
  /** Last successful save timestamp — null before the first save. */
  lastSavedAt: Date | null;
  /** Most recent mutation error, if any. Reset on the next successful save. */
  error: Error | null;
};

/**
 * Debounced autosave for an in-flight session. Pass the local session_state
 * (typically from the Zustand store); after `delayMs` of quiescence the patch
 * is sent. Cancels in-flight timers on rerender so rapid edits coalesce into
 * a single PATCH per quiet window.
 *
 * Returns the mutation object AND a structured AutosaveStatus so a header
 * badge can render "Saving…" / "Saved HH:MM" / "Unsaved" / error states.
 */
export function useAutosaveWorkbenchSession(
  id: string | null,
  sessionState: WorkbenchSessionStateV1 | null,
  delayMs = 5_000,
): AutosaveStatus & {
  mutation: UseMutationResult<WorkbenchSession, Error, UpdateWorkbenchSessionPayload>;
} {
  const qc = useQueryClient();
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: UpdateWorkbenchSessionPayload) =>
      finngenWorkbenchApi.update(id!, payload).then((r) => r.data),
    onSuccess: (updated) => {
      qc.setQueryData(KEY(updated.id), updated);
      setLastSavedAt(new Date());
      setError(null);
      setPending(false);
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error(String(err)));
      setPending(false);
    },
  });

  const timerRef = useRef<number | null>(null);
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    if (id === null || sessionState === null) return;
    const serialized = JSON.stringify(sessionState);
    // Skip if the state hasn't changed since the last send.
    if (lastSentRef.current === serialized) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    setPending(true);
    timerRef.current = window.setTimeout(() => {
      lastSentRef.current = serialized;
      mutation.mutate({ session_state: sessionState });
    }, delayMs);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
    // mutation reference changes per render via useMutation; depending on it
    // would force a save on every render. Intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sessionState, delayMs]);

  return {
    saving: mutation.isPending,
    pending,
    lastSavedAt,
    error,
    mutation,
  };
}
