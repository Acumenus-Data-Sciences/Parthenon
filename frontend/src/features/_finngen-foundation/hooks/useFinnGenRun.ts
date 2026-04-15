import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { finngenApi } from "../api";
import { FINNGEN_TERMINAL_STATUSES, type FinnGenRun } from "../types";

const POLL_FAST_MS = 3_000;
const POLL_SLOW_MS = 10_000;
const FAST_PHASE_MS = 30_000;

export type UseFinnGenRunOptions = Omit<
  UseQueryOptions<FinnGenRun, Error, FinnGenRun, readonly unknown[]>,
  "queryKey" | "queryFn" | "refetchInterval"
>;

export function useFinnGenRun(id: string | null, options?: UseFinnGenRunOptions) {
  return useQuery<FinnGenRun, Error, FinnGenRun, readonly unknown[]>({
    queryKey: ["finngen", "run", id],
    queryFn: () => finngenApi.getRun(id!),
    enabled: id !== null,
    staleTime: 0,
    refetchInterval: (query) => {
      const run = query.state.data;
      if (!run) return POLL_FAST_MS;
      if (FINNGEN_TERMINAL_STATUSES.includes(run.status)) return false;

      const startedAt = run.started_at ? new Date(run.started_at).getTime() : 0;
      const elapsed = startedAt > 0 ? Date.now() - startedAt : 0;
      return elapsed < FAST_PHASE_MS ? POLL_FAST_MS : POLL_SLOW_MS;
    },
    ...options,
  });
}
