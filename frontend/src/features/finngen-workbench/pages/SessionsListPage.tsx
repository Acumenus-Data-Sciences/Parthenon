// frontend/src/features/finngen-workbench/pages/SessionsListPage.tsx
//
// SP4 Phase F.2 + v1.0 UX pass — list saved cohort-workbench sessions,
// create new ones, resume an existing one. Source picker reuses the
// platform-wide fetchSources for consistency with the rest of Parthenon.
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Copy, GitMerge, Loader2, Plus, Trash2 } from "lucide-react";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import {
  useCreateWorkbenchSession,
  useDeleteWorkbenchSession,
  useWorkbenchSessions,
} from "../hooks/useWorkbenchSession";
import type { WorkbenchSession, WorkbenchSessionStateV1 } from "../types";
import { Shell } from "@/components/workbench/primitives";

export default function SessionsListPage() {
  const navigate = useNavigate();
  const sessions = useWorkbenchSessions();
  const sourcesQuery = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
    staleTime: 5 * 60 * 1000,
  });
  const createMutation = useCreateWorkbenchSession();
  const deleteMutation = useDeleteWorkbenchSession();

  const [newName, setNewName] = useState("");
  const [newSourceKey, setNewSourceKey] = useState("");

  const trimmedName = newName.trim();
  const canCreate = newSourceKey !== "" && !createMutation.isPending;

  function handleCreate() {
    if (!canCreate) return;
    createMutation.mutate(
      {
        source_key: newSourceKey,
        name: trimmedName === "" ? "Untitled session" : trimmedName,
        session_state: { step: 0 },
      },
      {
        onSuccess: (created) => navigate(`/workbench/cohorts/${created.id}`),
      },
    );
  }

  function handleDuplicate(session: WorkbenchSession) {
    // Duplicates the operation tree + current step, strips run-scoped state
    // (recent_run_ids, materialized_cohort_id, materialize_run_id,
    // matched_cohort_promotions) so the copy starts fresh on the run side.
    const baseState = (session.session_state ?? {}) as WorkbenchSessionStateV1;
    const clean: WorkbenchSessionStateV1 = {
      step: baseState.step,
      operation_tree: baseState.operation_tree,
      selected_cohort_ids: baseState.selected_cohort_ids,
      ui: baseState.ui,
    };
    createMutation.mutate(
      {
        source_key: session.source_key,
        name: `${session.name} (copy)`,
        description: session.description ?? undefined,
        session_state: clean,
      },
      {
        onSuccess: (created) => navigate(`/workbench/cohorts/${created.id}`),
      },
    );
  }

  const sortedSessions = useMemo(
    () =>
      (sessions.data ?? [])
        .slice()
        .sort(
          (a, b) =>
            new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime(),
        ),
    [sessions.data],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <header>
        <h1 className="text-lg font-semibold text-text-primary">Cohort Workbench</h1>
        <p className="text-xs text-text-ghost">
          Compose, match, and materialize cohorts. Hand off to the Analysis Gallery when ready.
        </p>
      </header>

      <Shell
        title="New session"
        subtitle="Pick a source; give the session a name (or leave blank — we'll call it Untitled)."
      >
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr,1fr,auto] md:items-end">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-text-ghost">Name</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Untitled session"
              maxLength={255}
              className="w-full rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-text-ghost">Source</span>
            <select
              value={newSourceKey}
              onChange={(e) => setNewSourceKey(e.target.value)}
              disabled={sourcesQuery.isPending}
              className="w-full rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs disabled:opacity-60"
            >
              <option value="">
                {sourcesQuery.isPending ? "Loading sources…" : "— pick a source —"}
              </option>
              {sourcesQuery.data?.map((s) => (
                <option key={s.source_key} value={s.source_key}>
                  {s.source_name} ({s.source_key})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate}
            className={[
              "flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
              !canCreate
                ? "cursor-not-allowed bg-surface-overlay text-text-ghost"
                : "bg-success text-bg-canvas hover:bg-success/90",
            ].join(" ")}
          >
            {createMutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Plus size={12} />
            )}
            Create session
          </button>
        </div>
      </Shell>

      <Shell
        title="Your sessions"
        subtitle={
          sessions.data && sessions.data.length > 0
            ? `${sessions.data.length} session${sessions.data.length === 1 ? "" : "s"} — most recent first.`
            : undefined
        }
      >
        {sessions.isPending && (
          <div className="flex items-center gap-2 p-4 text-xs text-text-ghost">
            <Loader2 size={12} className="animate-spin" /> Loading…
          </div>
        )}
        {sessions.isError && (
          <p className="p-4 text-xs text-error">Failed to load sessions.</p>
        )}
        {sessions.data?.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <div className="rounded-full border border-dashed border-border-default p-3 text-text-ghost">
              <GitMerge size={20} />
            </div>
            <p className="text-sm font-medium text-text-secondary">No sessions yet</p>
            <p className="max-w-md text-[10px] text-text-ghost">
              A session captures one cohort-composition workflow: import → operate
              (UNION/INTERSECT/MINUS) → preview counts → match → materialize → hand off. Start one
              above.
            </p>
          </div>
        )}
        {sortedSessions.length > 0 && (
          <ul className="divide-y divide-border-default">
            {sortedSessions.map((s) => {
              const treeSummary = summarizeTree(s);
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-overlay"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/workbench/cohorts/${s.id}`}
                      className="block text-sm font-medium text-text-primary hover:text-success"
                    >
                      {s.name}
                    </Link>
                    <p className="flex items-center gap-2 text-[10px] text-text-ghost">
                      <span className="rounded bg-surface-overlay px-1.5 py-0.5 font-mono text-text-secondary">
                        {s.source_key}
                      </span>
                      <span title={new Date(s.last_active_at).toLocaleString()}>
                        {formatRelative(s.last_active_at)}
                      </span>
                      {treeSummary !== null && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-text-secondary">{treeSummary}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <Link
                    to={`/workbench/cohorts/${s.id}`}
                    className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-1 text-[11px] font-medium text-success hover:bg-success/20"
                  >
                    Resume <ArrowRight size={10} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(s)}
                    className="text-text-ghost transition-colors hover:text-text-secondary"
                    aria-label="Duplicate session"
                    title="Duplicate session"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete session "${s.name}"?`)) {
                        deleteMutation.mutate(s.id);
                      }
                    }}
                    className="text-text-ghost transition-colors hover:text-error"
                    aria-label="Delete session"
                    title="Delete session"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Shell>
    </div>
  );
}

// Short shape summary of session_state.operation_tree for the row subtitle.
// "4-cohort UNION" / "3-node tree (MINUS)" / "1 cohort" — null when empty.
function summarizeTree(s: WorkbenchSession): string | null {
  const state = (s.session_state ?? {}) as WorkbenchSessionStateV1;
  const tree = state.operation_tree as unknown;
  if (tree === undefined || tree === null) return null;
  const t = tree as { kind?: string; op?: string; children?: unknown[]; cohort_id?: number };
  if (t.kind === "cohort" && typeof t.cohort_id === "number") return "1 cohort";
  if (t.kind === "op") {
    const count = Array.isArray(t.children) ? t.children.length : 0;
    return `${count}-child ${t.op ?? ""}`.trim();
  }
  return null;
}

// Relative timestamp for the session-row subtitle. Intl.RelativeTimeFormat
// is available in all browsers Parthenon targets; fall back to raw locale
// string on exotic runtimes.
function formatRelative(iso: string): string {
  const delta = (new Date(iso).getTime() - Date.now()) / 1000; // negative = past
  const abs = Math.abs(delta);
  const rtf =
    typeof Intl !== "undefined" && typeof Intl.RelativeTimeFormat === "function"
      ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
      : null;
  if (rtf === null) return new Date(iso).toLocaleString();
  if (abs < 60) return rtf.format(Math.round(delta), "second");
  if (abs < 3600) return rtf.format(Math.round(delta / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(delta / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(delta / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(delta / 2592000), "month");
  return rtf.format(Math.round(delta / 31536000), "year");
}
