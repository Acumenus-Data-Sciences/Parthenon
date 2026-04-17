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
import { RecentRunsPanel } from "../components/RecentRunsPanel";
import { WorkbenchStepper } from "../components/WorkbenchStepper";
import { WORKBENCH_STEPS, type WorkbenchStepKey } from "../lib/workbenchSteps";
import {
  useAutosaveWorkbenchSession,
  useWorkbenchSession,
} from "../hooks/useWorkbenchSession";
import { useMatchCohort } from "../hooks/useMatchCohort";
import { useWorkbenchStore } from "../stores/workbenchStore";
import type { OperationNode } from "../lib/operationTree";
import type { MatchedCohortPromotion } from "../types";

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

  // Persisted list of run ids dispatched from this session (Phase polish #4
  // — run history). Appended in chronological order; cap applied at render.
  const recentRunIds: string[] = Array.isArray(sessionState.recent_run_ids)
    ? (sessionState.recent_run_ids as string[])
    : [];
  const pushRecentRunId = (runId: string) => {
    if (recentRunIds.includes(runId)) return;
    useWorkbenchStore.getState().patchState({
      recent_run_ids: [...recentRunIds, runId].slice(-50), // hard cap on persisted list
    });
  };

  // Hydrate the store from the loaded session once. v1.0 dropped the
  // "select-source" placeholder step; sessions persisted under the old
  // 6-step order may open on the step one index ahead of where the
  // researcher left off. We accept that one-time drift instead of running a
  // client-side step migration — the earlier attempt re-ran every load
  // because schema_version wasn't bumped server-side, eventually pinning
  // sessions at step 0. Users can click the stepper once to re-orient.
  useEffect(() => {
    if (session !== undefined && sessionId !== undefined) {
      loadSession(sessionId, session.session_state ?? {});
    }
  }, [session, sessionId, loadSession]);

  // Autosave on any sessionState change + expose status to the header badge.
  const autosave = useAutosaveWorkbenchSession(sessionId ?? null, sessionState, 5_000);

  const stepIndex = typeof sessionState.step === "number" ? sessionState.step : 0;
  const currentStep = WORKBENCH_STEPS[stepIndex]?.key ?? "import-cohorts";

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
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold text-text-primary">
                {session.name}
              </h1>
              <span
                className="inline-flex shrink-0 items-center rounded bg-info/10 px-2 py-0.5 font-mono text-[10px] font-medium text-info"
                title="Data source this session is bound to"
              >
                {session.source_key}
              </span>
            </div>
            <p className="text-[10px] text-text-ghost">
              session {session.id.slice(0, 8)}…
            </p>
          </div>
          <AutosaveBadge status={autosave} />
        </div>
        <WorkbenchStepper current={currentStep} completed={completed} onStepChange={goToStep} />
      </header>

      <main className="space-y-4">
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,22rem)_1fr] md:items-start">
            <MatchingConfigForm
              sourceKey={session.source_key}
              loading={matchMutation.isPending}
              onSubmit={(payload) => {
                matchMutation.mutate(payload, {
                  onSuccess: (run) => {
                    setMatchRunId(run.id);
                    pushRecentRunId(run.id);
                  },
                });
              }}
            />
            <MatchingResults
              runId={matchRunId}
              promotion={
                matchRunId !== null
                  ? (sessionState.matched_cohort_promotions as
                      | Record<string, MatchedCohortPromotion>
                      | undefined)?.[matchRunId]
                  : undefined
              }
              onPromote={(p) => {
                const prior =
                  (sessionState.matched_cohort_promotions as
                    | Record<string, MatchedCohortPromotion>
                    | undefined) ?? {};
                useWorkbenchStore.getState().patchState({
                  matched_cohort_promotions: { ...prior, [p.run_id]: p },
                });
              }}
            />
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
              pushRecentRunId(runId);
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
            matchedPromotions={Object.values(
              (sessionState.matched_cohort_promotions as
                | Record<string, MatchedCohortPromotion>
                | undefined) ?? {},
            )}
            navigate={navigate}
          />
        )}

        {/* Polish — run history persisted in session_state */}
        {recentRunIds.length > 0 && (
          <RecentRunsPanel
            runIds={recentRunIds}
            activeRunId={matchRunId}
            onSelect={(runId, analysisType) => {
              if (analysisType === "cohort.match") {
                setMatchRunId(runId);
                goToStep("match");
              } else if (analysisType === "cohort.materialize") {
                goToStep("materialize");
              }
            }}
          />
        )}
      </main>
    </div>
  );
}

