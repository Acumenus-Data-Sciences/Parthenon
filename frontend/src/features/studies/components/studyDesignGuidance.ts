import type {
  StudyCohortReadiness,
  StudyDesignBackendGuidance,
  StudyDesignBackendGuidanceAction,
  StudyDesignBackendGuidanceSection,
  StudyCompilerActionType,
  StudyCompilerAction,
  StudyCompilerGuidance,
  StudyCompilerStage,
  StudyCompilerStageId,
  StudyDesignAsset,
  StudyDesignLockReadiness,
  StudyDesignVersion,
} from "../types/study";

export type {
  StudyCompilerGuidance,
  StudyCompilerStage,
  StudyCompilerStageId,
  StudyCompilerStageStatus,
} from "../types/study";

interface GuidanceInput {
  version: StudyDesignVersion | null;
  assets: StudyDesignAsset[];
  cohortReadiness?: StudyCohortReadiness | null;
  lockReadiness?: StudyDesignLockReadiness | null;
  backendGuidance?: StudyDesignBackendGuidance | null;
}

export function buildStudyDesignGuidance({
  version,
  assets,
  cohortReadiness,
  lockReadiness,
  backendGuidance,
}: GuidanceInput): StudyCompilerGuidance {
  const recommendations = assets.filter(isRecommendationAsset);
  const acceptedRecommendations = recommendations.filter((asset) => asset.status === "accepted");
  const conceptDrafts = assets.filter((asset) => asset.asset_type === "concept_set_draft");
  const materializedConceptSets = conceptDrafts.filter(isMaterializedAsset);
  const cohortDrafts = assets.filter((asset) => asset.asset_type === "cohort_draft");
  const materializedCohorts = cohortDrafts.filter(isMaterializedAsset);
  const linkedCohorts = cohortDrafts.filter(hasStudyCohortLink);
  const feasibilityAssets = assets.filter((asset) => asset.asset_type === "feasibility_result");
  const analysisPlans = assets.filter((asset) => asset.asset_type === "analysis_plan");
  const materializedAnalyses = analysisPlans.filter(isMaterializedAsset);
  const downstreamDraftsStarted = conceptDrafts.length > 0 || cohortDrafts.length > 0 || feasibilityAssets.length > 0 || analysisPlans.length > 0;
  const importedAssets = assets.filter((asset) => asset.asset_type.startsWith("imported_"));
  const critiqueAssets = assets.filter((asset) => asset.asset_type === "design_critique");
  const locked = version?.status === "locked" || version?.locked_at != null || booleanAt(lockReadiness, "locked");
  const canLock = booleanAt(lockReadiness, "can_lock");
  const lockReady = booleanAt(lockReadiness, "ready") || stringAt(lockReadiness, "status") === "ready";
  const cohortsReady = cohortReadiness?.ready_for_feasibility === true || cohortReadiness?.ready === true;
  const feasibilityLatest = feasibilityAssets[0]?.draft_payload_json;
  const feasibilityStatus = stringAt(feasibilityLatest, "status");

  const lockBlockers = issueMessages(arrayAt(lockReadiness, "blockers"));
  const lockWarnings = issueMessages(arrayAt(lockReadiness, "warnings"));
  const cohortBlockers = issueMessages(cohortReadiness?.blockers);
  const cohortWarnings = issueMessages(cohortReadiness?.warnings);
  const assetBlockers = assets.flatMap((asset) => issueMessages(arrayAt(asset.verification_json, "blocking_reasons")));
  const assetWarnings = assets.flatMap((asset) => issueMessages(arrayAt(asset.verification_json, "warnings")));

  const intentAccepted = version?.status === "accepted" || version?.status === "compiled" || locked || version?.accepted_at != null;
  const intentReady = version?.status === "review_ready";

  const intentStage: StudyCompilerStage = version == null
    ? {
      id: "intent",
      label: "Intent",
      status: "active",
      detail: "Create a design session by uploading a protocol or generating intent from a research question.",
      actionLabel: "Upload protocol or generate intent",
    }
    : {
      id: "intent",
      label: "Intent",
      status: intentAccepted ? "complete" : "active",
      detail: intentAccepted
        ? "The study intent has been accepted and can drive downstream compilation."
        : intentReady
          ? "The intent is review-ready. Abby needs the user to accept it before downstream assets are trusted."
          : "Review the extracted research question and PICO fields, then save the review.",
      actionLabel: intentAccepted ? undefined : intentReady ? "Accept intent" : "Save review",
    };

  const currentAssetsStage: StudyCompilerStage = {
    id: "current_assets",
    label: "Current Assets",
    status: locked || importedAssets.length > 0 || critiqueAssets.length > 0 ? "complete" : "pending",
    detail: importedAssets.length > 0
      ? `${importedAssets.length} current study assets have been pulled into the compiler review path.`
      : locked
        ? "Current study compatibility has been resolved for the locked package."
      : "Import existing cohorts and analyses when the study already has bottom-up assets.",
    actionLabel: importedAssets.length > 0 ? "Review compatibility critique" : "Import current assets",
  };

  const phenotypesStage: StudyCompilerStage = {
    id: "phenotypes",
    label: "Phenotypes",
    status: locked || acceptedRecommendations.length > 0 || downstreamDraftsStarted
      ? "complete"
      : !intentAccepted && !intentReady
        ? "pending"
        : recommendations.length > 0
          ? "active"
          : "active",
    detail: downstreamDraftsStarted && acceptedRecommendations.length === 0 && !locked
      ? "Downstream drafts already exist, so phenotype reuse review is no longer the next blocker."
      : locked && acceptedRecommendations.length === 0
      ? "Phenotype review has been resolved for the locked package."
      : acceptedRecommendations.length > 0
      ? `${acceptedRecommendations.length} reusable phenotype or local asset recommendation has been accepted.`
      : recommendations.length > 0
        ? "Review Abby's ranked phenotype and reuse recommendations before drafting concept sets."
        : "Ask Abby to recommend reusable phenotypes, cohorts, and concept sets from the accepted intent.",
    actionLabel: acceptedRecommendations.length > 0 ? undefined : recommendations.length > 0 ? "Accept verified recommendation" : "Recommend phenotypes",
  };

  const conceptBlocker = firstBlockedAssetMessage(conceptDrafts);
  const conceptSetsStage: StudyCompilerStage = {
    id: "concept_sets",
    label: "Concept Sets",
    status: locked || materializedConceptSets.length > 0
      ? "complete"
      : conceptBlocker
        ? "blocked"
        : conceptDrafts.length > 0
          ? "active"
          : acceptedRecommendations.length > 0
            ? "active"
            : "pending",
    detail: locked && materializedConceptSets.length === 0
      ? "Concept set readiness has been resolved for the locked package."
      : materializedConceptSets.length > 0
      ? `${materializedConceptSets.length} concept set draft has been materialized as a native concept set.`
      : conceptDrafts.length > 0
        ? "Verify, repair, and accept concept set drafts before materializing them."
        : acceptedRecommendations.length > 0
          ? "Accepted recommendations are ready to become vocabulary-checked concept set drafts."
          : "Accept a verified recommendation before drafting concept sets.",
    actionLabel: materializedConceptSets.length > 0 ? undefined : conceptDrafts.length > 0 ? "Verify or repair concept draft" : "Draft concept sets",
    blocker: conceptBlocker,
  };

  const cohortBlocker = cohortBlockers[0] ?? firstBlockedAssetMessage(cohortDrafts);
  const cohortsStage: StudyCompilerStage = {
    id: "cohorts",
    label: "Cohorts",
    status: locked || cohortsReady || linkedCohorts.length > 0
      ? "complete"
      : cohortBlocker
        ? "blocked"
        : cohortDrafts.length > 0
          ? "active"
          : materializedConceptSets.length > 0
            ? "active"
            : "pending",
    detail: locked && linkedCohorts.length === 0 && materializedCohorts.length === 0
      ? "Cohort readiness has been resolved for the locked package."
      : cohortsReady || linkedCohorts.length > 0
      ? `${linkedCohorts.length || materializedCohorts.length} cohort draft has been materialized and linked for feasibility.`
      : cohortDrafts.length > 0
        ? "Verify, accept, materialize, and link cohort drafts before feasibility."
        : materializedConceptSets.length > 0
          ? "Materialized concept sets are ready to drive cohort drafts."
          : "Materialize at least one concept set before drafting cohorts.",
    actionLabel: cohortsReady || linkedCohorts.length > 0 ? undefined : cohortDrafts.length > 0 ? "Verify and link cohorts" : "Draft cohorts",
    blocker: cohortBlocker,
  };

  const feasibilityBlocker = cohortsReady ? null : cohortBlockers[0] ?? "Required study cohorts must be linked before source feasibility can run.";
  const feasibilityStage: StudyCompilerStage = {
    id: "feasibility",
    label: "Feasibility",
    status: locked
      ? "complete"
      : feasibilityAssets.length > 0
      ? feasibilityStatus === "blocked" ? "blocked" : "complete"
      : cohortsReady
        ? "active"
        : "pending",
    detail: locked && feasibilityAssets.length === 0
      ? "Feasibility readiness has been resolved for the locked package."
      : feasibilityAssets.length > 0
      ? `The latest feasibility run is ${feasibilityStatus || "available"} across selected CDM sources.`
      : cohortsReady
        ? "Linked cohorts are ready for a feasibility run against selected CDM sources."
        : "Feasibility waits until required cohorts are materialized and linked.",
    actionLabel: feasibilityAssets.length > 0 ? "Review feasibility evidence" : "Run feasibility",
    blocker: feasibilityAssets.length > 0 && feasibilityStatus === "blocked" ? issueMessages(arrayAt(feasibilityLatest, "blockers"))[0] : feasibilityBlocker,
  };

  const analysisBlocker = firstBlockedAssetMessage(analysisPlans);
  const analysisStage: StudyCompilerStage = {
    id: "analysis",
    label: "Analysis Plans",
    status: locked || materializedAnalyses.length > 0
      ? "complete"
      : analysisBlocker
        ? "blocked"
        : analysisPlans.length > 0
          ? "active"
          : feasibilityAssets.length > 0
            ? "active"
            : "pending",
    detail: locked && materializedAnalyses.length === 0
      ? "Analysis readiness has been resolved for the locked package."
      : materializedAnalyses.length > 0
      ? `${materializedAnalyses.length} analysis plan has been materialized as a native analysis.`
      : analysisPlans.length > 0
        ? "Verify and accept analysis plans before materializing them."
        : feasibilityAssets.length > 0
          ? "Feasibility evidence is ready to compile into HADES-compatible analysis plans."
          : "Run feasibility before drafting analysis plans.",
    actionLabel: materializedAnalyses.length > 0 ? undefined : analysisPlans.length > 0 ? "Verify or materialize plans" : "Draft analysis plans",
    blocker: analysisBlocker,
  };

  const lockStage: StudyCompilerStage = {
    id: "lock",
    label: "Package Lock",
    status: locked
      ? "complete"
      : lockBlockers.length > 0
        ? "blocked"
        : canLock || lockReady
          ? "active"
          : "pending",
    detail: locked
      ? "The design package is locked and available from study artifacts."
      : canLock || lockReady
        ? "The compiler package is ready for final review and lock."
        : "Locking waits until intent, concepts, cohorts, feasibility, and analyses pass readiness checks.",
    actionLabel: locked ? undefined : canLock || lockReady ? "Lock package" : "Resolve readiness blockers",
    blocker: lockBlockers[0],
  };

  const stages = [
    intentStage,
    currentAssetsStage,
    phenotypesStage,
    conceptSetsStage,
    cohortsStage,
    feasibilityStage,
    analysisStage,
    lockStage,
  ].map(withCompilerAction);
  const currentStage = stages.find((stage) => stage.status === "blocked")
    ?? stages.find((stage) => stage.status === "active")
    ?? stages.find((stage) => stage.status === "pending" && stage.id !== "current_assets")
    ?? lockStage;

  const localGuidance: StudyCompilerGuidance = {
    currentStage,
    nextAction: {
      label: currentStage.actionLabel ?? "Review compiler package",
      detail: currentStage.blocker ?? currentStage.detail,
      stageId: currentStage.id,
      action: currentStage.action,
    },
    stages,
    blockers: uniqueStrings([...lockBlockers, ...cohortBlockers, ...assetBlockers].filter(Boolean)),
    warnings: uniqueStrings([...lockWarnings, ...cohortWarnings, ...assetWarnings].filter(Boolean)),
    metrics: {
      recommendations: recommendations.length,
      acceptedRecommendations: acceptedRecommendations.length,
      conceptDrafts: conceptDrafts.length,
      materializedConceptSets: materializedConceptSets.length,
      cohortDrafts: cohortDrafts.length,
      linkedCohorts: linkedCohorts.length,
      feasibilityRuns: feasibilityAssets.length,
      materializedAnalyses: materializedAnalyses.length,
    },
  };

  return mergeBackendGuidance(localGuidance, backendGuidance);
}

