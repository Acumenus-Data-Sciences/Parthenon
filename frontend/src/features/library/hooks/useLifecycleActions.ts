import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import apiClient from "@/lib/api-client";
import { toast } from "@/components/ui/Toast";
import type {
  BulkLifecycleResponse,
  LibraryEntity,
  LifecycleResponse,
} from "../types";

function explain(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (err.response?.status === 403) return "You do not have permission for this action.";
    if (err.response?.status === 404) return "Item not found.";
    if (err.response?.status === 409) return "Action conflicts with current state.";
  }
  return fallback;
}

/**
 * Toast-aware lifecycle mutations for a single library entity. Wraps the
 * existing API hooks and invalidates the entity's query cache on success.
 */
export function useLifecycleMutations(entity: LibraryEntity) {
  const qc = useQueryClient();

  function invalidate() {
    qc.invalidateQueries({ queryKey: [entity] });
    // Some lists key off a different shape (e.g. ["cohort-definitions", ...])
    // — invalidating the bare entity key is enough since TanStack matches by prefix.
    qc.invalidateQueries({ queryKey: ["admin", "library"] });
  }

  const promote = useMutation({
    mutationFn: async (id: number): Promise<LifecycleResponse> => {
      const { data } = await apiClient.post<LifecycleResponse>(
        `/${entity}/${id}/promote`,
      );
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Promoted to Active");
    },
    onError: (err) => toast.error(explain(err, "Failed to promote item")),
  });

  const archive = useMutation({
    mutationFn: async (id: number): Promise<LifecycleResponse> => {
      const { data } = await apiClient.post<LifecycleResponse>(
        `/${entity}/${id}/archive`,
      );
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Archived");
    },
    onError: (err) => toast.error(explain(err, "Failed to archive item")),
  });

  const restore = useMutation({
    mutationFn: async (id: number): Promise<LifecycleResponse> => {
      const { data } = await apiClient.post<LifecycleResponse>(
        `/${entity}/${id}/restore`,
      );
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Restored to Active");
    },
    onError: (err) => toast.error(explain(err, "Failed to restore item")),
  });

  return { promote, archive, restore };
}

/**
 * Bulk archive + restore mutations. The backend returns done/skipped/missing
 * arrays so we surface a precise toast.
 */
export function useBulkLifecycleMutations(entity: LibraryEntity) {
  const qc = useQueryClient();

  function invalidate() {
    qc.invalidateQueries({ queryKey: [entity] });
    qc.invalidateQueries({ queryKey: ["admin", "library"] });
  }

  function summarise(res: BulkLifecycleResponse, verb: string) {
    const { done, skipped, missing } = res;
    if (done.length > 0 && skipped.length === 0 && missing.length === 0) {
      toast.success(`${verb} ${done.length} item${done.length === 1 ? "" : "s"}`);
      return;
    }
    const parts: string[] = [];
    if (done.length > 0) parts.push(`${verb.toLowerCase()} ${done.length}`);
    if (skipped.length > 0) parts.push(`skipped ${skipped.length} (no permission)`);
    if (missing.length > 0) parts.push(`${missing.length} not found`);
    const variant = done.length > 0 ? "warning" : "error";
    toast[variant](parts.join(", "));
  }

  const bulkArchive = useMutation({
    mutationFn: async (ids: number[]): Promise<BulkLifecycleResponse> => {
      const { data } = await apiClient.post<BulkLifecycleResponse>(
        `/${entity}/bulk-archive`,
        { ids },
      );
      return data;
    },
    onSuccess: (res) => {
      invalidate();
      summarise(res, "Archived");
    },
    onError: (err) => toast.error(explain(err, "Bulk archive failed")),
  });

  const bulkRestore = useMutation({
    mutationFn: async (ids: number[]): Promise<BulkLifecycleResponse> => {
      const { data } = await apiClient.post<BulkLifecycleResponse>(
        `/${entity}/bulk-restore`,
        { ids },
      );
      return data;
    },
    onSuccess: (res) => {
      invalidate();
      summarise(res, "Restored");
    },
    onError: (err) => toast.error(explain(err, "Bulk restore failed")),
  });

  return { bulkArchive, bulkRestore };
}
