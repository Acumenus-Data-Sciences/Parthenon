import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bulkDeleteAdminLibrary,
  listAdminLibrary,
  purgeAdminLibrary,
  reassignAdminLibrary,
  restoreAdminLibrary,
  type AdminLibraryItemRef,
  type AdminLibraryListParams,
  type AdminLibraryListResponse,
} from "../api/adminLibraryApi";

const QK = ["admin", "library"] as const;

export function useAdminLibrary(params: AdminLibraryListParams) {
  return useQuery<AdminLibraryListResponse>({
    queryKey: [...QK, "list", params],
    queryFn: () => listAdminLibrary(params),
    staleTime: 30_000,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: QK });
}

export function useBulkDeleteAdminLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: AdminLibraryItemRef[]) => bulkDeleteAdminLibrary(items),
    onSuccess: () => invalidate(qc),
  });
}

export function useReassignAdminLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      target_email,
      items,
    }: {
      target_email: string;
      items: AdminLibraryItemRef[];
    }) => reassignAdminLibrary(target_email, items),
    onSuccess: () => invalidate(qc),
  });
}

export function useRestoreAdminLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: AdminLibraryItemRef[]) => restoreAdminLibrary(items),
    onSuccess: () => invalidate(qc),
  });
}

export function usePurgeAdminLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: AdminLibraryItemRef[]) => purgeAdminLibrary(items),
    onSuccess: () => invalidate(qc),
  });
}