function isRecommendationAsset(asset: StudyDesignAsset): boolean {
  return ["phenotype_recommendation", "local_cohort", "local_concept_set"].includes(asset.asset_type);
}

function withCompilerAction(stage: StudyCompilerStage): StudyCompilerStage {
  if (!stage.actionLabel) return stage;

  return {
    ...stage,
    action: {
      type: actionTypeForStage(stage.id, stage.actionLabel),
      stage_id: stage.id,
      label: stage.actionLabel,
      detail: stage.blocker ?? stage.detail,
    },
  };
}

function actionTypeForStage(stageId: StudyCompilerStageId, label: string): StudyCompilerActionType {
  const normalized = label.toLowerCase();
  if (normalized.includes("upload")) return "upload_protocol";
  if (normalized.includes("save review")) return "save_review";
  if (normalized.includes("accept intent")) return "accept_intent";
  if (normalized.includes("import current")) return "import_current_assets";
  if (normalized.includes("compatibility")) return "review_compatibility";
  if (normalized.includes("recommend")) return "recommend_phenotypes";
  if (normalized.includes("accept verified")) return "accept_recommendation";
  if (normalized.includes("concept") && normalized.includes("draft")) return normalized.includes("verify") || normalized.includes("repair") ? "repair_concept_draft" : "draft_concept_sets";
  if (normalized.includes("cohort")) return normalized.includes("verify") || normalized.includes("link") ? "link_materialized_cohort" : "draft_cohorts";
  if (normalized.includes("feasibility")) return normalized.includes("review") ? "review_feasibility" : "run_feasibility";
  if (normalized.includes("analysis") || normalized.includes("plans")) return normalized.includes("verify") || normalized.includes("materialize") ? "verify_analysis_plan" : "draft_analysis_plans";
  if (normalized.includes("lock")) return "lock_package";
  if (normalized.includes("resolve")) return "resolve_readiness_blockers";

  const fallbackByStage: Record<StudyCompilerStageId, StudyCompilerActionType> = {
    intent: "generate_intent",
    current_assets: "review_compatibility",
    phenotypes: "recommend_phenotypes",
    concept_sets: "draft_concept_sets",
    cohorts: "draft_cohorts",
    feasibility: "run_feasibility",
    analysis: "draft_analysis_plans",
    lock: "review_package",
  };

  return fallbackByStage[stageId];
}

