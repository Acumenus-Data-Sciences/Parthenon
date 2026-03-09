import { useQuery } from "@tanstack/react-query";
import { fetchAllAnalyses } from "../api/publishApi";

export function useAllAnalyses() {
  return useQuery({
    queryKey: ["publish", "all-analyses"],
    queryFn: fetchAllAnalyses,
    staleTime: 5 * 60 * 1000,
  });
}
