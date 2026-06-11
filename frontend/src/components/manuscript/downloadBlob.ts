const MIME_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  "figures-zip": "application/zip",
  zip: "application/zip",
};

/**
 * Trigger a browser download of a binary payload. Single shared implementation
 * for every publication export path (study manuscript export, /publish export).
 */
export function downloadBlob(data: BlobPart, filename: string, mimeType?: string): void {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const type = mimeType ?? MIME_TYPES[ext] ?? "application/octet-stream";
  const blob = data instanceof Blob ? data : new Blob([data], { type });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
