import { useMemo } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { tAuto } from "@/i18n/autoUserFacing";
import { cn } from "@/lib/utils";
import type { StudyFeasibilityResult } from "../../../types/study";
import type { useStudyDesignWorkbench } from "../../../hooks/useStudyDesignWorkbench";
import { ActionGateHint } from "../../workbench/shared/ActionGateHint";
import { arrayValue } from "../../workbench/studyDesignWorkbenchHelpers";
import {
  buildAttritionSteps,
  buildIssueRows,
  buildReadinessCards,
  formatCount,
  pickPrimaryFeasibility,
  pickPrimarySource,
  relativeFromNow,
  type ReadinessStatus,
} from "./feasibilityHelpers";

// Station 05 — Feasibility (single-CDM, per Decision Q4).
//
// Renders a 5-card readiness grid (target / comparator / outcome / PS
// covariates / DQD), an attrition waterfall derived from the bound CDM's
// feasibility result, and an issues list. The federation heatmap remains
// deferred to a future multi-site phase.
//
// Reuses the v1 mutation surface unchanged: `handleRunFeasibility` is
// invoked with the single bound CDM's source id (selected via the
// readiness-payload heuristic; falls back to an empty array so the
// backend uses its default CDM resolution).

type Workbench = ReturnType<typeof useStudyDesignWorkbench>;

interface FeasibilityViewProps {
  workbench: Pick<
    Workbench,
    | "assets"
    | "cohortReadinessQuery"
    | "selectedSession"
    | "selectedVersion"
    | "handleRunFeasibility"
    | "runFeasibility"
  >;
}

function statusGlyph(status: ReadinessStatus): string {
  if (status === "ready") return "✓";
  if (status === "partial") return "⚠";
  return "✗";
}

