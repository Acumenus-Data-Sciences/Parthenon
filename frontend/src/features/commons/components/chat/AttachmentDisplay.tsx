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
    <div className="mt-3 space-y-3">
      {/* Image thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <a
              key={img.id}
              href={downloadUrl(img.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block max-w-[260px] overflow-hidden rounded-2xl border border-[#2a2a31] bg-[#111115] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-[#3a3a44]"
            >
              <img
                src={`${API_BASE}/storage/${img.stored_path}`}
                alt={img.original_name}
                className="h-auto max-h-44 w-full object-cover transition-transform duration-200 group-hover:scale-[1.01]"
                loading="lazy"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="rounded-full border border-white/10 bg-black/40 p-2 backdrop-blur-sm">
                  <Download className="h-5 w-5 text-text-primary" />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 py-2 text-[11px] text-text-primary/85">
                <div className="truncate font-medium">{img.original_name}</div>
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
          className="flex max-w-sm items-center gap-3 rounded-2xl border border-[#2a2a31] bg-[#111115] px-3 py-3 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-[#3a3a44] hover:bg-[#15151a]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#2f2f36] bg-[#1a1a20]">
            {file.mime_type === "application/pdf" ? (
              <FileText className="h-4 w-4 shrink-0 text-red-400" />
            ) : (
              <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{file.original_name}</div>
            <div className="text-xs text-muted-foreground">{formatSize(file.size_bytes)}</div>
          </div>
          <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
        </a>
      ))}
    </div>
  );
}
