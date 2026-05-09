import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import type { Source } from "@/types/models";
import type {
  StudyCohortReadiness,
  StudyDesignAsset,
  StudyFeasibilityResult,
} from "../../types/study";
import { ActionGateHint } from "./shared/ActionGateHint";
import {
  arrayValue,
  feasibilityIssueGuidance,
  feasibilityPreviousRun,
  formatSigned,
  isRecord,
  issueAction,
  issueMessage,
} from "./studyDesignWorkbenchHelpers";
import { tAuto } from "@/i18n/autoUserFacing";

type StudyFeasibilitySource = NonNullable<StudyFeasibilityResult["sources"]>[number];
type StudyFeasibilityCohort = NonNullable<StudyFeasibilitySource["cohorts"]>[number];
type StudyFeasibilityAttritionStep = NonNullable<StudyFeasibilityCohort["attrition"]>[number];

export function FeasibilityDashboard({
  assets,
  readiness,
  isReadinessLoading,
  isRunning,
  onRun,
}: {
  assets: StudyDesignAsset[];
  readiness: StudyCohortReadiness | null;
  isReadinessLoading: boolean;
  isRunning: boolean;
  onRun: (sourceIds: number[], minCellCount: number) => void;
}) {
  const { t } = useTranslation("app");
  const { data: sources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });
  const [selectedSourceIds, setSelectedSourceIds] = useState<number[] | null>(null);
  const [minCellCount, setMinCellCount] = useState(5);
  const [minCellEdited, setMinCellEdited] = useState(false);
  const defaultSource = sources.find((source) => source.is_default) ?? sources[0] ?? null;
  const defaultSourceIds = defaultSource ? [defaultSource.id] : [];
  const cdmResultsSourceIds = sources
    .filter((source) => {
      const daimons = Array.isArray(source.daimons) ? source.daimons : [];
      const daimonTypes = daimons.map((daimon) => daimon.daimon_type);
      return daimonTypes.includes("cdm") && daimonTypes.includes("results");
    })
    .map((source) => source.id);
  const selectedIds = selectedSourceIds ?? defaultSourceIds;
  const feasibilityAssets = assets
    .filter((asset) => asset.asset_type === "feasibility_result")
    .sort((left, right) => right.id - left.id);
  const feasibilityAsset = feasibilityAssets[0];
  const previousFeasibilityAsset = feasibilityAssets[1];
  const feasibility = isRecord(feasibilityAsset?.draft_payload_json)
    ? feasibilityAsset.draft_payload_json as unknown as StudyFeasibilityResult
    : undefined;
  const previousFeasibility = isRecord(previousFeasibilityAsset?.draft_payload_json)
    ? previousFeasibilityAsset.draft_payload_json as unknown as StudyFeasibilityResult
    : undefined;
  const activeMinCellCount = minCellEdited
    ? minCellCount
    : typeof feasibility?.min_cell_count === "number" ? feasibility.min_cell_count : minCellCount;
  const feasibilitySources = arrayValue<StudyFeasibilitySource>(feasibility?.sources);
  const feasibilityBlockers = arrayValue(feasibility?.blockers);
  const feasibilityWarnings = arrayValue(feasibility?.warnings);
  const feasibilityIssueRows = [
    ...feasibilityBlockers.map((issue) => ({ issue, tone: "critical" as const })),
    ...feasibilityWarnings.map((issue) => ({ issue, tone: "warning" as const })),
  ];
  const previousRun = feasibilityPreviousRun(feasibility, previousFeasibility);
  const cohortsReady = readiness?.ready_for_feasibility === true || readiness?.ready === true;
  const canRun = selectedIds.length > 0 && cohortsReady;
  const runGate = isReadinessLoading
    ? "Checking cohort readiness before feasibility."
    : readiness == null
      ? "Cohort readiness must be available before feasibility."
      : !cohortsReady
        ? t("studies.workbench.messages.linkRequiredCohorts")
        : selectedIds.length === 0
          ? "Select at least one source before running feasibility."
          : null;
  const attritionSources = feasibilitySources.filter((source) =>
    arrayValue<StudyFeasibilityCohort>(source.cohorts).some((cohort) => arrayValue<StudyFeasibilityAttritionStep>(cohort.attrition).length > 0),
  );

  const toggleSource = (source: Source) => {
    setSelectedSourceIds((current) => {
      const active = current ?? defaultSourceIds;
      return active.includes(source.id)
        ? active.filter((id) => id !== source.id)
        : [...active, source.id];
    });
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">
            {t("studies.workbench.sections.feasibility")}
          </p>
          <p className="text-xs text-text-ghost">
            {t("studies.workbench.descriptions.feasibility")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRun(selectedIds, activeMinCellCount)}
          disabled={!canRun || isRunning}
          title={runGate ?? undefined}
          className="btn btn-primary btn-sm shrink-0"
        >
          {isRunning ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {t("studies.workbench.actions.runFeasibility")}
        </button>
      </div>

      <ActionGateHint message={runGate} tone={!cohortsReady ? "warning" : "neutral"} />

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-ghost">
            {t("studies.workbench.sections.sources")}
          </p>
          {sourcesLoading ? (
            <p className="text-xs text-text-muted">{t("studies.workbench.messages.loadingSources")}</p>
          ) : sources.length === 0 ? (
            <p className="text-xs text-text-muted">{t("studies.workbench.messages.noSources")}</p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => setSelectedSourceIds(sources.map((source) => source.id))} className="btn btn-ghost btn-sm">
                  {tAuto("all_6a720856")}
                </button>
                <button type="button" onClick={() => setSelectedSourceIds(defaultSourceIds)} disabled={defaultSourceIds.length === 0} className="btn btn-ghost btn-sm">
                  {tAuto("default_808d7dca")}
                </button>
                <button type="button" onClick={() => setSelectedSourceIds(cdmResultsSourceIds)} disabled={cdmResultsSourceIds.length === 0} className="btn btn-ghost btn-sm">
                  {tAuto("cdmResults_11959e2b")}
                </button>
                <button type="button" onClick={() => setSelectedSourceIds([])} className="btn btn-ghost btn-sm">
                  {tAuto("clear_719ea396")}
                </button>
                <span className="self-center text-[11px] text-text-ghost">
                  {selectedIds.length}/{sources.length} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sources.map((source) => {
                  const active = selectedIds.includes(source.id);
                  return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => toggleSource(source)}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-xs",
                      active
                        ? "border-success bg-success/10 text-success"
                        : "border-border-default text-text-muted hover:text-text-secondary",
                    )}
                  >
                    {source.source_name}
                  </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <label className="text-xs text-text-muted">
          {t("studies.workbench.messages.smallCellThreshold")}
          <input
            type="number"
            min={1}
            max={100}
            value={activeMinCellCount}
            onChange={(event) => {
              setMinCellEdited(true);
              setMinCellCount(Number(event.target.value) || 5);
            }}
            className="form-input mt-1 w-24"
          />
        </label>
      </div>

      {feasibility ? (
        <div className="border-t border-border-default pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-text-secondary">
                {t("studies.workbench.messages.sourcesReady", {
                  ready: feasibility.ready_source_count,
                  total: feasibility.source_count,
                })}
              </p>
              <p className="text-[11px] text-text-ghost">
                {t("studies.workbench.messages.ranAt", {
                  time: new Date(feasibility.ran_at).toLocaleString(),
                })}
              </p>
              {previousRun && (
                <p className="text-[11px] text-text-ghost">
                  {tAuto("previousRun_a96ea2cc")} {previousRun.ready_source_count}/{previousRun.source_count} ready
                  {typeof previousRun.delta_ready_source_count === "number"
                    ? ` · ready source delta ${formatSigned(previousRun.delta_ready_source_count)}`
                    : ""}
                  {previousRun.threshold_changed
                    ? ` · threshold changed from ${previousRun.min_cell_count} to ${feasibility.min_cell_count}`
                    : ""}
                </p>
              )}
            </div>
            <span
              className={cn(
                "rounded-md px-2 py-1 text-[10px] uppercase tracking-wider",
                feasibility.status === "ready" && "bg-success/10 text-success",
                feasibility.status === "limited" && "bg-warning/10 text-warning",
                feasibility.status === "blocked" && "bg-critical/10 text-critical",
              )}
            >
              {feasibility.status}
            </span>
          </div>
          {feasibilityIssueRows.length > 0 && (
            <div className="mt-3 space-y-2">
              {feasibilityIssueRows.map(({ issue, tone }, index) => {
                const message = issueMessage(issue);
                if (!message) return null;
                const action = issueAction(issue);

                return (
                  <div
                    key={`${tone}-${index}-${message}`}
                    className="rounded-md border border-border-default bg-surface-base px-2 py-2"
                  >
                    <p className={cn("text-xs", tone === "critical" ? "text-critical" : "text-warning")}>
                      {message}
                    </p>
                    <p className="mt-1 text-[11px] text-text-muted">
                      {tAuto("abbySourceGate_3ddec426")} {feasibilityIssueGuidance(issue)}
                    </p>
                    {action?.label && (
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-text-ghost">
                        {tAuto("actionTarget_f419294f")} {action.label}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-text-ghost">
                <tr>
                  <th className="py-1 pr-3 font-medium">{t("studies.workbench.labels.source")}</th>
                  <th className="py-1 pr-3 font-medium">{t("studies.workbench.labels.status")}</th>
                  <th className="py-1 pr-3 font-medium">{t("studies.workbench.labels.cohorts")}</th>
                  <th className="py-1 pr-3 font-medium">{t("studies.workbench.labels.coverage")}</th>
                  <th className="py-1 pr-3 font-medium">{t("studies.workbench.labels.domains")}</th>
                  <th className="py-1 pr-3 font-medium">{t("studies.workbench.labels.freshness")}</th>
                  <th className="py-1 pr-3 font-medium">{t("studies.workbench.labels.dqd")}</th>
                </tr>
              </thead>
              <tbody>
                {feasibilitySources.map((source) => {
                  const sourceCohorts = arrayValue<StudyFeasibilityCohort>(source.cohorts);
                  const dateCoverage = source.coverage?.date_coverage;
                  const observationPeriod = source.coverage?.observation_period;
                  const freshness = source.coverage?.freshness;
                  const dqdPassRate = source.source_quality?.dqd?.pass_rate;
                  const sourceIssues = [
                    ...arrayValue(source.blockers).map((issue) => ({ issue, tone: "critical" as const })),
                    ...arrayValue(source.warnings).map((issue) => ({ issue, tone: "warning" as const })),
                  ];

                  return (
                    <tr key={source.source_id ?? source.source_name} className="border-t border-border-default">
                      <td className="py-2 pr-3 text-text-secondary">
                        <span className="block">{source.source_name}</span>
                        {sourceIssues.slice(0, 2).map(({ issue, tone }, issueIndex) => {
                          const message = issueMessage(issue);
                          if (!message) return null;

                          return (
                            <span
                              key={`${source.source_id ?? source.source_name}-${issueIndex}-${message}`}
                              className={cn("mt-1 block text-[10px]", tone === "critical" ? "text-critical" : "text-warning")}
                            >
                              {message}
                            </span>
                          );
                        })}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={source.ready_for_analysis ? "text-success" : "text-warning"}>
                          {source.ready_for_analysis ? t("studies.workbench.messages.ready") : t("studies.workbench.actions.review")}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-text-muted">
                        {sourceCohorts.map((cohort, index) => (
                          <span key={cohort.study_cohort_id ?? `${source.source_id ?? source.source_name}-${cohort.role ?? index}`} className="mr-2 inline-block">
                            {cohort.role}: {cohort.person_count_suppressed ? `<${feasibility.min_cell_count}` : cohort.person_count ?? t("studies.workbench.messages.none")}
                          </span>
                        ))}
                      </td>
                      <td className="py-2 pr-3 text-text-muted">
                        <span className="block">
                          {dateCoverage?.start_date && dateCoverage?.end_date
                            ? `${dateCoverage.start_date} to ${dateCoverage.end_date}`
                            : t("studies.workbench.messages.noDates")}
                        </span>
                        <span className="block text-[11px] text-text-ghost">
                          OP: {observationPeriod?.record_count ?? t("studies.workbench.messages.none")}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-text-muted">
                        {source.domain_availability
                          ? t("studies.workbench.messages.roles", {
                            ready: source.domain_availability.available_role_count,
                            total: source.domain_availability.role_count,
                          })
                          : t("studies.workbench.messages.unknown")}
                      </td>
                      <td className="py-2 pr-3 text-text-muted">
                        {!freshness || freshness.status === "unknown"
                          ? t("studies.workbench.messages.unknown")
                          : `${freshness.status}${freshness.days_since_release == null ? "" : ` (${freshness.days_since_release}d)`}`}
                      </td>
                      <td className="py-2 pr-3 text-text-muted">
                        {dqdPassRate == null
                          ? t("studies.workbench.messages.noDqd")
                          : t("studies.workbench.messages.passRate", { rate: dqdPassRate })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {attritionSources.length > 0 && (
            <div className="mt-4 border-t border-border-default pt-3">
              <p className="text-xs font-semibold text-text-secondary">{t("studies.workbench.sections.attrition")}</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {attritionSources.map((source) => (
                  <div key={source.source_id ?? source.source_name} className="border-l border-border-default pl-3">
                    <p className="text-xs font-semibold text-text-secondary">{source.source_name}</p>
                    <div className="mt-2 space-y-1">
                      {arrayValue<StudyFeasibilityCohort>(source.cohorts).map((cohort, cohortIndex) => (
                        <div key={cohort.study_cohort_id ?? `${source.source_id ?? source.source_name}-${cohort.role ?? cohortIndex}`} className="text-[11px] text-text-muted">
                          <span className="font-medium text-text-secondary">{cohort.role}</span>
                          {arrayValue<StudyFeasibilityAttritionStep>(cohort.attrition).map((step, stepIndex) => (
                            <span key={`${cohort.study_cohort_id ?? cohort.role ?? cohortIndex}-${step.name ?? stepIndex}`} className="ml-2 inline-block">
                              {step.name}: {step.person_count_suppressed ? `<${feasibility.min_cell_count}` : step.person_count ?? t("studies.workbench.messages.none")}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="border-t border-border-default pt-3 text-xs text-text-ghost">
          {t("studies.workbench.messages.noFeasibilityEvidence")}
        </p>
      )}
    </div>
  );
}
