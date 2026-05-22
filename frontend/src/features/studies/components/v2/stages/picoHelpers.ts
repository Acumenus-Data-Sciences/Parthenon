import type { IntentFormState } from "../../workbench/studyDesignWorkbenchHelpers";
import type {
  IntentReviewAssistance,
  IntentReviewEvidenceSpan,
  IntentReviewFieldKey,
} from "../../studyDesignIntentAssistance";

export type NodeId = "population" | "exposure" | "comparator" | "outcome";

export type ProvenanceTone = "teal" | "gold" | "slate";

export interface NodeMeta {
  label: string;
  fieldKey: IntentReviewFieldKey;
  formKey: keyof IntentFormState;
  /** Mono eyebrow above the value in the SVG. */
  eyebrow: string;
  /** Placeholder shown when the field is blank. */
  placeholder: string;
}

export const NODE_META: Record<NodeId, NodeMeta> = {
  population: {
    label: "Population",
    fieldKey: "population",
    formKey: "population",
    eyebrow: "POPULATION",
    placeholder: "Click to add Population…",
  },
  exposure: {
    label: "Exposure",
    fieldKey: "exposure",
    formKey: "exposure",
    eyebrow: "EXPOSURE",
    placeholder: "Click to add Exposure…",
  },
  comparator: {
    label: "Comparator",
    fieldKey: "comparator",
    formKey: "comparator",
    eyebrow: "COMPARATOR",
    placeholder: "Click to add Comparator…",
  },
  outcome: {
    label: "Outcome",
    fieldKey: "outcome",
    formKey: "outcome",
    eyebrow: "OUTCOME",
    placeholder: "Click to add Outcome…",
  },
};

export const ALL_NODE_IDS: readonly NodeId[] = [
  "population",
  "exposure",
  "comparator",
  "outcome",
];

export interface ProvenanceEntry {
  tone: ProvenanceTone;
  label: string;
  tooltip: string;
}

export function buildProvenanceMap(
  assistance: IntentReviewAssistance | null,
  formState: IntentFormState,
): Record<NodeId, ProvenanceEntry> {
  const result: Record<NodeId, ProvenanceEntry> = {
    population: { tone: "slate", label: "manual", tooltip: "Manual entry" },
    exposure: { tone: "slate", label: "manual", tooltip: "Manual entry" },
    comparator: { tone: "slate", label: "manual", tooltip: "Manual entry" },
    outcome: { tone: "slate", label: "manual", tooltip: "Manual entry" },
  };

  for (const node of ALL_NODE_IDS) {
    const meta = NODE_META[node];
    const value = formState[meta.formKey];
    if (!value || value.trim() === "") {
      result[node] = { tone: "slate", label: "—", tooltip: "Not set" };
      continue;
    }

    const needsReview = assistance ? hasConcernFor(assistance, meta.fieldKey) : false;
    const evidence = findEvidenceFor(assistance, meta.fieldKey);

    if (needsReview) {
      result[node] = {
        tone: "gold",
        label: evidence ? formatEvidenceLabel(evidence) : "needs review",
        tooltip: evidence
          ? formatEvidenceTooltip(evidence)
          : "Abby flagged this field for review",
      };
    } else if (evidence) {
      result[node] = {
        tone: "teal",
        label: formatEvidenceLabel(evidence),
        tooltip: formatEvidenceTooltip(evidence),
      };
    } else {
      result[node] = { tone: "teal", label: "confirmed", tooltip: "Field confirmed" };
    }
  }

  return result;
}

function hasConcernFor(
  assistance: IntentReviewAssistance,
  fieldKey: IntentReviewFieldKey,
): boolean {
  const inMissing = assistance.missingFields.some((c) => c.fieldKey === fieldKey);
  const inWeak = assistance.weakFields.some((c) => c.fieldKey === fieldKey);
  return inMissing || inWeak;
}

function findEvidenceFor(
  assistance: IntentReviewAssistance | null,
  fieldKey: IntentReviewFieldKey,
): IntentReviewEvidenceSpan | null {
  if (!assistance) return null;
  return assistance.evidenceSpans.find((span) => span.fieldKey === fieldKey) ?? null;
}

function formatEvidenceLabel(evidence: IntentReviewEvidenceSpan): string {
  const parts: string[] = [];
  if (evidence.page) parts.push(`p.${evidence.page}`);
  if (evidence.confidence !== undefined) {
    parts.push(`conf ${formatConfidence(evidence.confidence)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "evidence";
}

function formatEvidenceTooltip(evidence: IntentReviewEvidenceSpan): string {
  const parts: string[] = [];
  if (evidence.section) parts.push(evidence.section);
  if (evidence.page) parts.push(`p.${evidence.page}`);
  if (evidence.confidence !== undefined) {
    parts.push(`conf ${formatConfidence(evidence.confidence)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "evidence";
}

function formatConfidence(value: number): string {
  const fraction = value <= 1 ? value : value / 100;
  return fraction.toFixed(2);
}

export function clamp(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}
