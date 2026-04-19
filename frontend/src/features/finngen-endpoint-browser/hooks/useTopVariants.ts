// Plan 16-04 owns this hook. Plan 16-05 creates this minimal scaffold so
// FinnGenGwasResultsPage compiles while Plan 04 runs in parallel; the merger
// should prefer Plan 04's implementation.
import { useQuery } from "@tanstack/react-query";
import {
  fetchTopVariants,
  type TopVariantsPayload,
} from "../api/gwas-results";

export function useTopVariants(
  runId: string,
  sort: string,
  dir: "asc" | "desc",
  limit: number,
) {
  return useQuery<TopVariantsPayload>({
    queryKey: ["finngen", "top-variants", runId, sort, dir, limit],
    queryFn: () => fetchTopVariants(runId, sort, dir, limit),
    enabled: Boolean(runId),
    staleTime: 15 * 60_000,
  });
}
