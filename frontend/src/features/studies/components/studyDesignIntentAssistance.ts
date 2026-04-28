import type { StudyDesignVersion } from "../types/study";
import {
  parseStudyDesignIntent,
  parseStudyDesignNormalizedSpec,
  parseStudyDesignProvenance,
  type StudyDesignIntent,
  type StudyDesignNormalizedSpec,
} from "../schemas/studyDesignSchemas";

export type IntentReviewFieldKey =
  | "researchQuestion"
  | "primaryObjective"
  | "population"
  | "exposure"
  | "comparator"
  | "outcome"
  | "time";

export interface IntentReviewFields {
  researchQuestion?: string | null;
  primaryObjective?: string | null;
  population?: string | null;
  exposure?: string | null;
  comparator?: string | null;
  outcome?: string | null;
  time?: string | null;
}

export interface IntentReviewConcern {
  fieldKey: IntentReviewFieldKey;
  fieldLabel: string;
  message: string;
}

export interface IntentReviewSuggestion {
  fieldKey: IntentReviewFieldKey;
  fieldLabel: string;
  action: string;
  draftValue?: string;
}

export interface IntentReviewProtocolSource {
  filename?: string;
  textLength?: number;
  truncated?: boolean;
  source?: string;
  harnessModel?: string;
  evaluatorProvider?: string;
  evaluatorModel?: string;
}

export interface IntentReviewEvidenceSpan {
  fieldKey?: IntentReviewFieldKey;
  fieldLabel: string;
  quote: string;
  confidence?: number;
  section?: string;
  page?: string;
}

export interface IntentReviewConfidenceField {
  fieldKey: IntentReviewFieldKey;
  fieldLabel: string;
  confidence: number;
}

export interface IntentReviewConfidenceSummary {
  overall?: number;
  fields: IntentReviewConfidenceField[];
}

export interface IntentReviewAssistance {
  status: "ready" | "needs_attention";
  summary: string;
  missingFields: IntentReviewConcern[];
  weakFields: IntentReviewConcern[];
  suggestions: IntentReviewSuggestion[];
  evidenceSpans: IntentReviewEvidenceSpan[];
  confidence: IntentReviewConfidenceSummary;
  openQuestions: string[];
  riskNotes: string[];
  uncertaintyNotes: string[];
  designAssumptions: string[];
  protocolSource: IntentReviewProtocolSource | null;
}

const FIELD_LABELS: Record<IntentReviewFieldKey, string> = {
  researchQuestion: "Research question",
  primaryObjective: "Primary objective",
  population: "Population",
  exposure: "Exposure",
  comparator: "Comparator",
  outcome: "Outcome",
  time: "Time at risk",
};

const REQUIRED_FIELDS: IntentReviewFieldKey[] = [
  "researchQuestion",
  "primaryObjective",
  "population",
  "exposure",
  "comparator",
  "outcome",
  "time",
];

export function buildIntentReviewAssistance(
  version: StudyDesignVersion,
  fields: IntentReviewFields = {},
): IntentReviewAssistance {
  // Boundary parse: convert raw JSON payloads into typed objects ONCE per
  // call. Downstream helpers consume the parsed shapes via property access
  // — no more defensive dotted-path drilling on raw intent_json/spec_json.
  const intent = parseStudyDesignIntent(version.intent_json);
  const spec = parseStudyDesignNormalizedSpec(version.normalized_spec_json);
  const provenance = parseStudyDesignProvenance(version.provenance_json);

  const resolved = resolveFields(intent, spec, fields);
  const missingFields = REQUIRED_FIELDS
    .filter((fieldKey) => isBlankOrPlaceholder(resolved[fieldKey]))
    .map((fieldKey) => ({
      fieldKey,
      fieldLabel: FIELD_LABELS[fieldKey],
      message: missingMessage(fieldKey),
    }));
  const missingKeys = new Set(missingFields.map((field) => field.fieldKey));
  const weakFields = weakFieldConcerns(resolved).filter((field) => !missingKeys.has(field.fieldKey));
  const suggestions = [
    ...missingFields.map((field) => suggestionForField(field.fieldKey, resolved)),
    ...weakFields.map((field) => suggestionForField(field.fieldKey, resolved)),
  ];
  const protocolSource = protocolSourceFromVersion(intent, spec, provenance);
  const evidenceSpans = evidenceSpansFromVersion(intent, spec);
  const confidence = confidenceFromVersion(intent, spec);
  const openQuestions = noteList(intent.open_questions ?? spec.open_questions);
  const riskNotes = noteList(intent.risk_notes ?? spec.risk_notes);
  const uncertaintyNotes = noteList(intent.uncertainty ?? spec.uncertainty);
  const designAssumptions = noteList(
    intent.design_assumptions ?? spec.design_assumptions,
  );
  const issueCount = missingFields.length + weakFields.length;

  return {
    status: issueCount === 0 ? "ready" : "needs_attention",
    summary: issueCount === 0
      ? "Abby found the core intent fields. Review the wording, then accept the intent when it matches the protocol."
      : `Abby found ${issueCount} intent field ${issueCount === 1 ? "entry" : "entries"} that need user review before downstream compiler assets are trusted.`,
    missingFields,
    weakFields,
    suggestions,
    evidenceSpans,
    confidence,
    openQuestions,
    riskNotes,
    uncertaintyNotes,
    designAssumptions,
    protocolSource,
  };
}