function isMaterializedAsset(asset: StudyDesignAsset): boolean {
  return asset.status === "materialized" && asset.materialized_id != null;
}

function hasStudyCohortLink(asset: StudyDesignAsset): boolean {
  return isMaterializedAsset(asset) && typeof asset.provenance_json?.study_cohort_id === "number";
}

function firstBlockedAssetMessage(assets: StudyDesignAsset[]): string | null {
  const blockedAsset = assets.find((asset) => asset.verification_status === "blocked");
  if (!blockedAsset) return null;

  return issueMessages(arrayAt(blockedAsset.verification_json, "blocking_reasons"))[0]
    ?? "This draft is blocked by verifier checks.";
}

function issueMessages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((issue) => {
      if (typeof issue === "string") return issue;
      if (isRecord(issue)) return stringAt(issue, "message") ?? stringAt(issue, "code");
      return null;
    })
    .filter((message): message is string => typeof message === "string" && message.trim() !== "");
}

function arrayAt(source: unknown, key: string): unknown[] {
  if (!isRecord(source)) return [];
  const value = source[key];
  return Array.isArray(value) ? value : [];
}

function stringAt(source: unknown, key: string): string | null {
  if (!isRecord(source)) return null;
  const value = source[key];
  return typeof value === "string" ? value : null;
}

