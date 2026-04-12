import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiFileUploadZoneProps {
  onFilesSelect: (files: File[]) => void;
}

export function MultiFileUploadZone({ onFilesSelect }: MultiFileUploadZoneProps) {
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

      const fileList = e.dataTransfer.files;
      if (fileList.length > 0) {
        onFilesSelect(Array.from(fileList));
      }
    },
    [onFilesSelect],
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (fileList && fileList.length > 0) {
        onFilesSelect(Array.from(fileList));
      }
      // Reset input so the same files can be re-selected
      e.target.value = "";
    },
    [onFilesSelect],
  );

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
        accept=".csv,.tsv,.xlsx,.xls"
        multiple
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
        Drag & drop files here
      </p>
      <p className="mt-1 text-xs text-[#8A857D]">or click to browse</p>

      <div className="flex items-center gap-2 mt-5">
        {["CSV", "TSV", "XLSX"].map((fmt) => (
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
