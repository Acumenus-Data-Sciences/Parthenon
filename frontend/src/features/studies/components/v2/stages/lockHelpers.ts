import type {
  StudyDesignAsset,
  StudyDesignLockReadiness,
  StudyDesignVersion,
} from "../../../types/study";
import {
  arrayValue,
  recordValue,
  specToForm,
  textValue,
  versionSpec,
} from "../../workbench/studyDesignWorkbenchHelpers";
import { buildIntentReviewAssistance } from "../../studyDesignIntentAssistance";

// Pure data helpers for LockLaunchpad — preflight checklist derivation only.
// Provenance + manifest helpers live in `./lockProvenance.ts` so each file
// stays under the 500-LOC budget.

export type PreflightStatus = "satisfied" | "warning" | "not-started";

export interface PreflightItem {
  id:
    | "intent"
    | "phenotypes"
    | "concept_sets"
    | "cohorts"
    | "feasibility"
    | "analyses"
    | "open_questions";
  label: string;
  status: PreflightStatus;
  description: string;
  /** Which station to navigate to when "Resolve" is clicked. */
  resolveStationId?: "01" | "02" | "03" | "04" | "05" | "06";
  /** When true, the action label uses "View Notes" instead of "Resolve". */
  notesDeepLink?: boolean;
}

const ACCEPT_STATUSES = new Set([
  "accepted",
  "reviewed",
  "approved",
  "verified",
  "complete",
  "completed",
  "linked",
  "materialized",
  "ready",
]);

const PARTIAL_STATUSES = new Set([
  "partial",
  "warning",
  "review",
  "needs_review",
  "needs-review",
  "in_progress",
  "in-progress",
  "pending",
]);

function checklistItem(
  readiness: StudyDesignLockReadiness | null,
  candidateIds: ReadonlyArray<string>,
): { status?: string; message?: string; blockerCount: number; warningCount: number } | null {
  if (!readiness?.checklist) return null;
  for (const item of readiness.checklist) {
    if (item?.id && candidateIds.includes(String(item.id))) {
      return {
        status: item.status,
        message: item.message,
        blockerCount: arrayValue(item.blockers).length,
        warningCount: arrayValue(item.warnings).length,
      };
    }
  }
  return null;
}

function statusFromChecklist(
  raw: { status?: string; blockerCount: number; warningCount: number } | null,
): PreflightStatus {
  if (!raw) return "not-started";
  const status = String(raw.status ?? "").toLowerCase();
  if (raw.blockerCount > 0) return "warning";
  if (status && ACCEPT_STATUSES.has(status)) return "satisfied";
  if (status && PARTIAL_STATUSES.has(status)) return "warning";
  if (raw.warningCount > 0) return "warning";
  return "not-started";
}

function countAssetsByType(
  assets: ReadonlyArray<StudyDesignAsset>,
  type: string,
): { total: number; ok: number } {
  let total = 0;
  let ok = 0;
  for (const asset of assets) {
    if (asset.asset_type !== type) continue;
    total += 1;
    const status = String(asset.status ?? "").toLowerCase();
    if (
      ACCEPT_STATUSES.has(status) ||
      asset.materialized_id != null ||
      asset.canonical_id != null
    ) {
      ok += 1;
    }
  }
  return { total, ok };
}

function countOpenQuestions(version: StudyDesignVersion | null): number {
  if (!version) return 0;
  // Use the same pipeline v1 IntentReviewPanel uses so v2 Lock screen agrees
  // with the v1 review screen. Going through buildIntentReviewAssistance
  // (rather than probing spec_json.open_questions directly) is the
  // authoritative source — open questions are derived from lint_results +
  // assistance heuristics, not stored as a flat list on the spec.
  const formState = specToForm(versionSpec(version));
  const assistance = buildIntentReviewAssistance(version, formState);
  return assistance.openQuestions.length;
}

function intentPreflight(
  version: StudyDesignVersion | null,
  readiness: StudyDesignLockReadiness | null,
): PreflightItem {
  const status = String(version?.status ?? "").toLowerCase();
  let preflightStatus: PreflightStatus = "not-started";
  let description = "Generate or accept an intent version to begin.";
  if (version) {
    if (status === "accepted" || status === "locked") {
      preflightStatus = "satisfied";
      description = `Intent v${version.version_number} accepted.`;
    } else if (status === "review" || status === "draft") {
      preflightStatus = "warning";
      description = `Intent v${version.version_number} still in ${status}.`;
    } else {
      preflightStatus = "warning";
      description = `Intent v${version.version_number} status: ${status || "unknown"}.`;
    }
  }
  // Cross-check against backend readiness summary when available.
  if (readiness?.provenance_summary?.version_status) {
    const backendStatus = String(readiness.provenance_summary.version_status).toLowerCase();
    if (preflightStatus === "satisfied" && backendStatus !== "accepted" && backendStatus !== "locked") {
      preflightStatus = "warning";
    }
  }
  return {
    id: "intent",
    label: "Intent",
    status: preflightStatus,
    description,
    resolveStationId: "01",
  };
}

