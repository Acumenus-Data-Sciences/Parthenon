import { useMutation } from "@tanstack/react-query";
import { generateNarrative, type NarrativeRequest } from "../api/publishApi";

export function useGenerateNarrative() {
  return useMutation({
    mutationFn: (req: NarrativeRequest) => generateNarrative(req),
  });
}
