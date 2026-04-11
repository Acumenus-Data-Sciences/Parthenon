import { useState, useRef, useCallback } from "react";
import { useUploadGwas } from "../../hooks/useGenomicEvidence";
import type { GwasUploadResult, GwasSummaryRow } from "../../types";

interface GwasUploaderProps {
  investigationId: number;
  onUploadComplete: (result: GwasUploadResult, parsedData: GwasSummaryRow[]) => void;
}

const REQUIRED_COLUMNS = ["chr", "pos", "ref", "alt", "beta", "se", "p"] as const;
type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function autoDetect(columns: string[]): Record<RequiredColumn, string> {
  const lower = columns.map((c) => c.toLowerCase());
  const mapping: Partial<Record<RequiredColumn, string>> = {};
  for (const req of REQUIRED_COLUMNS) {
    const idx = lower.indexOf(req);
    if (idx !== -1) {
      mapping[req] = columns[idx];
    } else if (req === "beta") {
      // Accept "or" as alternative
      const orIdx = lower.indexOf("or");
      if (orIdx !== -1) mapping[req] = columns[orIdx];
    }
  }
  return mapping as Record<RequiredColumn, string>;
}

export function GwasUploader({ investigationId, onUploadComplete }: GwasUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState<GwasUploadResult | null>(null);
  const [heldFile, setHeldFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Record<RequiredColumn, string>>({} as Record<RequiredColumn, string>);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutate: uploadGwas, isPending, isError, error } = useUploadGwas();

  const handleFile = useCallback(
    (file: File) => {
      setUploadResult(null);
      setMappingError(null);
      setHeldFile(file);
      uploadGwas(
        { investigationId, file },
        {
          onSuccess: (result) => {
            setUploadResult(result);
            setMapping(autoDetect(result.columns));
          },
        },
      );
    },
    [investigationId, uploadGwas],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => setIsDragOver(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so same file can be re-selected if needed
    e.target.value = "";
  };

  const allMapped = REQUIRED_COLUMNS.every((col) => mapping[col]);

  const handleConfirmMapping = async () => {
    if (!allMapped) {
      setMappingError("All required columns must be mapped before confirming.");
      return;
    }
    if (!uploadResult || !heldFile) return;

    setMappingError(null);
    setIsParsing(true);

    try {
      const text = await heldFile.text();
      // Detect delimiter: if first line has tabs use TSV, else CSV
      const firstLine = text.split("\n")[0] ?? "";
      const delimiter = firstLine.includes("\t") ? "\t" : ",";

      const lines = text.split("\n");
      const header = lines[0].split(delimiter).map((h) => h.trim());

      const colIndices: Record<RequiredColumn, number> = {
        chr: header.indexOf(mapping.chr),
        pos: header.indexOf(mapping.pos),
        ref: header.indexOf(mapping.ref),
        alt: header.indexOf(mapping.alt),
        beta: header.indexOf(mapping.beta),
        se: header.indexOf(mapping.se),
        p: header.indexOf(mapping.p),
      };

      const rows: GwasSummaryRow[] = lines
        .slice(1)
        .filter((line) => line.trim().length > 0)
        .map((line) => {
          const cols = line.split(delimiter);
          return {
            chr: cols[colIndices.chr]?.trim() ?? "",
            pos: Number(cols[colIndices.pos]?.trim()),
            ref: cols[colIndices.ref]?.trim() ?? "",
            alt: cols[colIndices.alt]?.trim() ?? "",
            beta: Number(cols[colIndices.beta]?.trim()),
            se: Number(cols[colIndices.se]?.trim()),
            p: Number(cols[colIndices.p]?.trim()),
          };
        })
        .filter((row) => row.chr && !isNaN(row.pos) && !isNaN(row.p));

      onUploadComplete(uploadResult, rows);
    } catch {
      setMappingError("Failed to parse file. Please check the format.");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--success)" }}>
          Upload GWAS Summary Statistics
        </span>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
          isDragOver
            ? "border-teal-400 bg-teal-950/20"
            : "border-zinc-700 bg-zinc-950 hover:border-teal-600 hover:bg-zinc-900/60"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".tsv,.csv,.gz"
          className="hidden"
          onChange={onInputChange}
        />

        {/* Upload icon */}
        <svg
          className={`w-8 h-8 transition-colors ${isDragOver ? "text-teal-400" : "text-zinc-500"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>

        <p className="text-sm text-zinc-300 font-medium">
          {isDragOver ? "Release to upload" : "Drop GWAS summary stats"}
        </p>
        <p className="text-xs text-zinc-500">
          .tsv, .csv, or .gz · max 500 MB
        </p>

        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-zinc-950/70">
            <div
              className="w-6 h-6 border-2 border-zinc-600 rounded-full animate-spin"
              style={{ borderTopColor: "var(--success)" }}
            />
          </div>
        )}
      </div>

      {/* Upload error */}
      {isError && (
        <p className="text-xs px-1" style={{ color: "var(--primary)" }}>
          {error instanceof Error ? error.message : "Upload failed. Please try again."}
        </p>
      )}

      {/* Upload result summary */}
      {uploadResult && (
        <div className="flex flex-col gap-4 rounded-xl bg-zinc-900/60 border border-zinc-800 p-4">
          {/* File meta */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-zinc-200">{uploadResult.file_name}</p>
              <p className="text-xs text-zinc-500">
                {formatBytes(uploadResult.file_size)} · {uploadResult.total_rows.toLocaleString()} rows
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {uploadResult.columns.map((col) => (
                <span
                  key={col}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* Preview table */}
          {uploadResult.sample_rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="text-[11px] min-w-full">
                <thead>
                  <tr className="bg-zinc-800/60">
                    {uploadResult.columns.map((col) => (
                      <th
                        key={col}
                        className="px-2 py-1.5 text-left text-zinc-400 font-semibold font-mono whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uploadResult.sample_rows.slice(0, 5).map((row, rIdx) => (
                    <tr key={rIdx} className="border-t border-zinc-800/50 hover:bg-zinc-800/20">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-2 py-1 text-zinc-400 font-mono whitespace-nowrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Column mapping */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Column Mapping</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {REQUIRED_COLUMNS.map((req) => {
                const isMapped = !!mapping[req];
                return (
                  <div key={req} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-zinc-300">{req}</span>
                      {isMapped ? (
                        <svg className="w-3.5 h-3.5 text-teal-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                      )}
                    </div>
                    <select
                      value={mapping[req] ?? ""}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, [req]: e.target.value }))
                      }
                      className={`text-xs rounded-lg px-2 py-1 bg-zinc-800/80 border focus:outline-none focus:border-zinc-500 transition-colors text-zinc-200 ${
                        isMapped ? "border-zinc-700" : "border-amber-700/50"
                      }`}
                    >
                      <option value="">— select —</option>
                      {uploadResult.columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mapping error */}
          {mappingError && (
            <p className="text-xs px-1" style={{ color: "var(--primary)" }}>
              {mappingError}
            </p>
          )}

          {/* Confirm button */}
          <button
            onClick={() => void handleConfirmMapping()}
            disabled={!allMapped || isParsing}
            className={`self-start flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              allMapped && !isParsing
                ? "bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            }`}
          >
            {isParsing ? (
              <>
                <div
                  className="w-3.5 h-3.5 border-2 border-zinc-600 rounded-full animate-spin"
                  style={{ borderTopColor: "var(--success)" }}
                />
                Parsing…
              </>
            ) : (
              "Confirm Mapping"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
