// Phase 16 (Plan 16-04) — TanStack Query hook for the full-resolution regional
// window (±500 kb around a peak per ROADMAP SC-2). Enabled only when the user
// clicks a peak on the Manhattan plot and provides a chrom/start/end triple.
//
// Cache: 15-minute staleTime — region windows are deterministic per run but
// server re-computes cheaply; no need for long TTL. queryKey scoped by all
// four positional args so zoom/pan operations cache independently.
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  fetchManhattanRegion,
  type ManhattanRegionPayload,
} from "../api/gwas-results";

const REGION_STALE_MS = 15 * 60 * 1000;
const NON_RETRYABLE_STATUSES = new Set([400, 403, 404, 409, 410, 422]);

interface AxiosErrorLike {
  response?: { status?: number };
}

function statusOf(error: unknown): number | undefined {
  return (error as AxiosErrorLike).response?.status;
}

export interface UseManhattanRegionArgs {
  runId: string;
  chrom: string | null;
  start: number | null;
  end: number | null;
}

export function useManhattanRegion(
  args: UseManhattanRegionArgs,
): UseQueryResult<ManhattanRegionPayload, Error> {
  const { runId, chrom, start, end } = args;
  return useQuery<ManhattanRegionPayload, Error>({
    queryKey: ["finngen", "manhattan", "region", runId, chrom, start, end],
    queryFn: () => {
      if (!chrom || start == null || end == null) {
        // React Query's `enabled: false` prevents this branch; thrown error
        // is a guard in case the query is manually refetched.
        throw new Error("Region query requires chrom/start/end");
      }
      return fetchManhattanRegion(runId, chrom, start, end);
    },
    enabled: Boolean(runId) && Boolean(chrom) && start != null && end != null,
    staleTime: REGION_STALE_MS,
    retry: (failureCount, error) => {
      const status = statusOf(error);
      if (status !== undefined && NON_RETRYABLE_STATUSES.has(status)) {
        return false;
      }
      return failureCount < 3;
    },
  });
}
