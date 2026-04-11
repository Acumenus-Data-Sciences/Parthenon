import { useCallback, useState } from "react";
import { CheckCircle2, Loader2, ExternalLink, BookOpen } from "lucide-react";
import { useExecuteImport, useImportStatus } from "../../hooks/useGisImport";
import { storeAbbyLearning } from "../../api/gisImportApi";
import type { ColumnMapping } from "../../types/gisImport";

interface Props {
  importId: number;
  mapping: ColumnMapping;
  onReset: () => void;
}

export function ImportStep({ importId, mapping, onReset }: Props) {
  const [started, setStarted] = useState(false);
  const [saveLearning, setSaveLearning] = useState(true);
  const execute = useExecuteImport();
  const { data: status } = useImportStatus(started ? importId : null);

  const handleStart = useCallback(async () => {
    await execute.mutateAsync(importId);
    setStarted(true);
  }, [execute, importId]);

  const isRunning = status?.status === "importing" || status?.status === "queued";
  const isComplete = status?.status === "complete";
  const isFailed = status?.status === "failed";

  if (!started) {
    return (
      <div className="flex flex-col items-center py-8">
        <button
          onClick={handleStart}
          disabled={execute.isPending}
          className="rounded bg-accent px-6 py-3 text-sm font-medium text-surface-base hover:bg-accent/90 disabled:opacity-50"
        >
          {execute.isPending ? "Starting..." : "Start Import"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      {isRunning && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span className="text-sm text-[#E8E4DC]">Importing... {status?.progress_percentage ?? 0}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface-elevated">
            <div
              className="h-2 rounded-full bg-accent transition-all"
              style={{ width: `${status?.progress_percentage ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Log output */}
      {status?.log_output && (
        <div className="rounded border border-border-default bg-[#0A0A0F] p-3">
          <pre className="max-h-48 overflow-y-auto font-mono text-xs text-text-muted whitespace-pre-wrap">
            {status.log_output}
          </pre>
        </div>
      )}

      {/* Complete */}
      {isComplete && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded border border-green-500/30 bg-green-500/10 p-3">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-400">Import Complete</p>
              <p className="text-xs text-green-300/70">{status.row_count} rows imported</p>
            </div>
          </div>

          {/* Learn prompt */}
          <div className="rounded border border-border-default bg-surface-base p-3">
            <label className="flex items-center gap-2 text-sm text-[#E8E4DC]">
              <input
                type="checkbox"
                checked={saveLearning}
                onChange={(e) => setSaveLearning(e.target.checked)}
                className="rounded border-surface-highlight"
              />
              <BookOpen className="h-3.5 w-3.5 text-accent" />
              Save mappings so Abby learns for next time
            </label>
            {saveLearning && (
              <button
                onClick={async () => {
                  const learnings = Object.entries(mapping).map(([col, m]) => ({
                    column_name: col,
                    mapped_to: m.exposure_type ?? m.purpose,
                    source_description: `Imported from ${status?.filename ?? "file"}`,
                    data_type: m.purpose === "value" ? "float" : "string",
                  }));
                  await storeAbbyLearning(importId, learnings);
                }}
                className="mt-2 rounded bg-surface-elevated px-3 py-1 text-xs text-accent hover:bg-surface-highlight"
              >
                Save to Abby
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <a
              href="/gis"
              className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-sm font-medium text-surface-base hover:bg-accent/90"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View in GIS Explorer
            </a>
            <button
              onClick={onReset}
              className="rounded border border-surface-highlight px-4 py-2 text-sm text-text-muted hover:border-text-ghost"
            >
              Import Another
            </button>
          </div>
        </div>
      )}

      {/* Failed */}
      {isFailed && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <p className="font-medium">Import Failed</p>
          {status.error_log?.map((e, i) => (
            <p key={i} className="mt-1 text-xs">{e.message}</p>
          ))}
          <button
            onClick={onReset}
            className="mt-3 rounded border border-red-500/30 px-3 py-1 text-xs hover:bg-red-500/10"
          >
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}
