// Phase 16 (Plan 16-04) — TanStack Query hook for the thinned Manhattan
// payload. Handles the 202 in-flight envelope by polling every 30s
// (matches server Retry-After per RESEARCH Pitfall 3), and short-circuits
// retry on terminal error statuses (404/410/409/403/422).
//
// Cache: 24h staleTime matches the server Redis TTL (D-20). queryKey is
// scoped by runId+binCount so different bin counts are cached independently.
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  fetchManhattan,
  type ManhattanInFlightResponse,
  type ManhattanPayload,
  type ManhattanResponse,
} from "../api/gwas-results";

/** Default bin count — matches backend D-02 default (100 bins × 24 chroms ≈ 2400 anchors). */
export const DEFAULT_MANHATTAN_BIN_COUNT = 100;

const IN_FLIGHT_POLL_MS = 30_000;
const NON_RETRYABLE_STATUSES = new Set([403, 404, 409, 410, 422]);

interface AxiosErrorLike {
  response?: { status?: number };
}

function statusOf(error: unknown): number | undefined {
  return (error as AxiosErrorLike).response?.status;
}

export function isManhattanInFlight(
  data: ManhattanResponse | undefined,
): data is ManhattanInFlightResponse {
  return data !== undefined && "status" in data;
}

export function isManhattanReady(
  data: ManhattanResponse | undefined,
): data is ManhattanPayload {
  return data !== undefined && !("status" in data);
}

export function useManhattanData(
  runId: string,
  binCount: number = DEFAULT_MANHATTAN_BIN_COUNT,
): UseQueryResult<ManhattanResponse, Error> {
  return useQuery<ManhattanResponse, Error>({
    queryKey: ["finngen", "manhattan", runId, binCount],
    queryFn: () => fetchManhattan(runId, binCount),
    enabled: Boolean(runId),
    staleTime: 24 * 60 * 60 * 1000, // 24h — matches server Redis TTL (D-20)
    retry: (failureCount, error) => {
      const status = statusOf(error);
      if (status !== undefined && NON_RETRYABLE_STATUSES.has(status)) {
        return false;
      }
      return failureCount < 3;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return isManhattanInFlight(data) ? IN_FLIGHT_POLL_MS : false;
    },
  });
}
