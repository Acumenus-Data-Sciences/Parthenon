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
import { tAuto } from "@/i18n/autoUserFacing";

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
        title={tAuto("materialize_8e5c1300")}
        subtitle="Persist the operation tree as a new cohort_definition."
      >
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <p className="text-xs text-text-secondary">{tAuto("nothingToMaterializeYet_dbb86da2")}</p>
          <p className="text-[10px] text-text-ghost">
            {tAuto("buildAnOperationTreeInThe_cde6dad8")} <span className="font-mono">{tAuto("operate_3c1a1d23")}</span> {tAuto("stepFirstThenReturnHere_c307752a")}
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
        title={tAuto("materialize_8e5c1300")}
        subtitle="Persist the operation tree as a new cohort_definition with rows under the source's cohort schema."
      >
        <div className="space-y-4 p-4">
          <Section label="Cohort identity">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">
                {tAuto("newCohortName_a0fdcf15")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tAuto("eGResectablePdacOnFolfirinox_26a8faf0")}
                maxLength={255}
                className="w-full rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">
                {tAuto("descriptionOptional_388de6fa")}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={tAuto("whyThisCohortExistsWhatItSUsed_268d8201")}
                rows={2}
                className="w-full resize-y rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs"
              />
            </div>
          </Section>

          <Divider />

          <Section label="Operation tree">
            {expression !== null ? (
              <div className="text-[10px] text-text-ghost">
                {tAuto("willMaterialize_2ded7b0a")}{" "}
                <span className="font-mono text-text-secondary">{expression}</span> {tAuto("references_e67e46f1")}{" "}
                {treeReferences.length} cohort{treeReferences.length === 1 ? "" : "s"}).
              </div>
            ) : (
              <p className="text-[10px] text-error">
                {tAuto("treeIsInvalid_4ca7eabd")}{errors.length} {tAuto("validationError_b2e440b8")}
                {errors.length === 1 ? "" : "s"}{tAuto("fixItInTheOperateStep_08a1a1c0")}
              </p>
            )}
          </Section>

          {existingId !== null && (
            <>
              <Divider />
              <Section label="Overwrite">
                <div className="space-y-1.5 rounded border border-warning/40 bg-warning/5 p-2">
                  <p className="text-[10px] text-warning">
                    {tAuto("thisSessionAlreadyMaterializedCohort_5d4a7d42")}{" "}
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
                      {tAuto("overwriteCohort_ce60b27b")}{existingId} {tAuto("clearsItsRowsAndReInserts_a51fe130")}{" "}
                      <span className="text-text-ghost">
                        {tAuto("uncheckToCreateANewCohortDefinitionUseful_7aee8ec4")}
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
            <p className="mb-2 text-[10px] text-warning">{tAuto("giveTheNewCohortAName_52f41079")}</p>
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
            {tAuto("materializeCohort_8a17006a")}
          </button>
          {materialize.isError && (
            <p className="mt-2 text-[10px] text-error">{materialize.error.message}</p>
          )}
        </footer>
      </Shell>

      {runId !== null && (
        <Shell
          title={tAuto("materializeRun_f8b80ab8")}
          subtitle="Status and subject count for the active cohort.materialize run."
        >
          <StatusStrip status={runStatus ?? "…"} runId={runId} />
          <div className="space-y-1.5 px-4 pb-4 text-xs">
            {cohortId !== null && (
              <p className="text-[10px] text-text-ghost">
                {tAuto("targetCohortDefinitionId_d0028658")}{" "}
                <span className="font-mono text-text-secondary">{cohortId}</span>
              </p>
            )}
            {isDone && status.data !== undefined && (
              <p className="text-success">
                {tAuto("materialized_fccd01d6")}{" "}
                <span className="font-mono">
                  {(
                    status.data as unknown as { summary?: { subject_count?: number } }
                  ).summary?.subject_count?.toLocaleString() ?? "?"}
                </span>{" "}
                {tAuto("subjectsProceedToHandoff_d269a54f")}
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