function HandoffStep({
  sourceKey,
  materializedCohortId,
  matchedPromotions,
  navigate,
}: {
  sourceKey: string;
  materializedCohortId: number | null;
  matchedPromotions: MatchedCohortPromotion[];
  navigate: (path: string) => void;
}) {
  const ready = materializedCohortId !== null;
  const hasPromotions = matchedPromotions.length > 0;

  // SP4 Polish 2 completion — hand off to the standalone FinnGen Analysis
  // Gallery (not the investigation page). FinnGenAnalysesStandalonePage reads
  // source_key + workbench_cohort_id from the URL and pre-populates the
  // SettingsForm defaults via AnalysisDetailPage.defaultCohortId.
  const destination = ready
    ? `/workbench/finngen-analyses?source_key=${encodeURIComponent(sourceKey)}&workbench_cohort_id=${materializedCohortId}`
    : `/workbench/finngen-analyses?source_key=${encodeURIComponent(sourceKey)}`;

  // v1.0 UX — when neither a materialized cohort nor any promoted matches
  // exist, show a single focused CTA instead of two empty panels.
  if (!ready && !hasPromotions) {
    return (
      <div className="rounded-lg border border-dashed border-border-default bg-surface-raised p-8 text-center">
        <h2 className="text-sm font-semibold text-text-secondary">Nothing to hand off yet</h2>
        <p className="mx-auto mt-1 max-w-md text-xs text-text-ghost">
          Finish the <span className="font-mono">Materialize</span> step to persist your operation
          tree as a cohort, or promote a succeeded <span className="font-mono">Match</span> run to
          bring matched comparator cohorts forward. Either will enable handoff to the Analysis
          Gallery.
        </p>
        <button
          type="button"
          onClick={() => navigate(destination)}
          className="mt-4 inline-flex items-center gap-2 rounded border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised"
        >
          <ExternalLink size={12} />
          Open {sourceKey} Analysis Gallery without a pre-selected cohort
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-border-default bg-surface-raised p-6">
        <h2 className="text-sm font-semibold text-text-secondary">
          Handoff: materialized cohort
        </h2>
        {ready ? (
          <p className="text-xs text-text-secondary">
            Materialized cohort <span className="font-mono">#{materializedCohortId}</span> is ready.
            Open it directly in a CO2 analysis (CodeWAS, Demographics, Overlaps, timeCodeWAS).
          </p>
        ) : (
          <p className="text-xs text-text-ghost">
            Materialize the operation tree in the previous step to enable hand-off of your tree as
            a cohort. You can still open the gallery empty and pick a cohort manually.
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

      {hasPromotions && (
        <div className="space-y-3 rounded-lg border border-border-default bg-surface-raised p-6">
          <div>
            <h2 className="text-sm font-semibold text-text-secondary">
              Handoff: matched comparator cohorts
            </h2>
            <p className="text-[10px] text-text-ghost">
              Promoted from cohort.match runs in this session. Open any as the primary cohort in an
              analysis, or pair with the materialized cohort for comparative studies.
            </p>
          </div>
          <ul className="space-y-2">
            {matchedPromotions.map((p) => (
              <li
                key={p.run_id}
                className="flex flex-wrap items-center gap-3 rounded border border-border-default bg-surface-overlay/40 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-primary">
                    <span className="font-mono text-text-secondary">#{p.cohort_definition_id}</span>{" "}
                    · {p.name}
                  </p>
                  <p className="text-[10px] text-text-ghost">
                    Primary #{p.primary_cohort_id} vs [
                    {p.comparator_cohort_ids.map((id) => "#" + id).join(", ")}] at 1:{p.ratio}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/workbench/finngen-analyses?source_key=${encodeURIComponent(sourceKey)}` +
                        `&workbench_cohort_id=${p.cohort_definition_id}`,
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded bg-success px-2.5 py-1 text-[11px] font-medium text-bg-canvas hover:bg-success/90"
                >
                  <ExternalLink size={11} />
                  Open in gallery
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
