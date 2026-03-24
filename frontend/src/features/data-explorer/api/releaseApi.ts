import apiClient from "@/lib/api-client";
import type { SourceRelease, StoreReleasePayload, UpdateReleasePayload } from "../types/ares";

const BASE = (sourceId: number) => `/sources/${sourceId}/ares/releases`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap<T>(body: any): T {
  if (body && typeof body === "object" && "data" in body && !Array.isArray(body)) {
    return body.data as T;
  }
  return body as T;
}

export async function fetchReleases(sourceId: number): Promise<SourceRelease[]> {
  const { data } = await apiClient.get(BASE(sourceId));
  return unwrap<SourceRelease[]>(data);
}

export async function fetchRelease(sourceId: number, releaseId: number): Promise<SourceRelease> {
  const { data } = await apiClient.get(`${BASE(sourceId)}/${releaseId}`);
  return unwrap<SourceRelease>(data);
}

export async function createRelease(
  sourceId: number,
  payload: StoreReleasePayload,
): Promise<SourceRelease> {
  const { data } = await apiClient.post(BASE(sourceId), payload);
  return unwrap<SourceRelease>(data);
}

export async function updateRelease(
  sourceId: number,
  releaseId: number,
  payload: UpdateReleasePayload,
): Promise<SourceRelease> {
  const { data } = await apiClient.put(`${BASE(sourceId)}/${releaseId}`, payload);
  return unwrap<SourceRelease>(data);
}

export async function deleteRelease(sourceId: number, releaseId: number): Promise<void> {
  await apiClient.delete(`${BASE(sourceId)}/${releaseId}`);
}
