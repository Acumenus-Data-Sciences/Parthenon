import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiFileUploadZoneProps {
  onFilesSelect: (files: File[]) => void;
}

export function MultiFileUploadZone({ onFilesSelect }: MultiFileUploadZoneProps) {
  const { t } = useTranslation("app");
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
        "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-surface-raised px-6 py-16 cursor-pointer transition-all",
        isDragOver
          ? "border-accent bg-surface-overlay"
          : "border-surface-highlight hover:border-accent hover:bg-surface-overlay",
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

      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-surface-overlay mb-4">
        <Upload
          size={24}
          className={cn(
            "transition-colors",
            isDragOver ? "text-accent" : "text-text-muted",
          )}
        />
      </div>

      <p className="text-sm font-medium text-text-primary">
        {t("ingestion.upload.dragFiles")}
      </p>
      <p className="mt-1 text-xs text-text-muted">
        {t("ingestion.upload.browse")}
      </p>

      <div className="flex items-center gap-2 mt-5">
        {["CSV", "TSV", "XLSX"].map((fmt) => (
          <span
            key={fmt}
            className="px-2 py-0.5 rounded text-[10px] font-medium tracking-wider uppercase bg-surface-overlay text-text-ghost border border-border-default"
          >
            {fmt}
          </span>
        ))}
      </div>
    </div>
  );
}
