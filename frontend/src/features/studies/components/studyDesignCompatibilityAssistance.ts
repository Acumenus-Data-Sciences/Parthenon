import type { StudyDesignAsset } from "../types/study";

export type CompatibilityGroupId =
  | "concept_sets"
  | "cohorts"
  | "analyses"
  | "feasibility"
  | "package";

export type CompatibilityStatus = "ready" | "review" | "blocked" | "empty";

export interface CompatibilityImportedAsset {
  id: number;
  groupId: CompatibilityGroupId;
  label: string;
  detail: string | null;
  role: string | null;
  status: string;
  verificationStatus: string;
  nativeLink: string | null;
  nativeLabel: string | null;
  blocker: string | null;
  warning: string | null;
}

export interface CompatibilityTask {
  id: number;
  groupId: CompatibilityGroupId;
  code: string;
  severity: string;
  message: string;
  actionLabel: string;
  actionTarget: string;
  policy: string;
  nativeLink: string | null;
}

export interface CompatibilityGroup {
  id: CompatibilityGroupId;
  label: string;
  status: CompatibilityStatus;
  importedAssets: CompatibilityImportedAsset[];
  tasks: CompatibilityTask[];
  nextAction: string;
}

export interface CompatibilityAssistance {
  status: "ready" | "review" | "blocked" | "empty";
  summary: string;
  policy: string;
  metrics: {
    imported: number;
    critiques: number;
    blocking: number;
    review: number;
    nativeLinks: number;
  };
  groups: CompatibilityGroup[];
}

const GROUP_LABELS: Record<CompatibilityGroupId, string> = {
  concept_sets: "Concept Sets",
  cohorts: "Cohorts",
  analyses: "Analyses",
  feasibility: "Feasibility",
  package: "Package Readiness",
};

const GROUP_ORDER: CompatibilityGroupId[] = [
  "concept_sets",
  "cohorts",
  "analyses",
  "feasibility",
  "package",
];

export function buildCompatibilityAssistance(assets: StudyDesignAsset[]): CompatibilityAssistance {
  const importedAssets = assets
    .filter((asset) => asset.asset_type.startsWith("imported_"))
    .map(importedAssetSummary);
  const tasks = assets
    .filter((asset) => asset.asset_type === "design_critique")
    .map(critiqueTask);
  const groups = GROUP_ORDER.map((groupId) => groupSummary(
    groupId,
    importedAssets.filter((asset) => asset.groupId === groupId),
    tasks.filter((task) => task.groupId === groupId),
  ));
  const blocking = tasks.filter((task) => task.severity === "blocking").length
    + importedAssets.filter((asset) => asset.verificationStatus === "blocked").length;
  const review = tasks.filter((task) => task.severity !== "blocking").length
    + importedAssets.filter((asset) => asset.warning !== null).length;
  const nativeLinks = importedAssets.filter((asset) => asset.nativeLink !== null).length;
  const status = importedAssets.length === 0 && tasks.length === 0
    ? "empty"
    : blocking > 0
      ? "blocked"
      : review > 0 || tasks.length > 0
        ? "review"
        : "ready";

  return {
    status,
    summary: summaryText(status, importedAssets.length, tasks.length, blocking),
    policy: "Review-only: Abby compatibility tasks do not modify existing cohorts, concept sets, analyses, or study metadata.",
    metrics: {
      imported: importedAssets.length,
      critiques: tasks.length,
      blocking,
      review,
      nativeLinks,
    },
    groups,
  };
}

function groupSummary(
  groupId: CompatibilityGroupId,
  importedAssets: CompatibilityImportedAsset[],
  tasks: CompatibilityTask[],
): CompatibilityGroup {
  const hasBlockedAsset = importedAssets.some((asset) => asset.verificationStatus === "blocked");
  const hasBlockingTask = tasks.some((task) => task.severity === "blocking");
  const hasReviewTask = tasks.length > 0 || importedAssets.some((asset) => asset.warning !== null);
  const status: CompatibilityStatus = hasBlockedAsset || hasBlockingTask
    ? "blocked"
    : hasReviewTask
      ? "review"
      : importedAssets.length > 0
        ? "ready"
        : "empty";

  return {
    id: groupId,
    label: GROUP_LABELS[groupId],
    status,
    importedAssets,
    tasks,
    nextAction: nextActionForGroup(groupId, status),
  };
}

