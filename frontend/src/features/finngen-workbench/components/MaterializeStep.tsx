// frontend/src/features/finngen-workbench/components/MaterializeStep.tsx
//
// SP4 Polish 2 + v1.0 UX pass — takes the current operation tree (from
// workbenchStore.session_state.operation_tree), a name for the new cohort,
// and dispatches cohort.materialize. Polls the resulting run and surfaces
// the materialized cohort_definition_id back via onMaterialized so the
// parent (WorkbenchPage) can persist it for the Handoff step.
//
// Structure mirrors the Match panel: a config Shell with labeled Sections
// and a sticky footer Run button, plus a separate status Shell for the
// polling result.
import { useState } from "react";
import { AlertCircle, Database, Loader2 } from "lucide-react";
import type { OperationNode } from "../lib/operationTree";
import { compile, listCohortIds, validate } from "../lib/operationTree";
import { useFinnGenRunStatus } from "../hooks/useFinnGenRunStatus";
import { useMaterializeCohort } from "../hooks/useMaterializeCohort";
import { Divider, Section, Shell, StatusStrip } from "@/components/workbench/primitives";

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
  const status = useFinnGenRunStatus(runId);

  const errors = tree !== null ? validate(tree) : [];
  const treeValid = tree !== null && errors.length === 0;
  const treeReferences = tree !== null ? listCohortIds(tree) : [];
  const expression = tree !== null && treeValid ? compile(tree) : null;
  const existingId = existing?.cohortDefinitionId ?? null;
  const canSubmit = treeValid && name.trim().length > 0 && !materialize.isPending;

  function handleSubmit() {
    if (!canSubmit || tree === null) return;
    materialize.mutate(
      {
        source_key: sourceKey,
        name: name.trim(),
        description: description.trim() === "" ? null : description.trim(),
        tree,
        overwrite_cohort_definition_id:
          overwrite && existingId !== null ? existingId : undefined,
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

  if (tree === null) {
    return (
      <Shell
        title="Materialize"
        subtitle="Persist the operation tree as a new cohort_definition."
      >
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <p className="text-xs text-text-secondary">Nothing to materialize yet.</p>
          <p className="text-[10px] text-text-ghost">
            Build an operation tree in the <span className="font-mono">Operate</span> step first,
            then return here.
          </p>
        </div>
      </Shell>
    );
  }

  const runStatus = status.data?.status;
  const isDone = runStatus === "succeeded";

  return (
    <div className="space-y-4">
      <Shell
        title="Materialize"
        subtitle="Persist the operation tree as a new cohort_definition with rows under the source's cohort schema."
      >
        <div className="space-y-4 p-4">
          <Section label="Cohort identity">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">
                New cohort name
              </label>
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
              <label className="text-xs font-medium text-text-secondary">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Why this cohort exists, what it's used for…"
                rows={2}
                className="w-full resize-y rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs"
              />
            </div>
          </Section>

          <Divider />

          <Section label="Operation tree">
            {expression !== null ? (
              <div className="text-[10px] text-text-ghost">
                Will materialize{" "}
                <span className="font-mono text-text-secondary">{expression}</span> (references{" "}
                {treeReferences.length} cohort{treeReferences.length === 1 ? "" : "s"}).
              </div>
            ) : (
              <p className="text-[10px] text-error">
                Tree is invalid ({errors.length} validation error
                {errors.length === 1 ? "" : "s"}). Fix it in the Operate step.
              </p>
            )}
          </Section>

          {existingId !== null && (
            <>
              <Divider />
              <Section label="Overwrite">
                <div className="space-y-1.5 rounded border border-warning/40 bg-warning/5 p-2">
                  <p className="text-[10px] text-warning">
                    This session already materialized cohort{" "}
                    <span className="font-mono">#{existingId}</span>.
                  </p>
                  <label className="flex cursor-pointer items-start gap-2 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={overwrite}
                      onChange={(e) => setOverwrite(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Overwrite cohort #{existingId} (clears its rows and re-inserts).{" "}
                      <span className="text-text-ghost">
                        Uncheck to create a new cohort_definition — useful for A/B testing trees.
                      </span>
                    </span>
                  </label>
                </div>
              </Section>
            </>
          )}
        </div>

        <footer className="sticky bottom-0 border-t border-border-default bg-surface-raised/95 px-4 py-3 backdrop-blur">
          {!canSubmit && name.trim().length === 0 && treeValid && (
            <p className="mb-2 text-[10px] text-warning">Give the new cohort a name.</p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={[
              "flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-xs font-medium transition-colors",
              !canSubmit
                ? "cursor-not-allowed bg-surface-overlay text-text-ghost"
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
            <p className="mt-2 text-[10px] text-error">{materialize.error.message}</p>
          )}
        </footer>
      </Shell>

      {runId !== null && (
        <Shell
          title="Materialize run"
          subtitle="Status and subject count for the active cohort.materialize run."
        >
          <StatusStrip status={runStatus ?? "…"} runId={runId} />
          <div className="space-y-1.5 px-4 pb-4 text-xs">
            {cohortId !== null && (
              <p className="text-[10px] text-text-ghost">
                Target cohort_definition_id:{" "}
                <span className="font-mono text-text-secondary">{cohortId}</span>
              </p>
            )}
            {isDone && status.data !== undefined && (
              <p className="text-success">
                Materialized{" "}
                <span className="font-mono">
                  {(
                    status.data as unknown as { summary?: { subject_count?: number } }
                  ).summary?.subject_count?.toLocaleString() ?? "?"}
                </span>{" "}
                subjects. Proceed to Handoff.
              </p>
            )}
            {(runStatus === "failed" || runStatus === "canceled") && (
              <p className="flex items-center gap-1.5 text-error">
                <AlertCircle size={12} />
                {(status.data as unknown as { error?: { message?: string } }).error?.message ??
                  "Run failed — check logs."}
              </p>
            )}
          </div>
        </Shell>
      )}
    </div>
  );
}