function phenotypesPreflight(
  assets: ReadonlyArray<StudyDesignAsset>,
  readiness: StudyDesignLockReadiness | null,
): PreflightItem {
  const accepted = readiness?.summary?.accepted_recommendations;
  let total = 0;
  let acceptedCount = 0;
  for (const asset of assets) {
    if (asset.asset_type !== "phenotype_recommendation") continue;
    total += 1;
    const status = String(asset.status ?? "").toLowerCase();
    if (asset.reviewed_at != null || ACCEPT_STATUSES.has(status)) {
      acceptedCount += 1;
    }
  }
  const finalAccepted = typeof accepted === "number" ? accepted : acceptedCount;
  let status: PreflightStatus;
  let description: string;
  if (finalAccepted >= 1) {
    status = "satisfied";
    description = `${finalAccepted} phenotype recommendation${finalAccepted === 1 ? "" : "s"} accepted.`;
  } else if (total > 0) {
    status = "warning";
    description = `${total} phenotype recommendation${total === 1 ? "" : "s"} pending review.`;
  } else {
    status = "not-started";
    description = "No phenotype recommendations generated yet.";
  }
  return {
    id: "phenotypes",
    label: "Phenotypes",
    status,
    description,
    resolveStationId: "02",
  };
}

function conceptSetsPreflight(
  assets: ReadonlyArray<StudyDesignAsset>,
  readiness: StudyDesignLockReadiness | null,
): PreflightItem {
  const summary = readiness?.summary;
  const materialized = typeof summary?.materialized_concept_sets === "number"
    ? summary.materialized_concept_sets
    : countAssetsByType(assets, "concept_set_draft").ok;
  const counted = countAssetsByType(assets, "concept_set_draft");
  let status: PreflightStatus;
  let description: string;
  if (counted.total === 0) {
    status = "not-started";
    description = "No concept-set drafts yet.";
  } else if (materialized >= counted.total) {
    status = "satisfied";
    description = `All ${counted.total} concept set${counted.total === 1 ? "" : "s"} materialized.`;
  } else {
    status = "warning";
    description = `${counted.total - materialized} concept-set draft${counted.total - materialized === 1 ? "" : "s"} not yet materialized.`;
  }
  return {
    id: "concept_sets",
    label: "Concept sets",
    status,
    description,
    resolveStationId: "03",
  };
}

function cohortsPreflight(readiness: StudyDesignLockReadiness | null): PreflightItem {
  const cohorts = readiness?.cohorts;
  if (!cohorts) {
    return {
      id: "cohorts",
      label: "Cohorts",
      status: "not-started",
      description: "No cohorts drafted yet.",
      resolveStationId: "04",
    };
  }
  if (cohorts.ready === true && cohorts.blocked_count === 0) {
    return {
      id: "cohorts",
      label: "Cohorts",
      status: "satisfied",
      description: "Target, comparator, and outcome cohorts all linked.",
      resolveStationId: "04",
    };
  }
  return {
    id: "cohorts",
    label: "Cohorts",
    status: "warning",
    description:
      cohorts.blocked_count > 0
        ? `${cohorts.blocked_count} cohort${cohorts.blocked_count === 1 ? " is" : "s are"} blocked.`
        : `Only ${cohorts.materialized_verified_count}/${cohorts.cohort_asset_count} cohorts linked.`,
    resolveStationId: "04",
  };
}

function feasibilityPreflight(
  assets: ReadonlyArray<StudyDesignAsset>,
  readiness: StudyDesignLockReadiness | null,
): PreflightItem {
  const summaryStatus = readiness?.summary?.feasibility_status;
  const feasibilityReady = readiness?.feasibility_ready === true;
  const feasibilityAsset = assets
    .filter((asset) => asset.asset_type === "feasibility_result")
    .sort((a, b) => b.id - a.id)[0] ?? null;
  if (!feasibilityAsset && !summaryStatus) {
    return {
      id: "feasibility",
      label: "Feasibility",
      status: "not-started",
      description: "Feasibility has not been run.",
      resolveStationId: "05",
    };
  }
  const assetStatus = String(feasibilityAsset?.status ?? "").toLowerCase();
  const isRunning = assetStatus === "running" || String(summaryStatus ?? "").toLowerCase() === "running";
  const isReady =
    feasibilityReady === true || assetStatus === "ready" || String(summaryStatus ?? "").toLowerCase() === "ready";
  const payload = recordValue(feasibilityAsset?.draft_payload_json);
  const sourceList = arrayValue<Record<string, unknown>>(payload?.sources);
  const partialCount = sourceList.filter((source) => source?.ready_for_analysis !== true).length;
  const readyCount = sourceList.length - partialCount;
  if (isRunning) {
    return {
      id: "feasibility",
      label: "Feasibility",
      status: "warning",
      description: "Feasibility job currently running.",
      resolveStationId: "05",
    };
  }
  if (isReady && partialCount === 0) {
    return {
      id: "feasibility",
      label: "Feasibility",
      status: "satisfied",
      description: sourceList.length > 0
        ? `Feasibility passed on ${readyCount}/${sourceList.length} bound source${sourceList.length === 1 ? "" : "s"}.`
        : "Feasibility passed on the bound CDM.",
      resolveStationId: "05",
    };
  }
  if (sourceList.length > 0 && readyCount > 0 && partialCount > 0) {
    // Surface the IRSF partial pattern called out in the brief.
    const partialNames = sourceList
      .filter((source) => source?.ready_for_analysis !== true)
      .map((source) => textValue(source?.source_name))
      .filter((name): name is string => Boolean(name));
    const detail = partialNames.length > 0
      ? `${partialNames.join(", ")} partial`
      : `${partialCount} source${partialCount === 1 ? "" : "s"} partial`;
    return {
      id: "feasibility",
      label: "Feasibility",
      status: "warning",
      description: `Feasibility passed on ${readyCount}/${sourceList.length} sources — ${detail}.`,
      resolveStationId: "05",
    };
  }
  return {
    id: "feasibility",
    label: "Feasibility",
    status: "warning",
    description: "Feasibility has not passed on the bound CDM.",
    resolveStationId: "05",
  };
}

