import { useQuery, useMutation } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import type {
  StrategusModule,
  StrategusValidation,
  StrategusExecutionResult,
  AnalysisSpecification,
} from "./types";
import type { Source } from "@/types/models";

// ---------------------------------------------------------------------------
// Raw API functions
// ---------------------------------------------------------------------------

export async function fetchModules(): Promise<StrategusModule[]> {
  const { data } = await apiClient.get<
    | { data: { modules: StrategusModule[] } }
    | { data: StrategusModule[] }
    | StrategusModule[]
  >("/strategus/modules");
  // Handle: {data: {modules: [...]}} | {data: [...]} | bare [...]
  if (Array.isArray(data)) return data;
  const inner = (data as Record<string, unknown>).data ?? data;
  if (Array.isArray(inner)) return inner;
  if (inner && typeof inner === "object" && "modules" in inner) {
    return (inner as { modules: StrategusModule[] }).modules ?? [];
  }
  return [];
}

export async function validateSpec(
  spec: AnalysisSpecification,
): Promise<StrategusValidation> {
  const { data } = await apiClient.post<{ data: StrategusValidation } | StrategusValidation>(
    "/strategus/validate",
    { analysis_spec: spec },
  );
  if ("validation" in data) return data as StrategusValidation;
  return (data as { data: StrategusValidation }).data;
}

export async function executeStudy(
  sourceId: number,
  studyName: string,
  spec: AnalysisSpecification,
): Promise<StrategusExecutionResult> {
  const { data } = await apiClient.post<
    { data: StrategusExecutionResult } | StrategusExecutionResult
  >("/strategus/execute", {
    source_id: sourceId,
    study_name: studyName,
    analysis_spec: spec,
  });
  if ("status" in data) return data as StrategusExecutionResult;
  return (data as { data: StrategusExecutionResult }).data;
}

// Re-export fetchSources so callers only need to import from this module
export { fetchSources };

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useStrategusModules() {
  return useQuery<StrategusModule[]>({
    queryKey: ["strategus", "modules"],
    queryFn: fetchModules,
    staleTime: 5 * 60 * 1000, // 5 minutes — module list rarely changes
  });
}

export function useStrategusValidate() {
  return useMutation<StrategusValidation, Error, AnalysisSpecification>({
    mutationFn: validateSpec,
  });
}

export function useStrategusExecute() {
  return useMutation<
    StrategusExecutionResult,
    Error,
    { sourceId: number; studyName: string; spec: AnalysisSpecification }
  >({
    mutationFn: ({ sourceId, studyName, spec }) =>
      executeStudy(sourceId, studyName, spec),
  });
}

export function useStrateagusSources() {
  return useQuery<Source[]>({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });
}
