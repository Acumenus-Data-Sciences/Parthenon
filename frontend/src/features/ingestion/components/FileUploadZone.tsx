import { useCallback, useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onRemove: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function FileUploadZone({
  onFileSelect,
  selectedFile,
  onRemove,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect],
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [onFileSelect],
  );

  if (selectedFile) {
    return (
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#1C1C20]">
              <FileText size={20} className="text-[#C9A227]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#F0EDE8]">
                {selectedFile.name}
              </p>
              <p className="text-xs text-[#8A857D]">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center justify-center w-8 h-8 rounded-md text-[#8A857D] hover:text-[#E85A6B] hover:bg-[#1C1C20] transition-colors"
            aria-label="Remove file"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-[#151518] px-6 py-16 cursor-pointer transition-all",
        isDragOver
          ? "border-[#C9A227] bg-[#1C1C20]"
          : "border-[#323238] hover:border-[#C9A227] hover:bg-[#1A1A1E]",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".csv,.json,.hl7,.tsv,.xlsx,.xls,.parquet"
        onChange={handleInputChange}
      />

      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#1C1C20] mb-4">
        <Upload
          size={24}
          className={cn(
            "transition-colors",
            isDragOver ? "text-[#C9A227]" : "text-[#8A857D]",
          )}
        />
      </div>

      <p className="text-sm font-medium text-[#F0EDE8]">
        Drag & drop your file here
      </p>
      <p className="mt-1 text-xs text-[#8A857D]">or click to browse</p>

      <div className="flex items-center gap-2 mt-5">
        {["CSV", "JSON", "HL7", "TSV", "XLSX"].map((fmt) => (
          <span
            key={fmt}
            className="px-2 py-0.5 rounded text-[10px] font-medium tracking-wider uppercase bg-[#1C1C20] text-[#5A5650] border border-[#2A2A30]"
          >
            {fmt}
          </span>
        ))}
      </div>
    </div>
  );
}