function booleanAt(source: unknown, key: string): boolean {
  if (!isRecord(source)) return false;
  return source[key] === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function mergeBackendGuidance(
  localGuidance: StudyCompilerGuidance,
  backendGuidance?: StudyDesignBackendGuidance | null,
): StudyCompilerGuidance {
  if (!backendGuidance?.sections?.length) {
    return localGuidance;
  }

  const sections = backendGuidance.sections.filter(isBackendSection);
  const sectionByStage = new Map<StudyCompilerStageId, StudyDesignBackendGuidanceSection>();
  for (const section of sections) {
    const stageId = stageIdForBackendSection(section.id);
    if (stageId) sectionByStage.set(stageId, section);
  }

  const stages = localGuidance.stages.map((stage) => {
    const section = sectionByStage.get(stage.id);
    if (!section) return stage;

    const firstAction = firstBackendAction(section.actions);
    const blocker = issueMessages(section.blockers)[0] ?? null;
    return {
      ...stage,
      label: section.label ?? stage.label,
      status: normalizeBackendStageStatus(section.status, stage.status),
      detail: section.summary ?? stage.detail,
      actionLabel: firstAction?.label ?? stage.actionLabel,
      action: firstAction ? backendActionToCompilerAction(firstAction, stage.id) : stage.action,
      blocker,
    };
  });

  const nextAction = firstBackendAction(backendGuidance.next_best_actions);
  const nextStageId = nextAction
    ? stageIdForBackendAction(nextAction) ?? localGuidance.currentStage.id
    : localGuidance.currentStage.id;
  const currentStage = nextAction
    ? stages.find((stage) => stage.id === nextStageId) ?? localGuidance.currentStage
    : stages.find((stage) => stage.status === "blocked")
      ?? stages.find((stage) => stage.status === "active")
      ?? localGuidance.currentStage;
  const initialGateIssues = issueMessages(backendGuidance.initial_gate?.issues);
  const backendBlockers = sections.flatMap((section) => issueMessages(section.blockers));
  const backendWarnings = sections.flatMap((section) => issueMessages(section.warnings));

  return {
    ...localGuidance,
    currentStage,
    nextAction: nextAction
      ? {
        label: nextAction.label ?? currentStage.actionLabel ?? localGuidance.nextAction.label,
        detail: backendActionDetail(nextAction) ?? currentStage.blocker ?? currentStage.detail,
        stageId: nextStageId,
        action: backendActionToCompilerAction(nextAction, nextStageId),
      }
      : localGuidance.nextAction,
    stages,
    blockers: uniqueStrings([
      ...initialGateIssues,
      ...backendBlockers,
      ...localGuidance.blockers,
    ]),
    warnings: uniqueStrings([
      ...backendWarnings,
      ...localGuidance.warnings,
    ]),
  };
}

function isBackendSection(value: unknown): value is StudyDesignBackendGuidanceSection {
  return isRecord(value) && typeof value.id === "string";
}

function firstBackendAction(actions: unknown): StudyDesignBackendGuidanceAction | null {
  if (!Array.isArray(actions)) return null;
  return actions.find(isRecord) as StudyDesignBackendGuidanceAction | undefined ?? null;
}

function normalizeBackendStageStatus(value: unknown, fallback: StudyCompilerStage["status"]): StudyCompilerStage["status"] {
  const status = typeof value === "string" ? value.toLowerCase() : "";
  if (["complete", "locked"].includes(status)) return "complete";
  if (["blocked", "failed", "error"].includes(status)) return "blocked";
  if (["active", "ready", "needs_review", "review_ready"].includes(status)) return "active";
  if (status === "pending") return "pending";
  return fallback;
}

function stageIdForBackendSection(sectionId: string | undefined): StudyCompilerStageId | null {
  switch (sectionId) {
    case "intent":
      return "intent";
    case "concept_sets":
      return "concept_sets";
    case "cohorts":
      return "cohorts";
    case "feasibility":
      return "feasibility";
    case "analysis_plans":
      return "analysis";
    case "package_lock":
      return "lock";
    default:
      return null;
  }
}

function stageIdForBackendAction(action: StudyDesignBackendGuidanceAction): StudyCompilerStageId | null {
  const sectionStage = stageIdForBackendSection(action.section);
  if (sectionStage) return sectionStage;

  const type = String(action.type ?? "");
  if (type.includes("initial_gate") || type.includes("intent")) return "intent";
  if (type.includes("concept")) return "concept_sets";
  if (type.includes("cohort")) return "cohorts";
  if (type.includes("feasibility")) return "feasibility";
  if (type.includes("analysis")) return "analysis";
  if (type.includes("review")) return "concept_sets";
  if (type.includes("lock") || type.includes("package")) return "lock";
  return null;
}

function backendActionToCompilerAction(
  action: StudyDesignBackendGuidanceAction,
  stageId: StudyCompilerStageId,
): StudyCompilerAction {
  return {
    type: action.type ?? "resolve_readiness_blockers",
    stage_id: stageId,
    label: action.label ?? "Review Abby guidance",
    detail: backendActionDetail(action) ?? action.detail,
    target: action.target,
    href: action.href,
  };
}

function backendActionDetail(action: StudyDesignBackendGuidanceAction): string | undefined {
  if (typeof action.detail === "string" && action.detail.trim() !== "") return action.detail;
  const issueMessage = issueMessages(action.issues)[0];
  if (issueMessage) return issueMessage;
  const details = action.details;
  if (isRecord(details) && typeof details.issue_count === "number") {
    return `${details.issue_count} issue${details.issue_count === 1 ? "" : "s"} need review.`;
  }
  return undefined;
}
