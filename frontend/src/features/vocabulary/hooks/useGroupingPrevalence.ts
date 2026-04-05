import { useQuery } from "@tanstack/react-query";
import { fetchGroupingPrevalence } from "../api/vocabularyApi";

export function useGroupingPrevalence(domainId: string | null, sourceId?: number | null) {
  return useQuery({
    queryKey: ["vocabulary", "groupings", "prevalence", domainId, sourceId],
    queryFn: () => fetchGroupingPrevalence(domainId!, sourceId),
    enabled: !!domainId,
    staleTime: 1000 * 60 * 60,
  });
}
