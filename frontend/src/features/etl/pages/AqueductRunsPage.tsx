import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTemplateRunHistory } from "../api/templates";
import type {
  TemplateRun,
  TemplateRunStatus,
} from "../types/templates";
import { RunStatusBadge } from "../components/aqueduct/templates/RunStatusBadge";
import { RunInspector } from "../components/aqueduct/templates/RunInspector";

const ALL_STATUSES: TemplateRunStatus[] = [
  "pending",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
];

const PAGE_SIZE = 20;

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  return `${Math.round(ms / 60_000)} m`;
}

export function AqueductRunsPage() {
  const { t } = useTranslation("app");
  const [searchParams, setSearchParams] = useSearchParams();
  const runParam = searchParams.get("run");
  const selectedRunId = runParam ? Number(runParam) : null;

  const [statuses, setStatuses] = useState<TemplateRunStatus[]>([]);
  const [page, setPage] = useState(1);

  const historyQ = useTemplateRunHistory({
    page,
    pageSize: PAGE_SIZE,
    statuses: statuses.length ? statuses : undefined,
  });

  function selectRun(id: number) {
    const next = new URLSearchParams(searchParams);
    next.set("run", String(id));
    setSearchParams(next, { replace: true });
  }

  function clearSelection() {
    const next = new URLSearchParams(searchParams);
    next.delete("run");
    setSearchParams(next, { replace: true });
  }

  function toggleStatus(s: TemplateRunStatus) {
    setStatuses((curr) =>
      curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s],
    );
    setPage(1);
  }

  const meta = historyQ.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / PAGE_SIZE)) : 1;

  const rows: TemplateRun[] = useMemo(
    () => historyQ.data?.data ?? [],
    [historyQ.data],
  );

  if (selectedRunId !== null) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={clearSelection}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          {t("aqueduct.runs.backToList", { defaultValue: "← Back to runs" })}
        </button>
        <RunInspector runId={selectedRunId} />
      </div>
    );
  }

  const labelFor = (s: TemplateRunStatus) =>
    t(`aqueduct.status.${s}`, { defaultValue: s });

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {ALL_STATUSES.map((s) => {
          const active = statuses.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                active
                  ? "border-success bg-success/10 text-success"
                  : "border-border-default text-text-muted hover:bg-surface-overlay",
              )}
            >
              {labelFor(s)}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-raised">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default text-xs uppercase tracking-wide text-text-ghost">
              <th className="px-4 py-2 text-left font-medium">
                {t("aqueduct.runs.columns.template", {
                  defaultValue: "Template",
                })}
              </th>
              <th className="px-4 py-2 text-left font-medium">
                {t("aqueduct.runs.columns.version", {
                  defaultValue: "Version",
                })}
              </th>
              <th className="px-4 py-2 text-left font-medium">
                {t("aqueduct.runs.columns.status", { defaultValue: "Status" })}
              </th>
              <th className="px-4 py-2 text-left font-medium">
                {t("aqueduct.runs.columns.started", {
                  defaultValue: "Started",
                })}
              </th>
              <th className="px-4 py-2 text-left font-medium">
                {t("aqueduct.runs.columns.duration", {
                  defaultValue: "Duration",
                })}
              </th>
              <th className="px-4 py-2 text-left font-medium">
                {t("aqueduct.runs.columns.submitted_by", {
                  defaultValue: "Submitted by",
                })}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {historyQ.isLoading && (
              <tr>
                <td colSpan={6} className="py-8 text-center">
                  <Loader2
                    size={16}
                    className="mx-auto animate-spin text-text-muted"
                  />
                </td>
              </tr>
            )}
            {!historyQ.isLoading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-sm text-text-muted"
                >
                  {t("aqueduct.runs.empty", {
                    defaultValue: "No runs match the current filters.",
                  })}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => selectRun(row.id)}
                className="cursor-pointer text-sm text-text-secondary hover:bg-surface-overlay"
              >
                <td className="px-4 py-2.5">{row.template_id}</td>
                <td className="px-4 py-2.5 font-['IBM_Plex_Mono',monospace] text-xs">
                  {row.template_version}
                </td>
                <td className="px-4 py-2.5">
                  <RunStatusBadge status={row.status} />
                </td>
                <td className="px-4 py-2.5 text-xs text-text-muted">
                  {row.started_at
                    ? new Date(row.started_at).toLocaleString()
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-xs text-text-muted">
                  {formatDuration(row.started_at, row.finished_at)}
                </td>
                <td className="px-4 py-2.5 text-xs text-text-muted">
                  {row.submitted_by}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            {t("aqueduct.runs.pageOf", {
              defaultValue: "Page {{page}} of {{total}}",
              page,
              total: totalPages,
            })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-border-default px-3 py-1 disabled:opacity-50"
            >
              {t("aqueduct.runs.prev", { defaultValue: "Prev" })}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-border-default px-3 py-1 disabled:opacity-50"
            >
              {t("aqueduct.runs.next", { defaultValue: "Next" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
