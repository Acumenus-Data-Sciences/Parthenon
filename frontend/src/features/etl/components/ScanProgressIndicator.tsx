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
    <div className="bg-[#0E0E11]/90 backdrop-blur-sm rounded-xl border border-[#2a2a3e] p-6">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-[#F0EDE8]">
            {progress.isScanning ? progress.currentTable : "Scan complete"}
          </span>
          <span className="text-sm font-mono text-[#8A857D]">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-[#232328] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#2DD4BF] transition-all duration-300"
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
            <div className="text-sm font-semibold text-[#F0EDE8] font-mono">{s.value}</div>
            <div className="text-xs text-[#5A5650]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Completed tables list */}
      {progress.tableResults.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-lg bg-[#151518] border border-[#232328] mb-4">
          <div className="divide-y divide-[#1E1E23]">
            {progress.tableResults.map((t) => (
              <div key={t.table} className="flex items-center justify-between px-3 py-1.5 text-xs">
                <span className="text-[#C5C0B8] truncate">{t.table}</span>
                <span className="text-[#5A5650] font-mono shrink-0 ml-2">
                  {t.rows.toLocaleString()} rows &middot; {t.elapsed_ms}ms
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {progress.errors.length > 0 && (
        <div className="mb-4 rounded-lg bg-[#E85A6B]/10 border border-[#E85A6B]/30 px-3 py-2">
          <p className="text-xs font-medium text-[#E85A6B] mb-1">
            {progress.errors.length} table(s) failed
          </p>
          {progress.errors.map((e) => (
            <p key={e.table} className="text-xs text-[#E85A6B]/70 truncate">
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
            className="text-sm text-[#8A857D] hover:text-[#F0EDE8] border border-[#323238] rounded-md px-4 py-1.5 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