function resolveFields(
  intent: StudyDesignIntent,
  spec: StudyDesignNormalizedSpec,
  fields: IntentReviewFields,
): Required<IntentReviewFields> {
  return {
    researchQuestion: firstText(
      fields.researchQuestion,
      spec.study?.research_question,
      intent.research_question,
    ),
    primaryObjective: firstText(
      fields.primaryObjective,
      spec.study?.primary_objective,
      intent.primary_objective,
    ),
    population: firstText(
      fields.population,
      summaryFromPico(spec.pico?.population),
      intent.pico?.population,
      spec.study?.target_population_summary,
    ),
    exposure: firstText(
      fields.exposure,
      summaryFromPico(spec.pico?.intervention_or_exposure),
      summaryFromPico(spec.pico?.intervention),
      intent.pico?.intervention,
      intent.pico?.exposure,
    ),
    comparator: firstText(
      fields.comparator,
      summaryFromPico(spec.pico?.comparator),
      intent.pico?.comparator,
    ),
    outcome: firstText(
      fields.outcome,
      summaryFromPico(spec.pico?.outcomes?.[0]),
      summaryFromPico(spec.pico?.outcome),
      intent.pico?.outcome,
    ),
    time: firstText(
      fields.time,
      summaryFromPico(spec.pico?.time),
      summaryFromPico(spec.pico?.time_at_risk),
      intent.pico?.time_at_risk,
    ),
  };
}

function weakFieldConcerns(fields: Required<IntentReviewFields>): IntentReviewConcern[] {
  const concerns: IntentReviewConcern[] = [];

  if (isWeakComparator(fields.comparator)) {
    concerns.push({
      fieldKey: "comparator",
      fieldLabel: FIELD_LABELS.comparator,
      message: "Comparator wording is too generic for cohort construction.",
    });
  }

  if (isWeakOutcome(fields.outcome)) {
    concerns.push({
      fieldKey: "outcome",
      fieldLabel: FIELD_LABELS.outcome,
      message: "Outcome wording should identify an observable event or cohort endpoint.",
    });
  }

  if (isWeakTimeAtRisk(fields.time)) {
    concerns.push({
      fieldKey: "time",
      fieldLabel: FIELD_LABELS.time,
      message: "Time-at-risk wording should include the index anchor, start, end, and censoring logic.",
    });
  }

  return concerns;
}

function suggestionForField(
  fieldKey: IntentReviewFieldKey,
  fields: Required<IntentReviewFields>,
): IntentReviewSuggestion {
  switch (fieldKey) {
    case "researchQuestion":
      return {
        fieldKey,
        fieldLabel: FIELD_LABELS[fieldKey],
        action: "State the patient group, exposure, comparator, outcome, and timeframe as one answerable OHDSI question.",
        draftValue: "Among [population], what is the association between [exposure] and [outcome] during [time at risk], compared with [comparator]?",
      };
    case "primaryObjective":
      return {
        fieldKey,
        fieldLabel: FIELD_LABELS[fieldKey],
        action: "Use one measurable objective that matches the accepted research question.",
        draftValue: fields.researchQuestion
          ? `Evaluate ${sentenceFragment(fields.researchQuestion)}.`
          : "Evaluate the protocol-defined population, exposure, comparator, outcome, and time-at-risk in OMOP CDM.",
      };
    case "population":
      return {
        fieldKey,
        fieldLabel: FIELD_LABELS[fieldKey],
        action: "Name inclusion criteria, exclusion criteria, age or enrollment constraints, and required prior observation.",
        draftValue: "Patients meeting the protocol-defined eligibility criteria with sufficient prior observation in the OMOP CDM source.",
      };
    case "exposure":
      return {
        fieldKey,
        fieldLabel: FIELD_LABELS[fieldKey],
        action: "Define the index exposure or entry event and whether it is incident, prevalent, or first observed.",
        draftValue: "Protocol-defined index exposure or entry event, with incident/prevalent status and clean window confirmed before cohort drafting.",
      };
    case "comparator":
      return {
        fieldKey,
        fieldLabel: FIELD_LABELS[fieldKey],
        action: "Specify the comparator cohort, or explicitly mark the design as descriptive or single-arm.",
        draftValue: "No comparator cohort specified in the protocol; confirm descriptive/single-arm design or define an explicit comparator cohort.",
      };
    case "outcome":
      return {
        fieldKey,
        fieldLabel: FIELD_LABELS[fieldKey],
        action: "Name the primary outcome event and how it should be observed or derived in OMOP CDM.",
        draftValue: "Protocol-defined primary outcome event, represented as an OMOP-observable cohort or event definition.",
      };
    case "time":
      return {
        fieldKey,
        fieldLabel: FIELD_LABELS[fieldKey],
        action: "Define time-at-risk start, end, washout, and censoring relative to the index date.",
        draftValue: "Start at index date and follow until outcome occurrence, end of continuous observation, death, study end, or protocol-defined censoring.",
      };
  }
}