function analysesPreflight(
  assets: ReadonlyArray<StudyDesignAsset>,
  readiness: StudyDesignLockReadiness | null,
): PreflightItem {
  const summaryCount = readiness?.summary?.materialized_analysis_plans;
  const drafts = assets.filter((asset) => asset.asset_type === "analysis_plan");
  const materialized = typeof summaryCount === "number"
    ? summaryCount
    : drafts.filter((asset) => asset.materialized_id != null).length;
  const verified = drafts.filter((asset) =>
    asset.verification_status === "verified"
    || asset.verification_status === "compatible"
    || asset.materialized_id != null,
  ).length;
  if (drafts.length === 0) {
    return {
      id: "analyses",
      label: "Analyses",
      status: "not-started",
      description: "No analysis plans drafted yet.",
      resolveStationId: "06",
    };
  }
  if (materialized >= 1 && verified >= 1) {
    return {
      id: "analyses",
      label: "Analyses",
      status: "satisfied",
      description: `${materialized} analysis plan${materialized === 1 ? "" : "s"} materialized + HADES-verified.`,
      resolveStationId: "06",
    };
  }
  return {
    id: "analyses",
    label: "Analyses",
    status: "warning",
    description: materialized === 0
      ? `${drafts.length} analysis plan draft${drafts.length === 1 ? "" : "s"} not yet materialized.`
      : "Analysis plans need HADES verification.",
    resolveStationId: "06",
  };
}

function openQuestionsPreflight(version: StudyDesignVersion | null): PreflightItem {
  const count = countOpenQuestions(version);
  if (count === 0) {
    return {
      id: "open_questions",
      label: "Open questions",
      status: "satisfied",
      description: "No unresolved questions on the design.",
      notesDeepLink: true,
    };
  }
  return {
    id: "open_questions",
    label: "Open questions",
    status: "warning",
    description: `${count} unresolved question${count === 1 ? "" : "s"}.`,
    notesDeepLink: true,
  };
}

export function buildPreflightItems(
  version: StudyDesignVersion | null,
  assets: ReadonlyArray<StudyDesignAsset>,
  readiness: StudyDesignLockReadiness | null,
): ReadonlyArray<PreflightItem> {
  // Pull individual readiness check items when present — these reflect the
  // backend's authoritative gate verdict and supersede our local derivation.
  const intentCheck = checklistItem(readiness, ["intent", "intent_accepted"]);
  const intentItem = intentCheck
    ? {
      ...intentPreflight(version, readiness),
      status: statusFromChecklist(intentCheck),
    }
    : intentPreflight(version, readiness);
  return [
    intentItem,
    phenotypesPreflight(assets, readiness),
    conceptSetsPreflight(assets, readiness),
    cohortsPreflight(readiness),
    feasibilityPreflight(assets, readiness),
    analysesPreflight(assets, readiness),
    openQuestionsPreflight(version),
  ];
}

export function isReadyToLock(
  items: ReadonlyArray<PreflightItem>,
  acknowledged: boolean,
): { ready: boolean; needsAcknowledge: boolean } {
  let hasWarning = false;
  for (const item of items) {
    if (item.status === "not-started") return { ready: false, needsAcknowledge: false };
    if (item.status === "warning") hasWarning = true;
  }
  if (!hasWarning) return { ready: true, needsAcknowledge: false };
  return { ready: acknowledged, needsAcknowledge: true };
}

export function hasOpenQuestions(
  items: ReadonlyArray<PreflightItem>,
): boolean {
  return items.some((item) => item.id === "open_questions" && item.status === "warning");
}

