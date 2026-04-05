import { useQuery } from "@tanstack/react-query";
import { fetchClinicalGroupings } from "../api/vocabularyApi";

export function useClinicalGroupings(domainId: string | null) {
  return useQuery({
    queryKey: ["vocabulary", "groupings", domainId],
    queryFn: () => fetchClinicalGroupings(domainId!),
    enabled: !!domainId,
  });
}
