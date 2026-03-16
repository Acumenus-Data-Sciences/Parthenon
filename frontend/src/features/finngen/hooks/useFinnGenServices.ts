import { useQuery } from "@tanstack/react-query";
import { fetchFinnGenServices } from "../api";

export function useFinnGenServices() {
  return useQuery({
    queryKey: ["finngen-services"],
    queryFn: fetchFinnGenServices,
    staleTime: 60_000,
  });
}
