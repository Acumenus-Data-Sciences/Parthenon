import apiClient from "@/lib/api-client";
import { useQuery, useMutation } from "@tanstack/react-query";
import type {
  LookupVocabulary,
  LookupPreviewResponse,
  AqueductResultEnvelope,
} from "./types";

export async function fetchLookupVocabularies(): Promise<LookupVocabulary[]> {
  const { data } = await apiClient.get("/etl/aqueduct/lookups/vocabularies");
  return data.data?.vocabularies ?? data.vocabularies ?? [];
}

export async function fetchLookupPreview(
  vocabulary: string,
): Promise<LookupPreviewResponse> {
  const { data } = await apiClient.get(
    `/etl/aqueduct/lookups/preview/${vocabulary}`,
  );
  return data.data ?? data;
}

export async function generateLookups(params: {
  vocabularies: string[];
  include_source_to_source?: boolean;
  vocab_schema?: string;
}): Promise<AqueductResultEnvelope> {
  const { data } = await apiClient.post(
    "/etl/aqueduct/lookups/generate",
    params,
  );
  return data.data ?? data;
}

export function useLookupVocabularies() {
  return useQuery({
    queryKey: ["aqueduct", "lookups", "vocabularies"],
    queryFn: fetchLookupVocabularies,
  });
}

export function useLookupPreview(vocabulary: string | null) {
  return useQuery({
    queryKey: ["aqueduct", "lookups", "preview", vocabulary],
    queryFn: () => fetchLookupPreview(vocabulary!),
    enabled: !!vocabulary,
  });
}

export function useGenerateLookups() {
  return useMutation({
    mutationFn: generateLookups,
  });
}
