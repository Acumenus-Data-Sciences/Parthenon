import { useEffect, useRef, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import apiClient from "@/lib/api-client";
import { sourceDownloadUrl } from "../../api/wiki";

export function WikiPdfModal({
  workspace, filename, onClose,
}: {
  workspace: string;
  filename: string;
  onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = sourceDownloadUrl(workspace, filename);

    apiClient
      .get<Blob>(url, { responseType: "blob" })
      .then((response) => {
        if (cancelled) return;
        // Axios with responseType: "blob" returns data as a Blob directly
        const blob = response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: "application/pdf" });
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
        setBlobUrl(objectUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("PDF fetch failed:", err);
        setError("Failed to load PDF.");
      });

    return () => {
      cancelled = true;
      // Revoke on unmount only
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [workspace, filename]);

  function handleDownload() {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative flex h-[90vh] w-[85vw] max-w-6xl flex-col overflow-hidden rounded-lg border border-[#232328] bg-[#151518] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232328] bg-[#1C1C20] px-5 py-3">
          <p className="truncate text-sm font-medium text-[#F0EDE8]">{filename}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!blobUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#232328] bg-[#151518] px-3 py-1.5 text-xs font-medium text-[#8A857D] transition-colors hover:text-[#F0EDE8] disabled:opacity-50"
            >
              <Download size={14} />
              Download
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#8A857D] transition-colors hover:text-[#F0EDE8]">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* PDF */}
        <div className="flex flex-1 items-center justify-center bg-[#0E0E11]">
          {error ? (
            <p className="text-sm text-[#E85A6B]">{error}</p>
          ) : blobUrl ? (
            <object
              data={blobUrl}
              type="application/pdf"
              className="h-full w-full"
            >
              <div className="flex flex-col items-center justify-center gap-3 p-8">
                <p className="text-sm text-[#8A857D]">PDF preview not available in this browser.</p>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] transition-colors hover:bg-[#26B8A5]"
                >
                  <Download size={14} />
                  Download PDF
                </button>
              </div>
            </object>
          ) : (
            <div className="flex items-center gap-2 text-sm text-[#8A857D]">
              <Loader2 size={16} className="animate-spin" />
              Loading PDF...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
