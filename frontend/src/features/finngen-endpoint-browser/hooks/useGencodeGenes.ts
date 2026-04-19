// Phase 16 (Plan 16-04) — TanStack Query hook for GENCODE v46 gene annotations
// within a chromosomal window. Backing endpoint caches Redis for 7 days per
// D-20 (static reference data — gene boundaries don't move), so the hook mirrors
// that aggressively.
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchGencodeGenes, type GencodePayload } from "../api/gwas-results";

const GENCODE_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — matches server Redis TTL
const NON_RETRYABLE_STATUSES = new Set([400, 403, 404, 409, 422]);

interface AxiosErrorLike {
  response?: { status?: number };
}

function statusOf(error: unknown): number | undefined {
  return (error as AxiosErrorLike).response?.status;
}

export interface UseGencodeGenesArgs {
  chrom: string | null;
  start: number | null;
  end: number | null;
  includePseudogenes?: boolean;
}

export function useGencodeGenes(
  args: UseGencodeGenesArgs,
): UseQueryResult<GencodePayload, Error> {
  const { chrom, start, end, includePseudogenes = false } = args;
  return useQuery<GencodePayload, Error>({
    queryKey: [
      "gencode",
      "genes",
      chrom,
      start,
      end,
      includePseudogenes,
    ],
    queryFn: () => {
      if (!chrom || start == null || end == null) {
        throw new Error("Gencode query requires chrom/start/end");
      }
      return fetchGencodeGenes(chrom, start, end, includePseudogenes);
    },
    enabled: Boolean(chrom) && start != null && end != null,
    staleTime: GENCODE_STALE_MS,
    retry: (failureCount, error) => {
      const status = statusOf(error);
      if (status !== undefined && NON_RETRYABLE_STATUSES.has(status)) {
        return false;
      }
      return failureCount < 3;
    },
  });
}
