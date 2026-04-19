// Phase 18 (Plan 18-06) — TanStack Query mutation for POST /api/v1/finngen/endpoints/{name}/profile.
//
// On 202-success we invalidate the matching read key so any downstream
// useEndpointProfile() consumers refetch and pick up either the still-
// `needs_compute` envelope (the R worker hasn't finished yet) OR the new
// `cached` envelope (worker raced ahead). Subsequent polling is governed
// by useEndpointProfile's refetchInterval per UI-SPEC §Auto-dispatch + polling.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  dispatchEndpointProfile,
  type ComputeEndpointProfilePayload,
  type ComputeEndpointProfileResponse,
  type ProfileDispatchRefusal,
} from "../api";

export function useDispatchEndpointProfile(endpointName: string) {
  const qc = useQueryClient();
  return useMutation<
    ComputeEndpointProfileResponse,
    ProfileDispatchRefusal | Error,
    ComputeEndpointProfilePayload
  >({
    mutationFn: (payload) => dispatchEndpointProfile(endpointName, payload),
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({
        queryKey: [
          "finngen",
          "endpoint-profile",
          endpointName,
          payload.source_key,
        ],
      });
    },
  });
}
