import { useMemo } from "react";
import { FileText, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileReviewListProps {
  files: File[];
  tableNames: string[];
  onTableNameChange: (index: number, name: string) => void;
  onRemove: (index: number) => void;
  onStageAll: () => void;
  isStaging: boolean;
}

const TABLE_NAME_REGEX = /^[a-z][a-z0-9_]{0,62}$/;

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Derive a valid table name from a filename */
export function deriveTableName(filename: string): string {
  // Strip extension
  const base = filename.replace(/\.[^.]+$/, "");
  // Lowercase, spaces to underscores, strip non-alphanumeric (keep underscores)
  const cleaned = base.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  // Ensure starts with a letter
  const result = /^[a-z]/.test(cleaned) ? cleaned : `t_${cleaned}`;
  // Truncate to 63 chars
  return result.slice(0, 63);
}

export function FileReviewList({
  files,
  tableNames,
  onTableNameChange,
  onRemove,
  onStageAll,
  isStaging,
}: FileReviewListProps) {
  const validationErrors = useMemo(() => {
    return tableNames.map((name) => {
      if (!name) return "Table name is required";
      if (!TABLE_NAME_REGEX.test(name)) {
        return "Must start with a letter, only lowercase alphanumeric and underscores, max 63 chars";
      }
      return null;
    });
  }, [tableNames]);

  const hasDuplicates = useMemo(() => {
    const seen = new Set<string>();
    return tableNames.map((name) => {
      if (!name) return false;
      if (seen.has(name)) return true;
      seen.add(name);
      return false;
    });
  }, [tableNames]);

  const canStage =
    files.length > 0 &&
    validationErrors.every((e) => e === null) &&
    !hasDuplicates.some(Boolean);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border-default overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-border-default bg-surface-raised px-4 py-2">
          <span className="flex-[2] text-xs font-medium uppercase tracking-wider text-text-muted">
            Original File
          </span>
          <span className="flex-[2] text-xs font-medium uppercase tracking-wider text-text-muted">
            Table Name
          </span>
          <span className="w-20 text-right text-xs font-medium uppercase tracking-wider text-text-muted">
            Size
          </span>
          <span className="w-10" />
        </div>

        {/* Rows */}
        {files.map((file, index) => {
          const error = validationErrors[index];
          const isDuplicate = hasDuplicates[index];
          const hasError = error !== null || isDuplicate;

          return (
            <div
              key={`${file.name}-${index}`}
              className="flex items-start gap-4 border-b border-border-default bg-surface-base px-4 py-3 last:border-b-0"
            >
              {/* Filename */}
              <div className="flex flex-[2] items-center gap-2 min-w-0">
                <FileText size={16} className="shrink-0 text-accent" />
                <span className="truncate text-sm text-text-muted">{file.name}</span>
              </div>

              {/* Table name input */}
              <div className="flex-[2]">
                <input
                  type="text"
                  value={tableNames[index] ?? ""}
                  onChange={(e) => onTableNameChange(index, e.target.value)}
                  disabled={isStaging}
                  className={cn(
                    "w-full rounded-md border bg-surface-base px-3 py-1.5 text-sm text-text-primary font-mono placeholder-text-ghost focus:outline-none transition-colors",
                    hasError
                      ? "border-red-500 focus:border-red-400"
                      : "border-surface-highlight focus:border-accent",
                  )}
                  placeholder="table_name"
                />
                {error && (
                  <p className="mt-1 text-xs text-red-400">{error}</p>
                )}
                {isDuplicate && !error && (
                  <p className="mt-1 text-xs text-red-400">Duplicate table name</p>
                )}
              </div>

              {/* Size */}
              <div className="w-20 text-right text-sm text-text-muted pt-1.5">
                {formatFileSize(file.size)}
              </div>

              {/* Remove */}
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={isStaging}
                className="w-10 flex items-center justify-center pt-1 text-text-muted hover:text-critical transition-colors disabled:opacity-50"
                aria-label={`Remove ${file.name}`}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Stage All button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onStageAll}
          disabled={!canStage || isStaging}
          className="flex items-center gap-2 rounded-md bg-success px-6 py-2.5 text-sm font-medium text-surface-base transition-colors hover:bg-[#26BCA8] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStaging && <Loader2 size={16} className="animate-spin" />}
          {isStaging ? "Staging..." : "Stage All"}
        </button>
      </div>
    </div>
  );
}
