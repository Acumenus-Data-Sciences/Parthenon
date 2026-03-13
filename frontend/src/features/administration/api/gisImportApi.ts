import apiClient from "@/lib/api-client";
import type {
  UploadResult,
  ColumnSuggestion,
  ColumnMapping,
  ImportConfig,
  ValidationResult,
  GisImport,
} from "../types/gisImport";

const BASE = "/gis/import";

export async function uploadGisFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post(`${BASE}/upload`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
}

export async function analyzeImport(
  importId: number,
): Promise<{ suggestions: ColumnSuggestion[]; source: string }> {
  const { data } = await apiClient.post(`${BASE}/${importId}/analyze`);
  return data.data;
}

export async function askAbbyColumn(
  importId: number,
  column: string,
  question: string,
): Promise<{ answer: string }> {
  const { data } = await apiClient.post(`${BASE}/${importId}/ask`, {
    column,
    question,
  });
  return data.data;
}

export async function saveMapping(
  importId: number,
  mapping: ColumnMapping,
): Promise<void> {
  await apiClient.put(`${BASE}/${importId}/mapping`, { mapping });
}

export async function saveConfig(
  importId: number,
  config: ImportConfig,
): Promise<void> {
  await apiClient.put(`${BASE}/${importId}/config`, config);
}

export async function validateImport(
  importId: number,
): Promise<ValidationResult> {
  const { data } = await apiClient.post(`${BASE}/${importId}/validate`);
  return data.data;
}

export async function executeImport(
  importId: number,
): Promise<{ status: string; import_id: number }> {
  const { data } = await apiClient.post(`${BASE}/${importId}/execute`);
  return data.data;
}

export async function fetchImportStatus(importId: number): Promise<GisImport> {
  const { data } = await apiClient.get(`${BASE}/${importId}/status`);
  return data.data;
}

export async function rollbackImport(importId: number): Promise<void> {
  await apiClient.delete(`${BASE}/${importId}`);
}

export async function fetchImportHistory(): Promise<GisImport[]> {
  const { data } = await apiClient.get(`${BASE}/history`);
  return data.data.data; // paginated: { data: { data: [...] } }
}

export async function storeAbbyLearning(
  importId: number,
  mappings: Array<{
    column_name: string;
    mapped_to: string;
    source_description: string;
    data_type: string;
  }>,
): Promise<void> {
  await apiClient.post(`${BASE}/${importId}/learn`, { mappings });
}
