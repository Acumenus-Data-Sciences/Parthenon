// frontend/src/features/finngen-workbench/hooks/usePreviewCounts.ts
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { finngenWorkbenchApi, type PreviewCountsResponse, type PreviewCountsValidationError } from "../api";
import type { OperationNode } from "../lib/operationTree";

export type PreviewError = {
  kind: "validation" | "network" | "darkstar" | "unknown";
  message: string;
  validation?: PreviewCountsValidationError[];
  status?: number;
};

/**
 * SP4 Phase C — manual preview-counts mutation. Caller invokes mutate({tree})
 * from a "Preview" button. We surface validation errors structured (so the UI
 * can highlight bad nodes) and treat network/Darkstar failures distinctly.
 */
export function usePreviewCounts(sourceKey: string) {
  return useMutation<PreviewCountsResponse, PreviewError, { tree: OperationNode }>({
    mutationFn: async ({ tree }) => {
      try {
        const res = await finngenWorkbenchApi.previewCounts(sourceKey, tree);
        return res.data;
      } catch (e) {
        if (isAxiosError(e)) {
          const status = e.response?.status;
          if (status === 422) {
            const body = e.response?.data;
            const errors = Array.isArray(body?.errors) ? body.errors : [];
            throw {
              kind: "validation",
              message: typeof body?.message === "string" ? body.message : "Tree failed validation",
              validation: errors,
              status,
            } satisfies PreviewError;
          }
          if (status === 504) {
            throw { kind: "darkstar", message: "Preview timed out", status } satisfies PreviewError;
          }
          if (status === 502) {
            throw { kind: "darkstar", message: "Darkstar unreachable", status } satisfies PreviewError;
          }
          throw {
            kind: "network",
            message: e.message,
            status,
          } satisfies PreviewError;
        }
        throw {
          kind: "unknown",
          message: e instanceof Error ? e.message : "Unknown error",
        } satisfies PreviewError;
      }
    },
  });
}
