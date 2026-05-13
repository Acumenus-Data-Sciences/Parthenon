import { tAuto } from "@/i18n/autoUserFacing";
import type {
  StudyDesignAsset,
  StudyFeasibilityResult,
} from "../../../types/study";
import {
  arrayValue,
  draftPayloadRecord,
  isRecord,
  issueMessage,
  normalizeCohortRole,
  recordValue,
} from "../../workbench/studyDesignWorkbenchHelpers";

// Pure data helpers for FeasibilityView. Kept separate so the React
// component stays under the 500-line file budget.

export type ReadinessStatus = "ready" | "partial" | "blocked";

export type CohortRole = "target" | "comparator" | "outcome";

export interface CohortCardData {
  kind: "cohort";
  role: CohortRole;
  eyebrow: string;
  label: string;
  value: string;
  numericValue: number | null;
  subLabel: string;
  status: ReadinessStatus;
  detail: string;
}

export interface PsCovariateCardData {
  kind: "ps_covariates";
  eyebrow: "PS COVARIATES";
  label: string;
  value: string;
  coveragePercent: number | null;
  subLabel: string;
  status: ReadinessStatus;
  detail: string;
}

export interface DqdCardData {
  kind: "dqd";
  eyebrow: "DQD";
  label: string;
  value: string;
  passRate: number | null;
  subLabel: string;
  status: ReadinessStatus;
  detail: string;
}

export type ReadinessCard = CohortCardData | PsCovariateCardData | DqdCardData;

export interface AttritionStep {
  name: string;
  count: number;
  widthPercent: number;
}

export interface IssueRow {
  message: string;
  tone: "critical" | "warning";
  action: string | null;
}

type FeasibilitySource = NonNullable<StudyFeasibilityResult["sources"]>[number];
type FeasibilityCohort = NonNullable<FeasibilitySource["cohorts"]>[number];
type FeasibilityAttritionStep = NonNullable<FeasibilityCohort["attrition"]>[number];

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

export function formatCount(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return NUMBER_FORMAT.format(value);
}

function formatPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatPassRate(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  // pass_rate can be reported as either 0–1 or 0–100. Normalize.
  const normalized = value > 1 ? value / 100 : value;
  return `${Math.round(normalized * 100)}%`;
}