function missingMessage(fieldKey: IntentReviewFieldKey): string {
  switch (fieldKey) {
    case "researchQuestion":
      return "A research question is needed before the compiler can explain downstream choices.";
    case "primaryObjective":
      return "A primary objective keeps generated assets aligned with the protocol purpose.";
    case "population":
      return "Population eligibility is needed before cohort and concept set drafting.";
    case "exposure":
      return "Exposure or index event is needed before target cohort drafting.";
    case "comparator":
      return "Comparator is missing. If this is descriptive, make that explicit.";
    case "outcome":
      return "Primary outcome is needed before feasibility or analysis planning.";
    case "time":
      return "Time at risk is needed before cohort exit and analysis windows can be trusted.";
  }
}

function protocolSourceFromVersion(
  intent: StudyDesignIntent,
  spec: StudyDesignNormalizedSpec,
  provenance: ReturnType<typeof parseStudyDesignProvenance>,
): IntentReviewProtocolSource | null {
  // The Zod schema only formally types provenance.protocol_file. The
  // intent/spec `protocol_import` fields are unstructured fallbacks, so
  // narrow them defensively before reading filename/text_length/etc.
  const protocolFile =
    provenance.protocol_file
      ?? firstRecord(spec.protocol_import, intent.protocol_import);
  const source = textValue(provenance.source);
  const harnessModel = textValue(provenance.harness_model);
  const evaluatorProvider = textValue(provenance.evaluator_provider);
  const evaluatorModel = textValue(provenance.evaluator_model);

  if (!protocolFile && !source && !harnessModel && !evaluatorProvider && !evaluatorModel) {
    return null;
  }

  const filename = textValue(
    isRecord(protocolFile) ? protocolFile.filename : undefined,
  );
  const textLength = numberValue(
    isRecord(protocolFile) ? protocolFile.text_length : undefined,
  );
  const truncated = booleanValue(
    isRecord(protocolFile) ? protocolFile.truncated_for_ai : undefined,
  );

  return {
    filename,
    textLength,
    truncated,
    source,
    harnessModel,
    evaluatorProvider,
    evaluatorModel,
  };
}

function evidenceSpansFromVersion(
  intent: StudyDesignIntent,
  spec: StudyDesignNormalizedSpec,
): IntentReviewEvidenceSpan[] {
  const sources: unknown[] = [
    intent.evidence_spans,
    spec.evidence_spans,
    intent.protocol_evidence?.evidence_spans,
    spec.protocol_evidence?.evidence_spans,
  ];
  const seen = new Set<string>();
  const spans: IntentReviewEvidenceSpan[] = [];

  for (const source of sources) {
    for (const span of Array.isArray(source) ? source : []) {
      if (!isRecord(span)) continue;

      const quote = firstText(span.quote, span.evidence, span.excerpt, span.text);
      if (quote === "") continue;

      const fieldKey = fieldKeyFromProtocolField(firstText(span.field_key, span.field, span.name));
      const fieldLabel = fieldKey ? FIELD_LABELS[fieldKey] : firstText(span.label, span.field, "Protocol evidence");
      const confidence = numberValue(span.confidence);
      const section = firstText(span.section, span.heading);
      const page = pageValue(span.page);
      const item: IntentReviewEvidenceSpan = {
        fieldLabel,
        quote,
      };
      if (fieldKey) item.fieldKey = fieldKey;
      if (confidence !== undefined) item.confidence = confidence;
      if (section !== "") item.section = section;
      if (page !== undefined) item.page = page;
      const key = `${item.fieldLabel}:${item.quote}`;
      if (seen.has(key)) continue;
      seen.add(key);
      spans.push(item);
    }
  }

  return spans.slice(0, 8);
}