function importedAssetSummary(asset: StudyDesignAsset): CompatibilityImportedAsset {
  const payload = recordValue(asset.draft_payload_json);
  const verification = recordValue(asset.verification_json);
  const blockers = stringList(verification.blocking_reasons);
  const warnings = stringList(verification.warnings);
  const groupId = groupForImportedAsset(asset.asset_type);
  const native = nativeLinkForAsset(asset, payload);

  return {
    id: asset.id,
    groupId,
    label: importedAssetLabel(asset, payload),
    detail: importedAssetDetail(asset, payload),
    role: asset.role,
    status: asset.status,
    verificationStatus: asset.verification_status,
    nativeLink: native?.link ?? null,
    nativeLabel: native?.label ?? null,
    blocker: blockers[0] ?? null,
    warning: warnings[0] ?? null,
  };
}

function critiqueTask(asset: StudyDesignAsset): CompatibilityTask {
  const payload = recordValue(asset.draft_payload_json);
  const code = textValue(payload.code) || "design_critique";
  const severity = textValue(payload.severity) || "review";
  const meta = recordValue(payload.meta);
  const groupId = groupForCritiqueCode(code);
  const action = actionForCritique(code, meta);

  return {
    id: asset.id,
    groupId,
    code,
    severity,
    message: textValue(payload.message) || "Review this compatibility finding.",
    actionLabel: action.label,
    actionTarget: action.target,
    policy: textValue(payload.policy) || "Critique findings are review-only and do not mutate canonical records.",
    nativeLink: action.nativeLink,
  };
}

function groupForImportedAsset(assetType: string): CompatibilityGroupId {
  if (assetType === "imported_concept_set") return "concept_sets";
  if (assetType === "imported_study_cohort") return "cohorts";
  if (assetType === "imported_study_analysis") return "analyses";
  return "package";
}

function groupForCritiqueCode(code: string): CompatibilityGroupId {
  switch (code) {
    case "missing_concept_metadata":
      return "concept_sets";
    case "missing_target_cohort":
    case "missing_comparator_cohort":
    case "deprecated_cohort":
      return "cohorts";
    case "analysis_missing_required_roles":
      return "analyses";
    case "missing_feasibility_evidence":
    case "feasibility_not_ready":
      return "feasibility";
    default:
      return "package";
  }
}

function actionForCritique(
  code: string,
  meta: Record<string, unknown>,
): { label: string; target: string; nativeLink: string | null } {
  switch (code) {
    case "missing_concept_metadata":
      return {
        label: "Repair concept-set traceability",
        target: "Open the cohort and confirm source concept sets before lock.",
        nativeLink: numberValue(meta.cohort_definition_id)
          ? `/cohort-definitions/${numberValue(meta.cohort_definition_id)}`
          : null,
      };
    case "missing_target_cohort":
      return {
        label: "Link or draft target cohort",
        target: "Create, import, or map a target cohort before feasibility.",
        nativeLink: null,
      };
    case "missing_comparator_cohort":
      return {
        label: "Resolve comparator requirement",
        target: "Link a comparator cohort or mark the design as descriptive/single-arm.",
        nativeLink: null,
      };
    case "deprecated_cohort":
      return {
        label: "Replace deprecated cohort",
        target: "Open the native cohort definition and create a replacement before lock.",
        nativeLink: numberValue(meta.cohort_definition_id)
          ? `/cohort-definitions/${numberValue(meta.cohort_definition_id)}`
          : null,
      };
    case "missing_feasibility_evidence":
      return {
        label: "Run feasibility",
        target: "Run source-aware feasibility after required cohorts are linked.",
        nativeLink: null,
      };
    case "feasibility_not_ready":
      return {
        label: "Resolve feasibility blockers",
        target: "Review the latest feasibility result and repair blocking cohorts or sources.",
        nativeLink: null,
      };
    case "analysis_missing_required_roles":
      return {
        label: "Map required cohort roles",
        target: "Link target, comparator, or outcome roles required by the native analysis.",
        nativeLink: null,
      };
    case "pico_gap":
      return {
        label: "Update intent review",
        target: "Return to Intent Review and save the missing PICO field.",
        nativeLink: null,
      };
    default:
      return {
        label: "Review compatibility finding",
        target: "Document a reviewer decision before package lock.",
        nativeLink: null,
      };
  }
}

