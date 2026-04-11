import { type ScanProgress } from "../hooks/useProfilerData";

interface ScanProgressIndicatorProps {
  progress: ScanProgress;
  onCancel: () => void;
}

export default function ScanProgressIndicator({
  progress,
  onCancel,
}: ScanProgressIndicatorProps) {
  if (!progress.isScanning && progress.totalTables === 0) return null;

  const pct = progress.totalTables > 0
    ? Math.round((progress.completedTables / progress.totalTables) * 100)
    : 0;

  const elapsedSec = Math.round(progress.elapsedMs / 1000);
  const totalRows = progress.tableResults.reduce((sum, t) => sum + t.rows, 0);
  const totalCols = progress.tableResults.reduce((sum, t) => sum + t.columns, 0);

  return (
    <div className="bg-surface-base/90 backdrop-blur-sm rounded-xl border border-[#2a2a3e] p-6">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-text-primary">
            {progress.isScanning ? progress.currentTable : "Scan complete"}
          </span>
          <span className="text-sm font-mono text-text-muted">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
          <div
            className="h-full rounded-full bg-success transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "Tables", value: `${progress.completedTables} / ${progress.totalTables}` },
          { label: "Columns", value: totalCols.toLocaleString() },
          { label: "Rows", value: totalRows.toLocaleString() },
          { label: "Elapsed", value: `${elapsedSec}s` },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-sm font-semibold text-text-primary font-mono">{s.value}</div>
            <div className="text-xs text-text-ghost">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Completed tables list */}
      {progress.tableResults.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-lg bg-surface-raised border border-border-default mb-4">
          <div className="divide-y divide-[#1E1E23]">
            {progress.tableResults.map((t) => (
              <div key={t.table} className="flex items-center justify-between px-3 py-1.5 text-xs">
                <span className="text-text-secondary truncate">{t.table}</span>
                <span className="text-text-ghost font-mono shrink-0 ml-2">
                  {t.rows.toLocaleString()} rows &middot; {t.elapsed_ms}ms
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {progress.errors.length > 0 && (
        <div className="mb-4 rounded-lg bg-critical/10 border border-critical/30 px-3 py-2">
          <p className="text-xs font-medium text-critical mb-1">
            {progress.errors.length} table(s) failed
          </p>
          {progress.errors.map((e) => (
            <p key={e.table} className="text-xs text-critical/70 truncate">
              {e.table}: {e.message}
            </p>
          ))}
        </div>
      )}

      {/* Cancel button */}
      {progress.isScanning && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-text-muted hover:text-text-primary border border-surface-highlight rounded-md px-4 py-1.5 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
