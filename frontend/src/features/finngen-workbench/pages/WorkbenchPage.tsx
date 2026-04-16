// frontend/src/features/finngen-workbench/pages/WorkbenchPage.tsx
//
// SP4 Phase F.1 — top-level workbench shell. Loads a session by id from the
// URL, hydrates the Zustand store, and renders the active step. Autosave
// (Phase A's hook) PATCHes session_state on any change.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft, ExternalLink } from "lucide-react";
import { OperationBuilder } from "../components/OperationBuilder";
import { MatchingConfigForm } from "../components/MatchingConfigForm";
import { MatchingResults } from "../components/MatchingResults";
import { MaterializeStep } from "../components/MaterializeStep";
import { ImportCohortsStep } from "../components/ImportCohortsStep";
import { AutosaveBadge } from "../components/AutosaveBadge";
import {
  WorkbenchStepper,
  WORKBENCH_STEPS,
  type WorkbenchStepKey,
} from "../components/WorkbenchStepper";
import {
  useAutosaveWorkbenchSession,
  useWorkbenchSession,
} from "../hooks/useWorkbenchSession";
import { useMatchCohort } from "../hooks/useMatchCohort";
import { useWorkbenchStore } from "../stores/workbenchStore";
import type { OperationNode } from "../lib/operationTree";

export default function WorkbenchPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { data: session, isPending, isError } = useWorkbenchSession(sessionId ?? null);

  const sessionState = useWorkbenchStore((s) => s.sessionState);
  const loadSession = useWorkbenchStore((s) => s.loadSession);
  const setOperationTree = useWorkbenchStore((s) => s.setOperationTree);
  const setStep = useWorkbenchStore((s) => s.setStep);

  const [matchRunId, setMatchRunId] = useState<string | null>(null);
  const matchMutation = useMatchCohort();

  // Hydrate the store from the loaded session once.
  useEffect(() => {
    if (session !== undefined && sessionId !== undefined) {
      loadSession(sessionId, session.session_state ?? {});
    }
  }, [session, sessionId, loadSession]);

  // Autosave on any sessionState change + expose status to the header badge.
  const autosave = useAutosaveWorkbenchSession(sessionId ?? null, sessionState, 5_000);

  const stepIndex = typeof sessionState.step === "number" ? sessionState.step : 0;
  const currentStep = WORKBENCH_STEPS[stepIndex]?.key ?? "select-source";

  const completed = useMemo(() => {
    const set = new Set<WorkbenchStepKey>();
    for (let i = 0; i < stepIndex; i++) {
      const k = WORKBENCH_STEPS[i]?.key;
      if (k) set.add(k);
    }
    return set;
  }, [stepIndex]);

  function goToStep(key: WorkbenchStepKey) {
    const idx = WORKBENCH_STEPS.findIndex((s) => s.key === key);
    if (idx >= 0) setStep(idx);
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-text-secondary">
        <Loader2 size={16} className="animate-spin" /> Loading workbench session...
      </div>
    );
  }
  if (isError || session === undefined) {
    return (
      <div className="mx-auto max-w-xl p-6 space-y-3 text-sm">
        <h1 className="text-base font-semibold text-error">Workbench session unavailable</h1>
        <p className="text-text-secondary">
          This session may have been deleted, or you don't have permission to open it.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <Link
            to="/workbench/cohorts"
            className="inline-flex items-center gap-1 rounded bg-success px-3 py-1.5 text-xs font-medium text-bg-canvas hover:bg-success/90"
          >
            <ArrowLeft size={12} /> Back to sessions
          </Link>
          <Link to="/workbench" className="text-xs text-text-ghost hover:text-text-secondary">
            Workbench launcher
          </Link>
        </div>
      </div>
    );
  }

  const tree = (sessionState.operation_tree as OperationNode | null | undefined) ?? null;

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-2">
        <Link
          to="/workbench/cohorts"
          className="inline-flex items-center gap-1 text-xs text-text-ghost hover:text-text-secondary"
        >
          <ArrowLeft size={12} /> All sessions
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">{session.name}</h1>
            <p className="text-xs text-text-ghost">
              {session.source_key} · session {session.id.slice(0, 8)}…
            </p>
          </div>
          <AutosaveBadge status={autosave} />
        </div>
        <WorkbenchStepper current={currentStep} completed={completed} onStepChange={goToStep} />
      </header>

      <main className="space-y-4">
        {currentStep === "select-source" && (
          <PlaceholderStep title="Source already selected">
            <p className="text-xs text-text-secondary">
              This session is bound to <span className="font-mono">{session.source_key}</span>.
              Source switching is deferred to a future phase.
            </p>
          </PlaceholderStep>
        )}

        {currentStep === "import-cohorts" && (
          <ImportCohortsStep
            tree={tree}
            onImport={(next) => setOperationTree(next)}
            onAdvance={() => goToStep("operate")}
          />
        )}

        {currentStep === "operate" && (
          <OperationBuilder
            tree={tree}
            onChange={(next) => setOperationTree(next)}
            sourceKey={session.source_key}
          />
        )}

        {currentStep === "match" && (
          <div className="space-y-3">
            <MatchingConfigForm
              sourceKey={session.source_key}
              loading={matchMutation.isPending}
              onSubmit={(payload) => {
                matchMutation.mutate(payload, {
                  onSuccess: (run) => setMatchRunId(run.id),
                });
              }}
            />
            <MatchingResults runId={matchRunId} />
          </div>
        )}

        {currentStep === "materialize" && (
          <MaterializeStep
            sourceKey={session.source_key}
            tree={tree}
            existing={
              typeof sessionState.materialized_cohort_id === "number"
                ? {
                    runId:
                      typeof sessionState.materialize_run_id === "string"
                        ? sessionState.materialize_run_id
                        : "",
                    cohortDefinitionId: sessionState.materialized_cohort_id,
                  }
                : null
            }
            onMaterialized={({ runId, cohortDefinitionId }) => {
              useWorkbenchStore.getState().patchState({
                materialize_run_id: runId,
                materialized_cohort_id: cohortDefinitionId,
              });
            }}
          />
        )}

        {currentStep === "handoff" && (
          <HandoffStep
            sourceKey={session.source_key}
            materializedCohortId={
              typeof sessionState.materialized_cohort_id === "number"
                ? sessionState.materialized_cohort_id
                : null
            }
            navigate={navigate}
          />
        )}
      </main>
    </div>
  );
}

