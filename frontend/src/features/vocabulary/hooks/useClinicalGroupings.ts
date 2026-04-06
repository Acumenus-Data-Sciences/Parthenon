import { useQuery } from "@tanstack/react-query";
import { fetchClinicalGroupings } from "../api/vocabularyApi";

export function useClinicalGroupings(domainId: string | null, includeChildren: boolean = false) {
  return useQuery({
    queryKey: ["vocabulary", "groupings", domainId, includeChildren],
    queryFn: () => fetchClinicalGroupings(domainId!, includeChildren),
    enabled: !!domainId,
  });
}
