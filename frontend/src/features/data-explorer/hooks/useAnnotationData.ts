import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from "../api/annotationApi";
import type { StoreAnnotationPayload, UpdateAnnotationPayload } from "../types/ares";

export function useAnnotations(
  sourceId: number | null,
  chartType?: string,
  filters?: { tag?: string; search?: string },
) {
  return useQuery({
    queryKey: ["ares", "annotations", sourceId, chartType, filters],
    queryFn: () => fetchAnnotations(sourceId!, chartType, filters),
    enabled: sourceId != null && sourceId > 0,
  });
}

export function useCreateAnnotation(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StoreAnnotationPayload) => createAnnotation(sourceId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ares", "annotations"] });
    },
  });
}

export function useUpdateAnnotation(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      annotationId,
      payload,
    }: {
      annotationId: number;
      payload: UpdateAnnotationPayload;
    }) => updateAnnotation(sourceId, annotationId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ares", "annotations"] });
    },
  });
}

export function useDeleteAnnotation(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (annotationId: number) => deleteAnnotation(sourceId, annotationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ares", "annotations"] });
    },
  });
}
