// Plan 16-04 owns this hook. Plan 16-05 creates this minimal scaffold so
// RegionalView compiles while Plan 04 runs in parallel; the merger should
// prefer Plan 04's implementation.
import { useQuery } from "@tanstack/react-query";
import {
  fetchManhattanRegion,
  type ManhattanRegionPayload,
} from "../api/gwas-results";

export function useManhattanRegion(
  runId: string,
  chrom: string,
  start: number,
  end: number,
) {
  return useQuery<ManhattanRegionPayload>({
    queryKey: ["finngen", "manhattan-region", runId, chrom, start, end],
    queryFn: () => fetchManhattanRegion(runId, chrom, start, end),
    enabled: Boolean(runId) && Boolean(chrom) && end > start,
    staleTime: 60_000,
  });
}
