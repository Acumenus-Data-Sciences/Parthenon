// Plan 16-04 owns this hook. Plan 16-05 creates this minimal scaffold so the
// FinnGenGwasResultsPage composition compiles while Plan 04 runs in parallel;
// the merger should prefer Plan 04's richer implementation (adds in-flight
// polling + retry skip on 4xx).
import { useQuery } from "@tanstack/react-query";
import {
  fetchManhattan,
  type ManhattanPayload,
  type ManhattanInFlightResponse,
} from "../api/gwas-results";

export function useManhattanData(runId: string, binCount = 100) {
  return useQuery<ManhattanPayload | ManhattanInFlightResponse>({
    queryKey: ["finngen", "manhattan", runId, binCount],
    queryFn: () => fetchManhattan(runId, binCount),
    enabled: Boolean(runId),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function isManhattanInFlight(
  data: ManhattanPayload | ManhattanInFlightResponse | undefined,
): data is ManhattanInFlightResponse {
  return (
    data !== undefined &&
    "status" in (data as object) &&
    ((data as ManhattanInFlightResponse).status === "queued" ||
      (data as ManhattanInFlightResponse).status === "running")
  );
}
