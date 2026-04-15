import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { finngenApi } from "../api";

const DEFAULT_STALE_MS = 60_000;

export type UseFinnGenSyncReadOptions<T> = Omit<
  UseQueryOptions<T, Error, T, readonly unknown[]>,
  "queryKey" | "queryFn"
> & {
  refresh?: boolean;
};

export function useFinnGenSyncRead<T = unknown>(
  path: string,
  params: Record<string, unknown>,
  options?: UseFinnGenSyncReadOptions<T>,
) {
  const { refresh, staleTime, ...rest } = options ?? {};
  return useQuery<T, Error, T, readonly unknown[]>({
    queryKey: ["finngen", "sync", path, params, refresh ?? false],
    queryFn: () => finngenApi.syncRead<T>(path, params, { refresh }),
    staleTime: staleTime ?? DEFAULT_STALE_MS,
    ...rest,
  });
}
