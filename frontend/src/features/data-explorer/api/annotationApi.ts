import apiClient from "@/lib/api-client";
import type {
  ChartAnnotation,
  StoreAnnotationPayload,
  UpdateAnnotationPayload,
} from "../types/ares";

const BASE = (sourceId: number) => `/sources/${sourceId}/ares/annotations`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap<T>(body: any): T {
  if (body && typeof body === "object" && "data" in body && !Array.isArray(body)) {
    return body.data as T;
  }
  return body as T;
}

export async function fetchAnnotations(
  sourceId: number,
  chartType?: string,
  filters?: { tag?: string; search?: string },
): Promise<ChartAnnotation[]> {
  const params: Record<string, string> = {};
  if (chartType) params.chart_type = chartType;
  if (filters?.tag) params.tag = filters.tag;
  if (filters?.search) params.search = filters.search;
  const { data } = await apiClient.get(BASE(sourceId), {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return unwrap<ChartAnnotation[]>(data);
}

export async function createAnnotation(
  sourceId: number,
  payload: StoreAnnotationPayload,
): Promise<ChartAnnotation> {
  const { data } = await apiClient.post(BASE(sourceId), payload);
  return unwrap<ChartAnnotation>(data);
}

export async function updateAnnotation(
  sourceId: number,
  annotationId: number,
  payload: UpdateAnnotationPayload,
): Promise<ChartAnnotation> {
  const { data } = await apiClient.put(`${BASE(sourceId)}/${annotationId}`, payload);
  return unwrap<ChartAnnotation>(data);
}

export async function deleteAnnotation(sourceId: number, annotationId: number): Promise<void> {
  await apiClient.delete(`${BASE(sourceId)}/${annotationId}`);
}
