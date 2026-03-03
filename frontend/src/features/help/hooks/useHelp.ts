import { useQuery } from "@tanstack/react-query";
import { getHelp, getChangelog } from "../api/helpApi";

export function useHelp(key: string | null) {
  return useQuery({
    queryKey: ["help", key],
    queryFn: () => getHelp(key!),
    enabled: !!key,
    staleTime: Infinity,
  });
}

export function useChangelog() {
  return useQuery({
    queryKey: ["changelog"],
    queryFn: getChangelog,
    staleTime: Infinity,
  });
}
