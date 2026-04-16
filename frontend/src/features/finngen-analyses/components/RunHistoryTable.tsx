// frontend/src/features/finngen-analyses/components/RunHistoryTable.tsx
import { useState } from "react";
import { RunStatusBadge, type FinnGenRun } from "@/features/_finngen-foundation";
import { useAllFinnGenRuns } from "../hooks/useModuleRuns";
import { Pin } from "lucide-react";

interface RunHistoryTableProps {
  sourceKey?: string;
  onSelectRun: (run: FinnGenRun) => void;
}

export function RunHistoryTable({ sourceKey, onSelectRun }: RunHistoryTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data: response, isLoading } = useAllFinnGenRuns({
    sourceKey,
    status: statusFilter || undefined,
    page,
  });

  const runs = (response?.data ?? []).filter((r) => {
    if (moduleFilter && r.analysis_type !== moduleFilter) return false;
    // Only show CO2 module runs
    return r.analysis_type.startsWith("co2.");
  });

  const moduleOptions = ["co2.codewas", "co2.time_codewas", "co2.overlaps", "co2.demographics"];

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="rounded border border-border-default bg-surface-base px-2 py-1.5 text-xs text-text-secondary"
        >
          <option value="">All modules</option>
          {moduleOptions.map((m) => (
            <option key={m} value={m}>{m.replace("co2.", "")}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded border border-border-default bg-surface-base px-2 py-1.5 text-xs text-text-secondary"
        >
          <option value="">All statuses</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
          <option value="queued">Queued</option>
        </select>
      </div>

      {/* Table */}
      {isLoading && (
        <div className="py-8 text-center text-xs text-text-ghost">Loading runs...</div>
      )}

      {!isLoading && runs.length === 0 && (
        <div className="py-8 text-center text-xs text-text-ghost">No runs found.</div>
      )}

      {runs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border-default">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default bg-surface-raised text-text-ghost">
                <th className="px-3 py-2 text-left font-medium">Module</th>
                <th className="px-3 py-2 text-left font-medium">Source</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Created</th>
                <th className="px-3 py-2 text-left font-medium">Duration</th>
                <th className="px-3 py-2 text-left font-medium">Pin</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const duration = run.started_at && run.finished_at
                  ? formatDuration(new Date(run.finished_at).getTime() - new Date(run.started_at).getTime())
                  : "--";
                return (
                  <tr
                    key={run.id}
                    onClick={() => onSelectRun(run)}
                    className="cursor-pointer border-b border-border-default/50 hover:bg-surface-overlay/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-text-primary font-medium">
                      {run.analysis_type.replace("co2.", "")}
                    </td>
                    <td className="px-3 py-2 text-text-muted">{run.source_key}</td>
                    <td className="px-3 py-2"><RunStatusBadge status={run.status} /></td>
                    <td className="px-3 py-2 text-text-muted">{timeAgo(run.created_at)}</td>
                    <td className="px-3 py-2 text-text-muted">{duration}</td>
                    <td className="px-3 py-2">
                      {run.pinned && <Pin size={12} className="text-gold" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {response && response.meta.total > response.meta.per_page && (
        <div className="mt-3 flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded border border-border-default px-3 py-1 text-xs text-text-muted disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-xs text-text-ghost py-1">
            Page {page} of {Math.ceil(response.meta.total / response.meta.per_page)}
          </span>
          <button
            type="button"
            disabled={page * response.meta.per_page >= response.meta.total}
            onClick={() => setPage(page + 1)}
            className="rounded border border-border-default px-3 py-1 text-xs text-text-muted disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}
