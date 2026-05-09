import type { Concept } from "@/features/vocabulary/types/vocabulary";
import type {
  Study,
  StudyAnalysisPlanDraft,
  StudyDesignAsset,
  StudyDesignDraftConcept,
  StudyDesignSpec,
  StudyDesignVersion,
  StudyFeasibilityResult,
  StudyReadinessAction,
} from "../../types/study";
import { tAuto } from "@/i18n/autoUserFacing";

export interface IntentFormState {
  researchQuestion: string;
  primaryObjective: string;
  population: string;
  exposure: string;
  comparator: string;
  outcome: string;
  time: string;
}

export function valueAt(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      const index = Number(part);
      return Number.isInteger(index) ? current[index] : undefined;
    }
    if (isRecord(current)) {
      return current[part];
    }
    return undefined;
  }, value);
}

export function summaryAt(value: unknown, path: string): string {
  const selected = valueAt(value, path);
  if (typeof selected === "string") return selected;
  if (isRecord(selected)) {
    const summary = selected.summary ?? selected.label ?? selected.title ?? selected.description;
    return typeof summary === "string" ? summary : "";
  }
  return "";
}

export function textAt(value: unknown, path: string): string {
  const selected = valueAt(value, path);
  return typeof selected === "string" ? selected : "";
}