function nativeLinkForAsset(
  asset: StudyDesignAsset,
  payload: Record<string, unknown>,
): { link: string; label: string } | null {
  const id = asset.materialized_id ?? asset.canonical_id;
  if (id == null) return null;

  if (asset.asset_type === "imported_concept_set") {
    return { link: `/concept-sets/${id}`, label: `Native concept set #${id}` };
  }

  if (asset.asset_type === "imported_study_cohort") {
    return { link: `/cohort-definitions/${id}`, label: `Native cohort #${id}` };
  }

  if (asset.asset_type === "imported_study_analysis") {
    const analysisPath = analysisDetailPath(textValue(payload.analysis_type), id);
    return analysisPath ? { link: analysisPath, label: `Native analysis #${id}` } : null;
  }

  return null;
}

function analysisDetailPath(type: string, id: number): string | null {
  const normalized = type.split("\\").pop()?.toLowerCase() ?? type.toLowerCase();
  const basePath = {
    characterization: "/analyses/characterizations",
    characterizations: "/analyses/characterizations",
    cohortincidence: "/analyses/incidence-rates",
    incidence_rate: "/analyses/incidence-rates",
    treatmentpatterns: "/analyses/pathways",
    pathway: "/analyses/pathways",
    cohortmethod: "/analyses/estimations",
    estimation: "/analyses/estimations",
    patientlevelprediction: "/analyses/predictions",
    prediction: "/analyses/predictions",
    selfcontrolledcaseseries: "/analyses/sccs",
    sccs: "/analyses/sccs",
    selfcontrolledcohort: "/analyses/self-controlled-cohorts",
    self_controlled_cohort: "/analyses/self-controlled-cohorts",
    evidencesynthesis: "/analyses/evidence-synthesis",
    evidence_synthesis: "/analyses/evidence-synthesis",
  }[normalized];

  return basePath ? `${basePath}/${id}` : null;
}

function importedAssetLabel(asset: StudyDesignAsset, payload: Record<string, unknown>): string {
  return firstText(
    payload.title,
    payload.label,
    payload.cohort_definition_name,
    payload.description,
    asset.asset_type.replace(/^imported_/, "").replace(/_/g, " "),
  );
}

function importedAssetDetail(asset: StudyDesignAsset, payload: Record<string, unknown>): string | null {
  if (asset.asset_type === "imported_study_cohort") {
    return firstText(payload.description, payload.cohort_definition_name) || null;
  }

  if (asset.asset_type === "imported_study_analysis") {
    return firstText(payload.description, payload.analysis_type) || null;
  }

  return firstText(payload.description) || null;
}

function nextActionForGroup(groupId: CompatibilityGroupId, status: CompatibilityStatus): string {
  if (status === "blocked") {
    return {
      concept_sets: "Repair blocked concept-set traceability before package lock.",
      cohorts: "Repair or replace blocked cohort definitions before feasibility.",
      analyses: "Map required roles before native analysis can be trusted.",
      feasibility: "Run or repair feasibility evidence before analysis planning or lock.",
      package: "Resolve package readiness findings before lock.",
    }[groupId];
  }

  if (status === "review") {
    return "Review Abby's compatibility tasks and document the reviewer decision.";
  }

  if (status === "ready") {
    return "Imported native assets are available for downstream compiler readiness.";
  }

  return "Import current study assets or run critique when this stage applies.";
}

function summaryText(status: CompatibilityAssistance["status"], imported: number, tasks: number, blocking: number): string {
  if (status === "empty") {
    return "Import current study assets when the study already has bottom-up cohorts, concept sets, or analyses.";
  }

  if (status === "blocked") {
    return `Abby found ${blocking} blocking compatibility ${blocking === 1 ? "task" : "tasks"} across ${imported} imported native ${imported === 1 ? "asset" : "assets"}.`;
  }

  if (status === "review") {
    return `Abby found ${tasks} compatibility ${tasks === 1 ? "task" : "tasks"} for ${imported} imported native ${imported === 1 ? "asset" : "assets"}.`;
  }

  return `${imported} imported native ${imported === 1 ? "asset is" : "assets are"} compatible with the current compiler path.`;
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = textValue(value);
    if (text !== "") return text;
  }

  return "";
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => textValue(item)).filter((item) => item !== "")
    : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
