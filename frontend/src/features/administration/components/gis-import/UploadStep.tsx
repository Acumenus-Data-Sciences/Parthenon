import { useState, useRef, useCallback } from "react";
import { Upload, FileUp, FileText } from "lucide-react";
import { useUploadGisFile } from "../../hooks/useGisImport";
import type { UploadResult } from "../../types/gisImport";

const ACCEPTED_TYPES = ".csv,.tsv,.xlsx,.xls,.json,.geojson,.zip,.kml,.kmz,.gpkg";
const MAX_SIZE_MB = 50;

interface Props {
  onComplete: (result: UploadResult) => void;
}

export function UploadStep({ onComplete }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadGisFile();

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(
          `File exceeds ${MAX_SIZE_MB}MB. Use CLI: php artisan gis:import ${file.name}`,
        );
        return;
      }

      try {
        const result = await upload.mutateAsync(file);
        onComplete(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      }
    },
    [upload, onComplete],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition ${
          isDragOver
            ? "border-accent bg-accent/5"
            : "border-surface-highlight hover:border-text-ghost"
        }`}
      >
        {upload.isPending ? (
          <>
            <FileUp className="mb-2 h-8 w-8 animate-pulse text-accent" />
            <p className="text-sm text-text-muted">Uploading...</p>
          </>
        ) : (
          <>
            <Upload className="mb-2 h-8 w-8 text-text-ghost" />
            <p className="text-sm text-[#E8E4DC]">Drop a file here or click to browse</p>
            <p className="mt-1 text-xs text-text-ghost">
              CSV, TSV, Excel, Shapefile (.zip), GeoJSON, KML, GeoPackage — max {MAX_SIZE_MB}MB
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="hidden"
        />
      </div>

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="rounded border border-border-default bg-surface-base p-4">
        <h4 className="mb-2 flex items-center gap-2 text-xs font-medium text-text-muted">
          <FileText className="h-3.5 w-3.5" />
          For large files (&gt;{MAX_SIZE_MB}MB)
        </h4>
        <code className="block rounded bg-surface-overlay px-3 py-2 text-xs text-[#E8E4DC]">
          php artisan gis:import &lt;path-to-file&gt;
        </code>
      </div>
    </div>
  );
}
