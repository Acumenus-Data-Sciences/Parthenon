// frontend/src/features/finngen-workbench/components/MaterializeStep.tsx
//
// SP4 Polish 2 — replaces the Phase F placeholder. Takes the current
// operation tree (from workbenchStore.session_state.operation_tree), a name
// for the new cohort, and dispatches cohort.materialize. Polls the resulting
// run and surfaces the materialized cohort_definition_id back via onMaterialized
// so the parent (WorkbenchPage) can persist it to session_state for Handoff.
import { useState } from "react";
import { Loader2, Database, AlertCircle, CheckCircle2 } from "lucide-react";
import type { OperationNode } from "../lib/operationTree";
import { compile, listCohortIds, validate } from "../lib/operationTree";
import { useMaterializeCohort } from "../hooks/useMaterializeCohort";
import { useMatchRunStatus } from "../hooks/useMatchCohort";

interface MaterializeStepProps {
  sourceKey: string;
  tree: OperationNode | null;
  onMaterialized: (info: { runId: string; cohortDefinitionId: number }) => void;
  existing?: { runId: string; cohortDefinitionId: number } | null;
}

export function MaterializeStep({
  sourceKey,
  tree,
  onMaterialized,
  existing,
}: MaterializeStepProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [runId, setRunId] = useState<string | null>(existing?.runId ?? null);
  const [cohortId, setCohortId] = useState<number | null>(existing?.cohortDefinitionId ?? null);
  // SP4 Polish #7 — when a prior cohort is materialized, default to
  // overwriting it on re-run instead of piling up new cohort_definitions.
  const [overwrite, setOverwrite] = useState<boolean>(existing?.cohortDefinitionId !== undefined);
  const materialize = useMaterializeCohort();
  const status = useMatchRunStatus(runId);

  const errors = tree !== null ? validate(tree) : [];
  const treeValid = tree !== null && errors.length === 0;
  const treeReferences = tree !== null ? listCohortIds(tree) : [];
  const canSubmit = treeValid && name.trim().length > 0 && !materialize.isPending;

  const expression = tree !== null && treeValid ? compile(tree) : null;
  const existingId = existing?.cohortDefinitionId ?? null;

  function handleSubmit() {
    if (!canSubmit || tree === null) return;
    materialize.mutate(
      {
        source_key: sourceKey,
        name: name.trim(),
        description: description.trim() === "" ? null : description.trim(),
        tree,
        overwrite_cohort_definition_id: overwrite && existingId !== null ? existingId : undefined,
      },
      {
        onSuccess: (data) => {
          setRunId(data.run.id);
          setCohortId(data.cohort_definition_id);
          onMaterialized({ runId: data.run.id, cohortDefinitionId: data.cohort_definition_id });
        },
      },
    );
  }

  const runStatus = status.data?.status;
  const isRunning = runStatus === "queued" || runStatus === "running";
  const isDone = runStatus === "succeeded";
  const isFailed = runStatus === "failed" || runStatus === "canceled";

  return (
    <div className="space-y-4">
      {tree === null && (
        <div className="rounded border border-dashed border-border-default p-6 text-center text-xs text-text-ghost">
          Build an operation tree in the Operate step first, then return here to materialize it.
        </div>
      )}

      {tree !== null && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary">New cohort name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Resectable PDAC on FOLFIRINOX"
              maxLength={255}
              className="w-full rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why this cohort exists, what it's used for…"
              rows={2}
              className="w-full rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs resize-y"
            />
          </div>
          {expression !== null && (
            <div className="text-[10px] text-text-ghost">
              Will materialize: <span className="font-mono text-text-secondary">{expression}</span>{" "}
              (references {treeReferences.length} cohort{treeReferences.length === 1 ? "" : "s"})
            </div>
          )}
          {!treeValid && errors.length > 0 && (
            <p className="text-[10px] text-error">
              Tree is invalid ({errors.length} validation error{errors.length === 1 ? "" : "s"}). Fix it in the Operate step.
            </p>
          )}
          {existingId !== null && (
            <div className="rounded border border-warning/40 bg-warning/5 p-2 space-y-1.5">
              <p className="text-[10px] text-warning">
                This session already materialized cohort <span className="font-mono">#{existingId}</span>.
              </p>
              <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Overwrite cohort #{existingId} (clears its rows and re-inserts).{" "}
                  <span className="text-text-ghost">
                    Uncheck to create a new cohort_definition instead — useful when you want to A/B test two trees.
                  </span>
                </span>
              </label>
            </div>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={[
              "flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-xs font-medium transition-colors",
              !canSubmit
                ? "bg-surface-overlay text-text-ghost cursor-not-allowed"
                : "bg-success text-bg-canvas hover:bg-success/90",
            ].join(" ")}
          >
            {materialize.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Database size={12} />
            )}
            Materialize cohort
          </button>
          {materialize.isError && (
            <p className="text-xs text-error">{materialize.error.message}</p>
          )}
        </div>
      )}

      {runId !== null && (
        <div className="rounded border border-border-default bg-surface-raised p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            {isRunning && <Loader2 size={14} className="animate-spin text-info" />}
            {isDone && <CheckCircle2 size={14} className="text-success" />}
            {isFailed && <AlertCircle size={14} className="text-error" />}
            <span className={isFailed ? "text-error" : "text-text-secondary"}>
              Status: <span className="font-mono">{runStatus ?? "…"}</span>
            </span>
            {isRunning && <span className="text-text-ghost">polling every 2s</span>}
          </div>
          {cohortId !== null && (
            <p className="text-[10px] text-text-ghost">
              Target cohort_definition_id:{" "}
              <span className="font-mono text-text-secondary">{cohortId}</span>
            </p>
          )}
          {isDone && status.data !== undefined && (
            <p className="text-xs text-success">
              Materialized{" "}
              <span className="font-mono">
                {(status.data as unknown as { summary?: { subject_count?: number } }).summary
                  ?.subject_count?.toLocaleString() ?? "?"}
              </span>{" "}
              subjects. Proceed to Handoff.
            </p>
          )}
          {isFailed && (
            <p className="text-xs text-error">
              {(status.data as unknown as { error?: { message?: string } }).error?.message ??
                "Run failed — check logs."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
