import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useSourceStore } from "@/stores/sourceStore";

/**
 * TanStack Query wrapper that automatically includes the active sourceId
 * in the query key and guards on valid source selection.
 *
 * When activeSourceId changes, all useSourceQuery hooks refetch automatically
 * because the key changes.
 */
export function useSourceQuery<T>(
  key: string[],
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error, T, (string | number | null)[]>, "queryKey" | "queryFn">,
) {
  const sourceId = useSourceStore((s) => s.activeSourceId);

  return useQuery({
    queryKey: [...key, sourceId],
    queryFn,
    enabled: (sourceId ?? 0) > 0 && (options?.enabled ?? true),
    ...options,
  });
}
