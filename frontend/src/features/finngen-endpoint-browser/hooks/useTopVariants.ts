// Phase 16 (Plan 16-04) — TanStack Query hook for the top-N sortable variants
// table. Sort column + direction + limit participate in the queryKey so each
// column-click caches independently (mirroring TanStack Table's sort state).
//
// Cache: 15-minute staleTime matches the server Redis TTL for this endpoint
// (D-20); total cap of 200 rows matches the FormRequest limit from Plan 16-03.
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  fetchTopVariants,
  type SortDirection,
  type TopVariantsPayload,
  type TopVariantsSortColumn,
} from "../api/gwas-results";

const TOP_VARIANTS_STALE_MS = 15 * 60 * 1000;
const NON_RETRYABLE_STATUSES = new Set([400, 403, 404, 409, 410, 422]);

/** Matches Plan 16-03 TopVariantsQueryRequest default. */
export const DEFAULT_TOP_VARIANTS_LIMIT = 50;

interface AxiosErrorLike {
  response?: { status?: number };
}

function statusOf(error: unknown): number | undefined {
  return (error as AxiosErrorLike).response?.status;
}

export interface UseTopVariantsArgs {
  runId: string;
  sort?: TopVariantsSortColumn;
  dir?: SortDirection;
  limit?: number;
}

export function useTopVariants(
  args: UseTopVariantsArgs,
): UseQueryResult<TopVariantsPayload, Error> {
  const {
    runId,
    sort = "p_value",
    dir = "asc",
    limit = DEFAULT_TOP_VARIANTS_LIMIT,
  } = args;
  return useQuery<TopVariantsPayload, Error>({
    queryKey: ["finngen", "top-variants", runId, sort, dir, limit],
    queryFn: () => fetchTopVariants(runId, sort, dir, limit),
    enabled: Boolean(runId),
    staleTime: TOP_VARIANTS_STALE_MS,
    retry: (failureCount, error) => {
      const status = statusOf(error);
      if (status !== undefined && NON_RETRYABLE_STATUSES.has(status)) {
        return false;
      }
      return failureCount < 3;
    },
  });
}
