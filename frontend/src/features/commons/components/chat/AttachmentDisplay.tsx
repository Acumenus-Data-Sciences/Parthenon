import { Download, FileText, Image as ImageIcon } from "lucide-react";
import type { Attachment } from "../../types";

interface AttachmentDisplayProps {
  attachments: Attachment[];
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadUrl(id: number): string {
  return `${API_BASE}/commons/attachments/${id}/download`;
}

export function AttachmentDisplay({ attachments }: AttachmentDisplayProps) {
  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => isImage(a.mime_type));
  const files = attachments.filter((a) => !isImage(a.mime_type));

  return (
    <div className="mt-2 space-y-2">
      {/* Image thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <a
              key={img.id}
              href={downloadUrl(img.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block max-w-[240px] overflow-hidden rounded-md border border-border"
            >
              <img
                src={`${API_BASE}/storage/${img.stored_path}`}
                alt={img.original_name}
                className="h-auto max-h-40 w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Download className="h-5 w-5 text-white" />
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Non-image files */}
      {files.map((file) => (
        <a
          key={file.id}
          href={downloadUrl(file.id)}
          className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors max-w-xs"
        >
          {file.mime_type === "application/pdf" ? (
            <FileText className="h-4 w-4 shrink-0 text-red-400" />
          ) : (
            <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate">{file.original_name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatSize(file.size_bytes)}
          </span>
        </a>
      ))}
    </div>
  );
}