function confidenceFromVersion(
  intent: StudyDesignIntent,
  spec: StudyDesignNormalizedSpec,
): IntentReviewConfidenceSummary {
  const confidence = firstRecord(
    intent.confidence,
    spec.confidence,
    intent.protocol_evidence?.confidence,
    spec.protocol_evidence?.confidence,
  );
  if (!confidence) {
    return { fields: [] };
  }

  const fields = REQUIRED_FIELDS.flatMap((fieldKey) => {
    const value = numberValue(confidence[fieldKey] ?? confidence[protocolFieldFromFieldKey(fieldKey)]);
    return value === undefined
      ? []
      : [{
          fieldKey,
          fieldLabel: FIELD_LABELS[fieldKey],
          confidence: value,
        }];
  });

  return {
    overall: numberValue(confidence.overall),
    fields,
  };
}

function isWeakComparator(value: string | null | undefined): boolean {
  const normalized = normalize(value);

  return normalized === "control"
    || normalized === "controls"
    || normalized === "usual care"
    || normalized === "standard care"
    || normalized === "placebo"
    || normalized === "other treatment"
    || normalized === "none";
}

function isWeakOutcome(value: string | null | undefined): boolean {
  const normalized = normalize(value);
  if (normalized === "") return false;

  return normalized === "outcome"
    || normalized === "outcomes"
    || normalized === "event"
    || normalized === "events"
    || normalized === "clinical outcome"
    || normalized === "safety"
    || normalized === "efficacy";
}

function isWeakTimeAtRisk(value: string | null | undefined): boolean {
  const normalized = normalize(value);
  if (normalized === "") return false;

  const hasAnchor = /\b(index|entry|start|baseline|exposure|diagnosis|cohort)\b/.test(normalized);
  const hasEnd = /\b(end|until|through|follow|censor|observation|death|disenrollment|days?|weeks?|months?|years?)\b/.test(normalized);

  return normalized.length < 20 || !hasAnchor || !hasEnd;
}

function isBlankOrPlaceholder(value: string | null | undefined): boolean {
  const normalized = normalize(value);

  return normalized === ""
    || normalized === "n/a"
    || normalized === "na"
    || normalized === "none"
    || normalized === "not applicable"
    || normalized === "not specified"
    || normalized === "unspecified"
    || normalized === "unknown"
    || normalized === "tbd"
    || normalized === "to be determined";
}

/**
 * Pull a free-text summary out of a parsed pico subobject. Mirrors the
 * old `summaryAt(spec, "pico.population")` behaviour but operates on
 * Zod-parsed objects instead of dotted JSON paths.
 */
function summaryFromPico(subObject: unknown): string {
  if (typeof subObject === "string") return subObject.trim();
  if (!isRecord(subObject)) return "";
  return firstText(
    subObject.summary,
    subObject.label,
    subObject.title,
    subObject.description,
  );
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = textValue(value);
    if (text !== "") return text;
  }

  return "";
}

function firstRecord(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    if (isRecord(value)) return value;
  }

  return null;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function noteList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => noteText(item)).filter((item) => item !== "")
    : [];
}

function noteText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!isRecord(value)) return "";

  const message = firstText(value.message, value.question, value.summary, value.note, value.evidence);
  const fieldKey = fieldKeyFromProtocolField(firstText(value.field_key, value.field));
  if (!fieldKey || message === "") return message;

  return `${FIELD_LABELS[fieldKey]}: ${message}`;
}

function fieldKeyFromProtocolField(value: string): IntentReviewFieldKey | undefined {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  switch (normalized) {
    case "research_question":
    case "question":
      return "researchQuestion";
    case "primary_objective":
    case "objective":
      return "primaryObjective";
    case "population":
    case "target_population":
      return "population";
    case "exposure":
    case "intervention":
    case "intervention_or_exposure":
    case "index_event":
      return "exposure";
    case "comparator":
      return "comparator";
    case "outcome":
    case "primary_outcome":
      return "outcome";
    case "time":
    case "time_at_risk":
    case "follow_up":
      return "time";
    default:
      return undefined;
  }
}

function protocolFieldFromFieldKey(fieldKey: IntentReviewFieldKey): string {
  switch (fieldKey) {
    case "researchQuestion":
      return "research_question";
    case "primaryObjective":
      return "primary_objective";
    case "time":
      return "time_at_risk";
    default:
      return fieldKey;
  }
}

function pageValue(value: unknown): string | undefined {
  const text = textValue(value);
  if (text !== "") return text;
  const number = numberValue(value);
  return number === undefined ? undefined : String(number);
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function sentenceFragment(value: string): string {
  return value.trim().replace(/[?.!]+$/, "").replace(/^\w/, (match) => match.toLowerCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
