import { useQuery } from "@tanstack/react-query";
import { codeExplorerApi } from "../api";

export function useMyReports() {
  return useQuery({
    queryKey: ["finngen", "code-explorer", "my-reports"],
    queryFn: () => codeExplorerApi.myReports(),
    staleTime: 10_000,
  });
}