export function objectAt(value: unknown, path: string): Record<string, unknown> {
  const selected = valueAt(value, path);
  return isRecord(selected) ? selected : {};
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function recordValue(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

export function arrayValue<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function draftPayloadRecord(asset: StudyDesignAsset): Record<string, unknown> {
  return isRecord(asset.draft_payload_json) ? asset.draft_payload_json : {};
}

export function draftConceptArray(value: unknown): StudyDesignDraftConcept[] {
  return arrayValue(value)
    .filter(isRecord)
    .map((concept) => ({
      concept_id: Number(concept.concept_id),
      is_excluded: concept.is_excluded === true,
      include_descendants: concept.include_descendants !== false,
      include_mapped: concept.include_mapped === true,
      rationale: typeof concept.rationale === "string" ? concept.rationale : null,
      concept: isRecord(concept.concept)
        ? {
          concept_id: Number(concept.concept.concept_id ?? concept.concept_id),
          concept_name: String(concept.concept.concept_name ?? `Concept ${concept.concept_id ?? "missing"}`),
          domain_id: String(concept.concept.domain_id ?? "Unknown"),
          vocabulary_id: String(concept.concept.vocabulary_id ?? "Unknown"),
          concept_class_id: String(concept.concept.concept_class_id ?? "Unknown"),
          standard_concept: typeof concept.concept.standard_concept === "string" ? concept.concept.standard_concept : null,
          concept_code: String(concept.concept.concept_code ?? concept.concept_id ?? ""),
          invalid_reason: typeof concept.concept.invalid_reason === "string" ? concept.concept.invalid_reason : null,
        }
        : undefined,
    }))
    .filter((concept) => Number.isFinite(concept.concept_id));
}

export function versionSpec(version: StudyDesignVersion): StudyDesignSpec {
  const spec = version.normalized_spec_json ?? {};
  return isRecord(spec) ? spec : emptySpec();
}

export function emptySpec(): StudyDesignSpec {
  return {
    schema_version: "1.0",
    study: {},
    pico: {},
  };
}

export function specToForm(spec: StudyDesignSpec): IntentFormState {
  return {
    researchQuestion: textAt(spec, "study.research_question"),
    primaryObjective: textAt(spec, "study.primary_objective"),
    population: summaryAt(spec, "pico.population"),
    exposure: summaryAt(spec, "pico.intervention_or_exposure") || summaryAt(spec, "pico.intervention"),
    comparator: summaryAt(spec, "pico.comparator"),
    outcome: summaryAt(spec, "pico.outcomes.0") || summaryAt(spec, "pico.outcome"),
    time: summaryAt(spec, "pico.time") || summaryAt(spec, "pico.time_at_risk"),
  };
}

export function formToSpec(spec: StudyDesignSpec, form: IntentFormState, study: Study): StudyDesignSpec {
  const current = isRecord(spec) ? spec : emptySpec();
  const currentStudy = isRecord(current.study) ? current.study : {};
  const currentPico = isRecord(current.pico) ? current.pico : {};

  return {
    ...current,
    study: {
      ...currentStudy,
      title: currentStudy.title || study.title,
      short_title: currentStudy.short_title ?? study.short_title,
      research_question: form.researchQuestion || textAt(currentStudy, "research_question") || study.primary_objective || "",
      primary_objective: form.primaryObjective,
      study_design: currentStudy.study_design || study.study_design || "observational",
      study_type: currentStudy.study_type || study.study_type || "custom",
      target_population_summary: form.population,
    },
    pico: {
      ...currentPico,
      population: { ...objectAt(currentPico, "population"), summary: form.population },
      intervention_or_exposure: { ...objectAt(currentPico, "intervention_or_exposure"), summary: form.exposure },
      comparator: { ...objectAt(currentPico, "comparator"), summary: form.comparator },
      outcomes: [{ ...objectAt(currentPico, "outcomes.0"), summary: form.outcome, primary: true }],
      time: { ...objectAt(currentPico, "time"), summary: form.time },
    },
  };
}

export function mutationError(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (isRecord(error) && isRecord(error.response) && isRecord(error.response.data)) {
    const data = error.response.data;
    const message = typeof data.message === "string" ? data.message : null;
    const issues = arrayValue(data.issues)
      .map((issue) => issueMessage(issue))
      .filter((issue) => issue !== "")
      .slice(0, 4);
    if (message && issues.length > 0) {
      return `${message} ${issues.join(" ")}`;
    }
    if (message) return message;
  }
  if (error instanceof Error) return error.message;
  return "Study design request failed.";
}

export function analysisDetailPath(type: string | undefined, id: number | null): string | null {
  if (id == null) return null;

  // Normalize: strip leading PHP namespace (e.g. "\\OHDSI\\CohortMethod" → "cohortmethod")
  // and lowercase. The lookup table accepts both short keys (cohort/route names)
  // and long PHP namespace forms emitted by imported_study_analysis assets.
  const normalized = (type ?? "").split("\\").pop()?.toLowerCase() ?? "";

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

export function analysisPlanIssues(issues: unknown, fallback: unknown): Array<{ message: string; action?: { label?: string } }> {
  const structured: Array<{ message: string; action?: { label?: string } }> = [];
  for (const issue of arrayValue(issues)) {
    const message = issueMessage(issue);
    if (!message) continue;

    const action = issueAction(issue);
    structured.push({ message, action: action ?? undefined });
  }

  if (structured.length > 0) return structured;

  return arrayValue(fallback).flatMap((message) => typeof message === "string" ? [{ message }] : []);
}

export function analysisPlanParameterRows(payload: Partial<StudyAnalysisPlanDraft>): Array<{ name: string; label: string; value?: unknown; message?: string }> {
  if (Array.isArray(payload.parameter_review)) {
    return payload.parameter_review
      .filter(isRecord)
      .map((row, index) => ({
        name: String(row.name ?? row.label ?? `parameter_${index}`),
        label: String(row.label ?? row.name ?? `Parameter ${index + 1}`),
        value: row.value,
        message: typeof row.message === "string" ? row.message : undefined,
      }));
  }

  const designJson = isRecord(payload.design_json) ? payload.design_json : {};
  return Object.entries(designJson).slice(0, 4).map(([key, value]) => ({
    name: key,
    label: key.replace(/_/g, " "),
    value,
    message: tAuto("reviewGeneratedDefault_b342a5ab"),
  }));
}

export function formatAnalysisParameterValue(value: unknown): string {
  if (value == null || value === "") return "Not set";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length} selected`;
  if (isRecord(value)) return Object.keys(value).slice(0, 4).join(", ");

  return String(value);
}

export function sourceLabel(source: string): string {
  return source
    .replace(/_/g, " ")
    .replace(/\bstudy-agent\b/i, "StudyAgent")
    .replace(/\bohdsi\b/i, "OHDSI");
}

export function formatEvidenceName(name: string): string {
  return name.replace(/_/g, " ");
}

export function formatRankComponent(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.0";
  if (value > 0) return `+${value.toFixed(1)}`;
  return value.toFixed(1);
}

export function conceptFromVocabulary(concept: Concept): StudyDesignDraftConcept {
  return {
    concept_id: concept.concept_id,
    is_excluded: false,
    include_descendants: true,
    include_mapped: false,
    concept: {
      concept_id: concept.concept_id,
      concept_name: concept.concept_name,
      domain_id: concept.domain_id,
      vocabulary_id: concept.vocabulary_id,
      concept_class_id: concept.concept_class_id,
      standard_concept: concept.standard_concept,
      concept_code: concept.concept_code,
      invalid_reason: concept.invalid_reason ?? null,
    },
  };
}

export function conceptDraftPayload(asset: StudyDesignAsset, concepts: StudyDesignDraftConcept[]) {
  const payload = draftPayloadRecord(asset);

  return {
    title: payload.title ?? `Concept set draft #${asset.id}`,
    role: payload.role ?? asset.role,
    domain: payload.domain ?? null,
    clinical_rationale: payload.clinical_rationale ?? null,
    search_terms: payload.search_terms ?? [],
    source_concept_set_references: payload.source_concept_set_references ?? [],
    // Drop concepts whose concept_id is null/NaN — saving them would corrupt the draft.
    concepts: concepts
      .filter((concept) => Number.isFinite(Number(concept.concept_id)))
      .map((concept) => ({
        concept_id: Number(concept.concept_id),
        is_excluded: concept.is_excluded ?? false,
        include_descendants: concept.include_descendants ?? true,
        include_mapped: concept.include_mapped ?? false,
        rationale: concept.rationale ?? null,
      })),
  };
}

export function cohortDraftPayload(asset: StudyDesignAsset, patch: Record<string, unknown>) {
  const payload = isRecord(asset.draft_payload_json) ? asset.draft_payload_json : {};
  const merged = {
    ...payload,
    ...patch,
  };

  return {
    title: merged.title ?? `Cohort draft #${asset.id}`,
    role: merged.role ?? asset.role ?? "target",
    logic_description: merged.logic_description ?? null,
    concept_set_ids: Array.isArray(merged.concept_set_ids) ? merged.concept_set_ids : [],
    concept_set_asset_ids: Array.isArray(merged.concept_set_asset_ids)
      ? merged.concept_set_asset_ids
      : Array.isArray(merged.source_asset_ids)
        ? merged.source_asset_ids
        : [],
    source_asset_ids: Array.isArray(merged.source_asset_ids)
      ? merged.source_asset_ids
      : Array.isArray(merged.concept_set_asset_ids)
        ? merged.concept_set_asset_ids
        : [],
    entry_event: isRecord(merged.entry_event) ? merged.entry_event : null,
    observation_window: isRecord(merged.observation_window) ? merged.observation_window : null,
    inclusion_rules: Array.isArray(merged.inclusion_rules) ? merged.inclusion_rules : [],
    censoring_criteria: Array.isArray(merged.censoring_criteria) ? merged.censoring_criteria : [],
    exit_strategy: typeof merged.exit_strategy === "string" ? merged.exit_strategy : null,
    collapse_settings: isRecord(merged.collapse_settings) ? merged.collapse_settings : null,
    role_link: isRecord(merged.role_link) ? merged.role_link : null,
    expression_json: isRecord(merged.expression_json) ? merged.expression_json : {},
  };
}

export function verificationCheckRows(verification: Record<string, unknown> | null | undefined): Array<{ name: string; status: string; message: string }> {
  if (!verification) return [];
  if (Array.isArray(verification.checklist)) {
    return verification.checklist
      .filter(isRecord)
      .map((check) => ({
        name: String(check.name ?? "check"),
        status: String(check.status ?? "info"),
        message: String(check.message ?? check.name ?? "Check"),
      }));
  }
  if (Array.isArray(verification.checks)) {
    return verification.checks
      .filter(isRecord)
      .map((check) => ({
        name: String(check.name ?? "check"),
        status: String(check.status ?? "info"),
        message: String(check.message ?? check.name ?? "Check"),
      }));
  }
  if (isRecord(verification.checks)) {
    return Object.entries(verification.checks).map(([name, passed]) => ({
      name,
      status: passed ? "pass" : "fail",
      message: `${passed ? "Pass" : "Fix"}: ${name.replace(/_/g, " ")}`,
    }));
  }
  return [];
}

export function issueMessages(value: unknown): string[] {
  return arrayValue(value)
    .map(issueMessage)
    .filter((message) => message !== "");
}

export function issueMessage(issue: unknown): string {
  if (typeof issue === "string") return issue;
  if (isRecord(issue) && typeof issue.message === "string") return issue.message;
  return "";
}

export function issueAction(issue: unknown): StudyReadinessAction | null {
  if (!isRecord(issue) || !isRecord(issue.action)) return null;
  return issue.action as StudyReadinessAction;
}

export function issueCode(issue: unknown): string {
  return isRecord(issue) && typeof issue.code === "string" ? issue.code : "";
}

export function feasibilityIssueGuidance(issue: unknown): string {
  switch (issueCode(issue)) {
    case "missing_cohort_generation":
      return "Generate the linked cohort on this CDM source, then rerun feasibility.";
    case "incomplete_cohort_generation":
      return "Wait for the source cohort generation to complete or repair the failed generation job.";
    case "empty_required_cohort":
      return "Review cohort logic or source coverage because this required role generated zero patients.";
    case "small_required_cohort":
      return "Confirm the small-cell threshold and decide whether this source can support the analysis.";
    case "missing_cdm_daimon":
    case "person_records_unavailable":
    case "missing_person_records":
    case "observation_periods_unavailable":
    case "missing_observation_periods":
      return "Review the source configuration and core OMOP CDM coverage before trusting this source.";
    case "missing_required_domain_records":
      return "Confirm whether the source has records in the domains required by this cohort role.";
    case "missing_concept_traceability":
      return "Return to linked cohorts and preserve concept-set traceability for diagnostics.";
    case "dqd_failed_checks":
      return "Review Data Quality Dashboard failures before moving this source into analysis planning.";
    case "source_freshness_unknown":
    case "source_freshness_stale":
      return "Confirm source release metadata and data freshness with the data partner.";
    default:
      return "Review the source-specific evidence and resolve this item before analysis planning.";
  }
}

export function feasibilityPreviousRun(
  feasibility: StudyFeasibilityResult | undefined,
  previousFeasibility: StudyFeasibilityResult | undefined,
): StudyFeasibilityResult["previous_run"] {
  if (feasibility?.previous_run) return feasibility.previous_run;
  if (!feasibility || !previousFeasibility) return null;

  return {
    status: previousFeasibility.status,
    ready_source_count: previousFeasibility.ready_source_count,
    source_count: previousFeasibility.source_count,
    min_cell_count: previousFeasibility.min_cell_count,
    ran_at: previousFeasibility.ran_at,
    delta_ready_source_count: feasibility.ready_source_count - previousFeasibility.ready_source_count,
    delta_source_count: feasibility.source_count - previousFeasibility.source_count,
    threshold_changed: feasibility.min_cell_count !== previousFeasibility.min_cell_count,
  };
}

export function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function normalizeCohortRole(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (normalized === "population" || normalized === "exposure" || normalized === "intervention") {
    return "target";
  }
  return normalized || "target";
}
