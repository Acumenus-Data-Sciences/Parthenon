import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { CleanupSuggestion } from "../types";

export function useCleanupSuggestions() {
  return useQuery({
    queryKey: ["library", "cleanup"],
    queryFn: async (): Promise<CleanupSuggestion[]> => {
      const { data } = await apiClient.get<{ data: CleanupSuggestion[] }>(
        "/library/cleanup",
      );
      return data.data;
    },
  });
}
