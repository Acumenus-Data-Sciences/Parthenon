import { useQuery } from "@tanstack/react-query";
import { fetchJupyterWorkspace } from "../api";

export function useJupyterWorkspace() {
  return useQuery({
    queryKey: ["jupyter", "workspace"],
    queryFn: fetchJupyterWorkspace,
    refetchInterval: 30000,
  });
}
