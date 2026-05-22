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

/** Maps ReadinessStatus → status-chip tone classes (toned variant). */
function cardStatusChipCn(status: ReadinessStatus): string {
  if (status === "ready")
    return "border-success/40 bg-success/10 text-success";
  if (status === "partial")
    return "border-warning/40 bg-warning/10 text-warning";
  // blocked
  return "border-error/40 bg-error/10 text-error";
}

/** Border override for blocked cards so the whole card edge is error-tinted. */
function cardBorderCn(status: ReadinessStatus): string {
  if (status === "blocked") return "border-error/50";
  return "border-border-default";
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
    <div className="flex flex-col gap-5">
      {/* Header: meta line + run button — eyebrow/serif title deleted per spec */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-xs text-text-muted tabular-nums">
            {tAuto("studies.v2.feasibility.lastRun", { time: lastRunRelative })}
            <span aria-hidden="true"> · </span>
            {tAuto("studies.v2.feasibility.dbFreshness", { time: freshnessRelative })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 max-w-xs">
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              "bg-accent text-surface-base hover:bg-accent-light",
              "disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-text-ghost",
            )}
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
        <div
          className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-3.5 py-3 text-xs text-text-muted"
          role="status"
          aria-live="polite"
        >
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          <span>{tAuto("studies.v2.feasibility.running")}</span>
        </div>
      ) : !feasibility ? (
        <div className="rounded-lg border border-dashed border-border-default bg-surface-raised px-7 py-7 text-xs text-text-muted">
          {tAuto("studies.v2.feasibility.emptyState")}
        </div>
      ) : (
        <>
          {/* 5-card readiness grid — mobile-first: 1 → 3 → 5 cols */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3 xl:grid-cols-5">
            {cards.map((card) => (
              <article
                key={card.eyebrow}
                className={cn(
                  "relative flex flex-col gap-1.5 rounded-lg border bg-surface-raised p-3.5 pb-9 min-h-[120px] transition-colors hover:border-border-default/80",
                  cardBorderCn(card.status),
                )}
                title={card.detail}
                aria-label={card.label}
              >
                {/* Eyebrow */}
                <div className="text-[9.5px] font-medium uppercase tracking-widest text-text-ghost">
                  {card.eyebrow}
                </div>
                {/* Big numeric / string value */}
                <div className="text-2xl font-semibold leading-tight tabular-nums text-text-primary mt-0.5">
                  {card.value}
                </div>
                {/* Sub-label */}
                <div className="text-[10px] text-text-muted tracking-wide">
                  {card.subLabel}
                </div>
                {/* Status chip — absolutely positioned bottom-right */}
                <div
                  className={cn(
                    "absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    cardStatusChipCn(card.status),
                  )}
                  aria-label={tAuto(`studies.v2.feasibility.status.${card.status}`)}
                >
                  {statusGlyph(card.status)}{" "}
                  {tAuto(`studies.v2.feasibility.status.${card.status}`)}
                </div>
              </article>
            ))}
          </div>

          {/* Attrition waterfall */}
          {attritionSteps.length > 0 ? (
            <section
              className="flex flex-col gap-2.5 rounded-lg border border-border-default bg-surface-raised p-4"
              aria-label={tAuto("studies.v2.feasibility.attritionAria")}
            >
              <div className="text-[9.5px] font-medium uppercase tracking-widest text-text-ghost">
                {tAuto("studies.v2.feasibility.attritionTitle")}
              </div>
              <ul className="flex flex-col gap-1.5 list-none m-0 p-0">
                {attritionSteps.map((step, index) => (
                  <li
                    key={`${step.name}-${index}`}
                    className="grid items-center gap-3 text-xs"
                    style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,4fr) minmax(70px,auto)" }}
                  >
                    <span className="truncate text-text-muted">
                      {step.name}
                    </span>
                    <span className="block h-2 rounded-full bg-surface-elevated overflow-hidden">
                      <span
                        className="block h-2 rounded-full bg-accent"
                        style={{ width: `${step.widthPercent}%` }}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="tabular-nums text-text-secondary text-right">
                      {formatCount(step.count)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Issues list */}
          <section
            className="flex flex-col gap-2"
            aria-label={tAuto("studies.v2.feasibility.issuesAria")}
          >
            <div className="text-[9.5px] font-medium uppercase tracking-widest text-text-ghost">
              {tAuto("studies.v2.feasibility.issuesTitle")}
            </div>
            {issueRows.length === 0 ? (
              <div className="rounded-lg border border-border-default bg-surface-raised px-3 py-2.5 text-xs text-text-muted">
                {tAuto("studies.v2.feasibility.noIssues")}
              </div>
            ) : (
              <ul className="flex flex-col gap-1 list-none m-0 p-0">
                {issueRows.map((row, index) => (
                  <li
                    key={`${row.tone}-${index}-${row.message}`}
                    className="flex items-center gap-2.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-xs text-text-primary"
                  >
                    {/* Tone dot */}
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                        row.tone === "critical" ? "bg-error" : "bg-warning",
                      )}
                      aria-hidden="true"
                    />
                    <span className="flex-1 min-w-0">
                      {row.message}
                    </span>
                    {row.action ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-medium text-text-muted hover:text-text-secondary transition-colors disabled:cursor-not-allowed disabled:opacity-50 shrink-0"
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