function PlaceholderStep({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border-default p-6">
      <h2 className="mb-2 text-sm font-semibold text-text-secondary">{title}</h2>
      {children}
    </div>
  );
}

function HandoffStep({
  sourceKey,
  materializedCohortId,
  navigate,
}: {
  sourceKey: string;
  materializedCohortId: number | null;
  navigate: (path: string) => void;
}) {
  const ready = materializedCohortId !== null;
  // SP4 Polish 2 completion — hand off to the standalone FinnGen Analysis
  // Gallery (not the investigation page). FinnGenAnalysesStandalonePage reads
  // source_key + workbench_cohort_id from the URL and pre-populates the
  // SettingsForm defaults via AnalysisDetailPage.defaultCohortId.
  const destination = ready
    ? `/workbench/finngen-analyses?source_key=${encodeURIComponent(sourceKey)}&workbench_cohort_id=${materializedCohortId}`
    : `/workbench/finngen-analyses?source_key=${encodeURIComponent(sourceKey)}`;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-6 space-y-3">
      <h2 className="text-sm font-semibold text-text-secondary">Handoff to Analysis Gallery</h2>
      {ready ? (
        <p className="text-xs text-text-secondary">
          Materialized cohort <span className="font-mono">#{materializedCohortId}</span> is ready.
          Open it directly in a CO2 analysis (CodeWAS, Demographics, Overlaps, timeCodeWAS).
        </p>
      ) : (
        <p className="text-xs text-text-ghost">
          Materialize the operation tree in the previous step to enable hand-off. You can also
          open the gallery empty and pick a cohort manually.
        </p>
      )}
      <button
        type="button"
        onClick={() => navigate(destination)}
        className={[
          "inline-flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-colors",
          ready
            ? "bg-success text-bg-canvas hover:bg-success/90"
            : "border border-border-default bg-surface-overlay text-text-secondary hover:bg-surface-raised",
        ].join(" ")}
      >
        <ExternalLink size={12} />
        {ready
          ? `Open cohort #${materializedCohortId} in Analysis Gallery`
          : `Open ${sourceKey} in Analysis Gallery`}
      </button>
    </div>
  );
}
