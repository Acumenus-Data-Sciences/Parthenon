// Plan 16-04 owns this hook. Plan 16-05 creates this minimal scaffold so
// RegionalView compiles while Plan 04 runs in parallel; the merger should
// prefer Plan 04's implementation.
import { useQuery } from "@tanstack/react-query";
import {
  fetchGencodeGenes,
  type GencodePayload,
} from "../api/gwas-results";

export function useGencodeGenes(
  chrom: string,
  start: number,
  end: number,
  includePseudogenes = false,
) {
  return useQuery<GencodePayload>({
    queryKey: [
      "gencode",
      "genes",
      chrom,
      start,
      end,
      includePseudogenes ? 1 : 0,
    ],
    queryFn: () => fetchGencodeGenes(chrom, start, end, includePseudogenes),
    enabled: Boolean(chrom) && end > start,
    staleTime: 7 * 24 * 60 * 60 * 1000,
  });
}
