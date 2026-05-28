import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import apiClient from "@/lib/api-client";
import { toast } from "@/components/ui/Toast";
import type { AdminLibraryItemRef } from "../api/adminLibraryApi";
import { entityForAdminItemType } from "../lib/adminLibraryEntityMap";

export type AdminLifecycleAction = "promote" | "archive" | "restore";
export type AdminBulkLifecycleAction = "archive" | "restore";

interface BulkLifecycleResult {
  done: number[];
  skipped: number[];
  missing: number[];
}

const ADMIN_LIBRARY_QK = ["admin", "library"] as const;

function explain(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (err.response?.status === 403)
      return "You do not have permission for this action.";
    if (err.response?.status === 404) return "Item not found.";
    if (err.response?.status === 409)
      return "Action conflicts with current state.";
  }
  return fallback;
}

const SUCCESS_VERB: Record<AdminLifecycleAction, string> = {
  promote: "Promoted to Active",
  archive: "Archived",
  restore: "Restored to Active",
};

/**
 * Per-row lifecycle transition for a single admin-library item. Resolves the
 * item's entity slug and POSTs to the shared per-entity lifecycle endpoint.
 */
export function useAdminSingleLifecycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      action,
      item,
    }: {
      action: AdminLifecycleAction;
      item: AdminLibraryItemRef;
    }) => {
      const entity = entityForAdminItemType(item.type);
      const { data } = await apiClient.post<{ id: number; status: string }>(
        `/${entity}/${item.id}/${action}`,
      );
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ADMIN_LIBRARY_QK });
      toast.success(SUCCESS_VERB[vars.action]);
    },
    onError: (err) => toast.error(explain(err, "Lifecycle action failed")),
  });
}

/**
 * Bulk archive/restore across a heterogeneous selection. Groups the selected
 * items by entity slug, fires one bulk request per entity, then aggregates the
 * done/skipped/missing tallies into a single toast.
 */
export function useAdminBulkLifecycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      action,
      items,
    }: {
      action: AdminBulkLifecycleAction;
      items: AdminLibraryItemRef[];
    }): Promise<BulkLifecycleResult> => {
      const groups = new Map<string, number[]>();
      for (const item of items) {
        const entity = entityForAdminItemType(item.type);
        const ids = groups.get(entity) ?? [];
        ids.push(item.id);
        groups.set(entity, ids);
      }

      const endpoint = action === "archive" ? "bulk-archive" : "bulk-restore";
      const results = await Promise.all(
        Array.from(groups.entries()).map(async ([entity, ids]) => {
          const { data } = await apiClient.post<BulkLifecycleResult>(
            `/${entity}/${endpoint}`,
            { ids },
          );
          return data;
        }),
      );

      return results.reduce<BulkLifecycleResult>(
        (acc, r) => ({
          done: [...acc.done, ...r.done],
          skipped: [...acc.skipped, ...r.skipped],
          missing: [...acc.missing, ...r.missing],
        }),
        { done: [], skipped: [], missing: [] },
      );
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ADMIN_LIBRARY_QK });
      const verb = vars.action === "archive" ? "Archived" : "Restored";
      const { done, skipped, missing } = res;
      if (done.length > 0 && skipped.length === 0 && missing.length === 0) {
        toast.success(`${verb} ${done.length} item${done.length === 1 ? "" : "s"}`);
        return;
      }
      const parts: string[] = [];
      if (done.length > 0) parts.push(`${verb.toLowerCase()} ${done.length}`);
      if (skipped.length > 0)
        parts.push(`skipped ${skipped.length} (no permission)`);
      if (missing.length > 0) parts.push(`${missing.length} not found`);
      const variant = done.length > 0 ? "warning" : "error";
      toast[variant](parts.join(", ") || "No items processed");
    },
    onError: (err) => toast.error(explain(err, "Bulk lifecycle action failed")),
  });
}
