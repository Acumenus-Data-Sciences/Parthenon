import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPin, deletePin, fetchPins, updatePin } from "../api";

export function useEvidencePins(investigationId: number | undefined) {
  return useQuery({
    queryKey: ["investigation-pins", investigationId],
    queryFn: () => fetchPins(investigationId!),
    enabled: !!investigationId,
  });
}

export function useCreatePin(investigationId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      payload: Parameters<typeof createPin>[1],
    ) => createPin(investigationId!, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["investigation-pins", investigationId],
      });
    },
  });
}

export function useUpdatePin(investigationId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pinId,
      payload,
    }: {
      pinId: number;
      payload: Parameters<typeof updatePin>[2];
    }) => updatePin(investigationId!, pinId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["investigation-pins", investigationId],
      });
    },
  });
}

export function useDeletePin(investigationId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pinId: number) => deletePin(investigationId!, pinId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["investigation-pins", investigationId],
      });
    },
  });
}
