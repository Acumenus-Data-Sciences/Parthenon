import { useQuery } from "@tanstack/react-query";
import { fetchCommunityWorkbenchSdkDemo } from "../api";

export function useCommunityWorkbenchSdkDemo() {
  return useQuery({
    queryKey: ["community-workbench-sdk", "demo"],
    queryFn: fetchCommunityWorkbenchSdkDemo,
  });
}