export function FeasibilityView({ workbench }: FeasibilityViewProps): JSX.Element {
  const {
    assets,
    cohortReadinessQuery,
    selectedSession,
    selectedVersion,
    handleRunFeasibility,
    runFeasibility,
  } = workbench;

  const feasibility = useMemo(() => pickPrimaryFeasibility(assets), [assets]);
  const readiness = cohortReadinessQuery.data ?? null;
  const readinessLoading = cohortReadinessQuery.isLoading === true;
  const cohortsReady =
    readiness?.ready_for_feasibility === true || readiness?.ready === true;
  const isRunning = runFeasibility.isPending || feasibility?.status === "running";

  const cards = useMemo(
    () => (feasibility ? buildReadinessCards(feasibility, assets) : []),
    [feasibility, assets],
  );
  const attritionSteps = useMemo(
    () => (feasibility ? buildAttritionSteps(feasibility) : []),
    [feasibility],
  );
  const issueRows = useMemo(
    () => (feasibility ? buildIssueRows(feasibility) : []),
    [feasibility],
  );

  const runGate = !selectedSession || !selectedVersion
    ? tAuto("studies.v2.feasibility.gate.noVersion")
    : readinessLoading
      ? tAuto("studies.v2.feasibility.gate.checkingReadiness")
      : readiness == null
        ? tAuto("studies.v2.feasibility.gate.noReadiness")
        : !cohortsReady
          ? tAuto("studies.v2.feasibility.gate.linkCohorts")
          : null;
  const canRun = runGate == null && !isRunning;

  const lastRunRelative = feasibility?.ran_at
    ? relativeFromNow(feasibility.ran_at)
    : tAuto("studies.v2.feasibility.never");

  const primarySource = feasibility ? pickPrimarySource(feasibility) : null;
  const freshnessDays = primarySource?.coverage?.freshness?.days_since_release ?? null;
  const freshnessRelative = freshnessDays != null
    ? tAuto("studies.v2.feasibility.daysFresh", { count: freshnessDays })
    : tAuto("studies.v2.feasibility.unknown");

  const runFeasibilityNow = (): void => {
    // Single-CDM: reuse the source id from the previous run if present,
    // otherwise pass an empty array so the backend picks the bound CDM.
    const sourceIds: number[] = [];
    if (feasibility) {
      const sources = arrayValue<NonNullable<StudyFeasibilityResult["sources"]>[number]>(
        feasibility.sources,
      );
      for (const source of sources) {
        if (typeof source.source_id === "number") {
          sourceIds.push(source.source_id);
          break;
        }
      }
    }
    handleRunFeasibility(sourceIds, feasibility?.min_cell_count ?? 5);
  };

  return (
    <div className="feasibility-view">
      <header className="feasibility-header">
        <div className="feasibility-header-text">
          <div className="feasibility-header-eyebrow wb-mono">
            {tAuto("studies.v2.feasibility.stageLabel")}
          </div>
          <h2 className="feasibility-header-title wb-serif">
            {tAuto("studies.v2.feasibility.title")}
          </h2>
          <p className="feasibility-header-meta wb-mono">
            {tAuto("studies.v2.feasibility.lastRun", { time: lastRunRelative })}
            <span aria-hidden="true"> · </span>
            {tAuto("studies.v2.feasibility.dbFreshness", { time: freshnessRelative })}
          </p>
        </div>
        <div className="feasibility-header-action">
          <button
            type="button"
            className="btn-accept"
            onClick={runFeasibilityNow}
            disabled={!canRun}
            title={runGate ?? undefined}
          >
            {isRunning ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={13} aria-hidden="true" />
            )}
            {tAuto("studies.v2.feasibility.runFeasibility")}
          </button>
          <ActionGateHint message={runGate} />
        </div>
      </header>

      {isRunning ? (
        <div className="feasibility-running wb-mono" role="status" aria-live="polite">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          <span>{tAuto("studies.v2.feasibility.running")}</span>
        </div>
      ) : !feasibility ? (
        <div className="feasibility-empty wb-mono">
          {tAuto("studies.v2.feasibility.emptyState")}
        </div>
      ) : (
        <>
          <div className="feasibility-grid">
            {cards.map((card) => (
              <article
                key={card.eyebrow}
                className={cn("feasibility-card", card.status)}
                title={card.detail}
                aria-label={card.label}
              >
                <div className="feasibility-card-eyebrow wb-mono">{card.eyebrow}</div>
                <div className="feasibility-card-value wb-serif">{card.value}</div>
                <div className="feasibility-card-sublabel wb-mono">{card.subLabel}</div>
                <div
                  className={cn("feasibility-card-status wb-mono", card.status)}
                  aria-label={tAuto(`studies.v2.feasibility.status.${card.status}`)}
                >
                  {statusGlyph(card.status)}{" "}
                  {tAuto(`studies.v2.feasibility.status.${card.status}`)}
                </div>
              </article>
            ))}
          </div>

          {attritionSteps.length > 0 ? (
            <section
              className="feasibility-attrition"
              aria-label={tAuto("studies.v2.feasibility.attritionAria")}
            >
              <div className="feasibility-attrition-head wb-mono">
                {tAuto("studies.v2.feasibility.attritionTitle")}
              </div>
              <ul className="feasibility-attrition-list">
                {attritionSteps.map((step, index) => (
                  <li
                    key={`${step.name}-${index}`}
                    className="feasibility-attrition-row"
                  >
                    <span className="feasibility-attrition-name wb-mono">
                      {step.name}
                    </span>
                    <span className="feasibility-attrition-track">
                      <span
                        className="feasibility-attrition-bar"
                        style={{ width: `${step.widthPercent}%` }}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="feasibility-attrition-count wb-mono">
                      {formatCount(step.count)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section
            className="feasibility-issues"
            aria-label={tAuto("studies.v2.feasibility.issuesAria")}
          >
            <div className="feasibility-issues-head wb-mono">
              {tAuto("studies.v2.feasibility.issuesTitle")}
            </div>
            {issueRows.length === 0 ? (
              <div className="feasibility-issues-empty wb-mono">
                {tAuto("studies.v2.feasibility.noIssues")}
              </div>
            ) : (
              <ul className="feasibility-issues-list">
                {issueRows.map((row, index) => (
                  <li
                    key={`${row.tone}-${index}-${row.message}`}
                    className={cn("feasibility-issue-row", row.tone)}
                  >
                    <span
                      className={cn("feasibility-issue-dot", row.tone)}
                      aria-hidden="true"
                    />
                    <span className="feasibility-issue-message">{row.message}</span>
                    {row.action ? (
                      <button
                        type="button"
                        className="btn-ghost feasibility-issue-resolve"
                      >
                        {tAuto("studies.v2.feasibility.resolve")}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
