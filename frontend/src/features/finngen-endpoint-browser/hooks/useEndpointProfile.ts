// Phase 18 (Plan 18-06) — TanStack Query read hook for GET /api/v1/finngen/endpoints/{name}/profile.
//
// Returns the discriminated-union EndpointProfileEnvelope. When the envelope
// reports `status: "needs_compute"` AND the caller opted into polling, the
// hook refetches every PROFILE_POLL_INTERVAL_MS (3s) so the UI catches the
// flip to `cached` once the R worker (Plan 18-05) finishes (D-08 / D-10).
import { useQuery } from "@tanstack/react-query";
import { fetchEndpointProfile, type EndpointProfileEnvelope } from "../api";

// Poll interval per UI-SPEC §Auto-dispatch + polling. Constant so it is
// adjustable from one place if the 15s worker SLA shifts.
export const PROFILE_POLL_INTERVAL_MS = 3000;

export function useEndpointProfile(params: {
  endpointName: string;
  sourceKey: string;
  pollWhileNeedsCompute?: boolean;
}) {
  return useQuery<EndpointProfileEnvelope>({
    queryKey: [
      "finngen",
      "endpoint-profile",
      params.endpointName,
      params.sourceKey,
    ],
    queryFn: () =>
      fetchEndpointProfile(params.endpointName, params.sourceKey),
    enabled: Boolean(params.endpointName && params.sourceKey),
    staleTime: 60_000,
    refetchInterval: (query) => {
      if (!params.pollWhileNeedsCompute) return false;
      const data = query.state.data;
      if (data && data.status === "needs_compute") {
        return PROFILE_POLL_INTERVAL_MS;
      }
      return false;
    },
  });
}
