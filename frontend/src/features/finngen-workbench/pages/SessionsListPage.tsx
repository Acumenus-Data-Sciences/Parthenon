// frontend/src/features/finngen-workbench/pages/SessionsListPage.tsx
//
// SP4 Phase F.2 — list saved cohort-workbench sessions, create new ones,
// resume an existing one. Source picker reuses the platform-wide
// fetchSources for consistency with the rest of Parthenon.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, ArrowRight, Copy, GitMerge } from "lucide-react";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import {
  useCreateWorkbenchSession,
  useDeleteWorkbenchSession,
  useWorkbenchSessions,
} from "../hooks/useWorkbenchSession";
import type { WorkbenchSession, WorkbenchSessionStateV1 } from "../types";

export default function SessionsListPage() {
  const navigate = useNavigate();
  const sessions = useWorkbenchSessions();
  const sourcesQuery = useQuery({ queryKey: ["sources"], queryFn: fetchSources, staleTime: 5 * 60 * 1000 });
  const createMutation = useCreateWorkbenchSession();
  const deleteMutation = useDeleteWorkbenchSession();

  const [newName, setNewName] = useState("Untitled session");
  const [newSourceKey, setNewSourceKey] = useState("");

  function handleCreate() {
    if (newSourceKey === "" || newName.trim() === "") return;
    createMutation.mutate(
      { source_key: newSourceKey, name: newName.trim(), session_state: { step: 0 } },
      {
        onSuccess: (created) => navigate(`/workbench/cohorts/${created.id}`),
      },
    );
  }

  function handleDuplicate(session: WorkbenchSession) {
    // Duplicates the operation tree + current step, strips run-scoped state
    // (recent_run_ids, materialized_cohort_id, materialize_run_id) so the
    // copy starts fresh on the run side.
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

  return (
    <div className="space-y-6 p-4">
      <header>
        <h1 className="text-lg font-semibold text-text-primary">Cohort Workbench</h1>
        <p className="text-xs text-text-ghost">
          Compose, match, and materialize cohorts. Hand off to the Analysis Gallery when ready.
        </p>
      </header>

      <section className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-ghost">New session</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:items-end">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-text-ghost">Name</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-text-ghost">Source</span>
            <select
              value={newSourceKey}
              onChange={(e) => setNewSourceKey(e.target.value)}
              className="w-full rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs"
            >
              <option value="">— pick a source —</option>
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
            disabled={newSourceKey === "" || newName.trim() === "" || createMutation.isPending}
            className={[
              "flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
              newSourceKey === "" || createMutation.isPending
                ? "bg-surface-overlay text-text-ghost cursor-not-allowed"
                : "bg-success text-bg-canvas hover:bg-success/90",
            ].join(" ")}
          >
            {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Create session
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-ghost">Your sessions</h2>
        {sessions.isPending && (
          <div className="flex items-center gap-2 text-xs text-text-ghost">
            <Loader2 size={12} className="animate-spin" /> Loading...
          </div>
        )}
        {sessions.isError && (
          <p className="text-xs text-error">Failed to load sessions.</p>
        )}
        {sessions.data?.length === 0 && (
          <div className="rounded-lg border border-dashed border-border-default bg-surface-raised p-8 text-center">
            <GitMerge size={32} className="mx-auto mb-3 text-text-ghost" />
            <p className="text-sm font-medium text-text-secondary">No sessions yet</p>
            <p className="mt-1 text-xs text-text-ghost max-w-md mx-auto">
              A session captures one cohort-composition workflow: import → operate (UNION/INTERSECT/MINUS) →
              preview counts → match → materialize → hand off to the Analysis Gallery. Start one above.
            </p>
          </div>
        )}
        {sessions.data && sessions.data.length > 0 && (
          <ul className="divide-y divide-border-default rounded-lg border border-border-default bg-surface-raised">
            {sessions.data.map((s) => {
              const treeSummary = summarizeTree(s);
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-surface-overlay transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/workbench/cohorts/${s.id}`}
                      className="block text-sm font-medium text-text-primary hover:text-success"
                    >
                      {s.name}
                    </Link>
                    <p className="text-[10px] text-text-ghost flex items-center gap-2">
                      <span>{s.source_key}</span>
                      <span>·</span>
                      <span>last active {new Date(s.last_active_at).toLocaleString()}</span>
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
                    className="text-xs text-success hover:underline inline-flex items-center gap-1"
                  >
                    Resume <ArrowRight size={10} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(s)}
                    className="text-text-ghost hover:text-text-secondary transition-colors"
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
                    className="text-text-ghost hover:text-error transition-colors"
                    aria-label="Delete session"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
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