export function relativeFromNow(iso: string | null | undefined): string {
  if (!iso) return tAuto("studies.v2.feasibility.never");
  const when = new Date(iso).getTime();
  if (Number.isNaN(when)) return tAuto("studies.v2.feasibility.never");
  const diffMs = Date.now() - when;
  if (diffMs < 0) return tAuto("studies.v2.feasibility.justNow");
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return tAuto("studies.v2.feasibility.justNow");
  if (minutes < 60) return tAuto("studies.v2.feasibility.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tAuto("studies.v2.feasibility.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return tAuto("studies.v2.feasibility.daysAgo", { count: days });
}

export function pickPrimaryFeasibility(
  assets: ReadonlyArray<StudyDesignAsset>,
): StudyFeasibilityResult | null {
  const feasibilityAssets = assets
    .filter((asset) => asset.asset_type === "feasibility_result")
    .sort((a, b) => b.id - a.id);
  const first = feasibilityAssets[0];
  if (!first) return null;
  const payload = first.draft_payload_json;
  return isRecord(payload) ? (payload as unknown as StudyFeasibilityResult) : null;
}

export function pickPrimarySource(
  result: StudyFeasibilityResult,
): FeasibilitySource | null {
  const sources = arrayValue<FeasibilitySource>(result.sources);
  if (sources.length === 0) return null;
  const ready = sources.find((source) => source.ready_for_analysis === true);
  return ready ?? sources[0] ?? null;
}

function deriveCohortStatus(
  count: number | null,
  suppressed: boolean,
  cohortAssetExists: boolean,
): ReadinessStatus {
  if (!cohortAssetExists) return "blocked";
  if (suppressed) return "partial";
  if (count == null) return "blocked";
  if (count <= 0) return "blocked";
  return "ready";
}

function deriveCoverageStatus(coverage: number | null): ReadinessStatus {
  if (coverage == null) return "blocked";
  if (coverage >= 0.8) return "ready";
  if (coverage >= 0.5) return "partial";
  return "blocked";
}

function derivePassRateStatus(rate: number | null): ReadinessStatus {
  if (rate == null) return "blocked";
  const normalized = rate > 1 ? rate / 100 : rate;
  if (normalized >= 0.9) return "ready";
  if (normalized >= 0.75) return "partial";
  return "blocked";
}

function cohortCountFromSource(
  source: FeasibilitySource,
  role: CohortRole,
): { count: number | null; suppressed: boolean } {
  const cohorts = arrayValue<FeasibilityCohort>(source.cohorts);
  const match = cohorts.find(
    (cohort) => normalizeCohortRole(String(cohort.role ?? "")) === role,
  );
  if (!match) return { count: null, suppressed: false };
  return {
    count: typeof match.person_count === "number" ? match.person_count : null,
    suppressed: match.person_count_suppressed === true,
  };
}

function cohortAssetExists(
  assets: ReadonlyArray<StudyDesignAsset>,
  role: CohortRole,
): boolean {
  return assets.some((asset) => {
    if (asset.asset_type !== "cohort_draft") return false;
    const payload = draftPayloadRecord(asset);
    const raw = String(payload.role ?? asset.role ?? "");
    return normalizeCohortRole(raw) === role;
  });
}

function buildCohortCard(
  role: CohortRole,
  eyebrow: string,
  feasibility: StudyFeasibilityResult,
  primarySource: FeasibilitySource | null,
  assets: ReadonlyArray<StudyDesignAsset>,
): CohortCardData {
  const { count, suppressed } = primarySource
    ? cohortCountFromSource(primarySource, role)
    : { count: null, suppressed: false };
  const assetPresent = cohortAssetExists(assets, role);
  const value = suppressed
    ? `<${feasibility.min_cell_count ?? 5}`
    : formatCount(count);
  const status = deriveCohortStatus(count, suppressed, assetPresent);
  const detail = assetPresent
    ? tAuto("studies.v2.feasibility.cohortPersonsDetail", {
      count: value,
      role,
    })
    : tAuto("studies.v2.feasibility.cohortMissing", { role });
  return {
    kind: "cohort",
    role,
    eyebrow,
    label: tAuto(`studies.v2.feasibility.cohortLabel.${role}`),
    value,
    numericValue: count,
    subLabel: tAuto("studies.v2.feasibility.persons"),
    status,
    detail,
  };
}

function extractPsCoverage(source: FeasibilitySource | null): number | null {
  if (!source) return null;
  const quality = recordValue(source.source_quality);
  if (!quality) return null;
  const psBlock = recordValue(quality.ps_covariates);
  if (!psBlock) {
    // Fallback: surface domain availability as a proxy when PS-covariate
    // metadata isn't yet emitted by the backend feasibility job.
    const availability = source.domain_availability;
    if (
      !availability ||
      availability.role_count == null ||
      availability.available_role_count == null ||
      availability.role_count === 0
    ) {
      return null;
    }
    return availability.available_role_count / availability.role_count;
  }
  const coverage = psBlock.coverage;
  if (typeof coverage === "number" && Number.isFinite(coverage)) {
    return coverage > 1 ? coverage / 100 : coverage;
  }
  return null;
}

function buildPsCovariateCard(source: FeasibilitySource | null): PsCovariateCardData {
  const coverage = extractPsCoverage(source);
  const status = deriveCoverageStatus(coverage);
  const value = formatPercent(coverage);
  const detail = coverage == null
    ? tAuto("studies.v2.feasibility.psCovariatesMissing")
    : tAuto("studies.v2.feasibility.psCovariatesDetail", { percent: value });
  return {
    kind: "ps_covariates",
    eyebrow: "PS COVARIATES",
    label: tAuto("studies.v2.feasibility.psCovariatesLabel"),
    value,
    coveragePercent: coverage,
    subLabel: tAuto("studies.v2.feasibility.covariateCoverage"),
    status,
    detail,
  };
}

function buildDqdCard(source: FeasibilitySource | null): DqdCardData {
  const passRate = source?.source_quality?.dqd?.pass_rate ?? null;
  const status = derivePassRateStatus(passRate);
  const value = formatPassRate(passRate);
  const detail = passRate == null
    ? tAuto("studies.v2.feasibility.dqdMissing")
    : tAuto("studies.v2.feasibility.dqdDetail", { rate: value });
  return {
    kind: "dqd",
    eyebrow: "DQD",
    label: tAuto("studies.v2.feasibility.dqdLabel"),
    value,
    passRate,
    subLabel: tAuto("studies.v2.feasibility.dqdChecksPassed"),
    status,
    detail,
  };
}

export function buildReadinessCards(
  feasibility: StudyFeasibilityResult,
  assets: ReadonlyArray<StudyDesignAsset>,
): ReadonlyArray<ReadinessCard> {
  const primarySource = pickPrimarySource(feasibility);
  return [
    buildCohortCard("target", "TARGET", feasibility, primarySource, assets),
    buildCohortCard("comparator", "COMPARATOR", feasibility, primarySource, assets),
    buildCohortCard("outcome", "OUTCOME", feasibility, primarySource, assets),
    buildPsCovariateCard(primarySource),
    buildDqdCard(primarySource),
  ];
}

export function buildAttritionSteps(
  feasibility: StudyFeasibilityResult,
): ReadonlyArray<AttritionStep> {
  const primarySource = pickPrimarySource(feasibility);
  if (!primarySource) return [];

  const cohorts = arrayValue<FeasibilityCohort>(primarySource.cohorts);
  const target = cohorts.find(
    (cohort) => normalizeCohortRole(String(cohort.role ?? "")) === "target",
  );
  const attrition = arrayValue<FeasibilityAttritionStep>(target?.attrition);

  if (attrition.length === 0) return [];

  // Drop suppressed rows so the bar widths are meaningful. First
  // non-suppressed count becomes the denominator.
  const tuples: Array<{ name: string; count: number }> = [];
  for (const step of attrition) {
    if (!step || typeof step !== "object") continue;
    const record = step as Record<string, unknown>;
    if (record.person_count_suppressed === true) continue;
    const rawCount = record.person_count;
    if (typeof rawCount !== "number" || !Number.isFinite(rawCount)) continue;
    const name = typeof record.name === "string" && record.name.trim() !== ""
      ? record.name
      : tAuto("studies.v2.feasibility.attritionStepFallback");
    tuples.push({ name, count: rawCount });
  }

  if (tuples.length === 0) return [];
  const denominator = tuples[0]!.count;
  if (denominator <= 0) return [];

  return tuples.map((tuple) => ({
    name: tuple.name,
    count: tuple.count,
    widthPercent: Math.max(
      1,
      Math.min(100, Math.round((tuple.count / denominator) * 100)),
    ),
  }));
}

export function buildIssueRows(
  feasibility: StudyFeasibilityResult,
): ReadonlyArray<IssueRow> {
  const blockers = arrayValue(feasibility.blockers).map((issue) => ({
    issue,
    tone: "critical" as const,
  }));
  const warnings = arrayValue(feasibility.warnings).map((issue) => ({
    issue,
    tone: "warning" as const,
  }));
  const all = [...blockers, ...warnings];
  const rows: IssueRow[] = [];
  for (const entry of all) {
    const message = issueMessage(entry.issue);
    if (!message) continue;
    const action = extractIssueActionLabel(entry.issue);
    rows.push({ message, tone: entry.tone, action });
  }
  return rows;
}

function extractIssueActionLabel(issue: unknown): string | null {
  if (!isRecord(issue)) return null;
  const action = (issue as Record<string, unknown>).action;
  if (!isRecord(action)) return null;
  const label = (action as Record<string, unknown>).label;
  return typeof label === "string" && label.trim() !== "" ? label : null;
}
