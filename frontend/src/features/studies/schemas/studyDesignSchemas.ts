import { z } from "zod";

/**
 * Zod schemas for Study Design intent / normalized-spec payloads.
 *
 * These types describe what `studyDesignIntentAssistance.ts` reads from
 * `version.intent_json` and `version.normalized_spec_json`. Backend
 * documents may carry many additional fields beyond these — `.loose()`
 * (Zod v4 successor of `.passthrough()`) preserves unknown keys instead
 * of stripping them so we don't lose evidence the UI later wants.
 *
 * Quick task 260428-gu8 — the immediate goal is to replace ~30 defensive
 * `valueAt(intent_json, "...")` lookups with typed property access at the
 * boundary. Use `parseStudyDesignIntent` / `parseStudyDesignNormalizedSpec`
 * to coerce unknown JSON into the expected shape; both helpers never throw
 * — invalid input falls back to an empty object so downstream callers can
 * keep their existing nullish-fallback patterns.
 */

const stringOptional = z.string().optional();

/** A pico subobject — every field has a free-text `summary` plus arbitrary
 * metadata that may include numeric flags, evidence references, etc. */
const picoSubObjectSchema = z
  .object({
    summary: stringOptional,
    label: stringOptional,
    title: stringOptional,
    description: stringOptional,
  })
  .loose()
  .optional();

/** Outcomes are an array of pico-shaped subobjects. */
const outcomesSchema = z.array(picoSubObjectSchema.unwrap()).optional();

/** Evidence span shape used in protocol_evidence and confidence reporting. */
const evidenceSpanSchema = z
  .object({
    field_key: stringOptional,
    field: stringOptional,
    label: stringOptional,
    name: stringOptional,
    quote: stringOptional,
    evidence: stringOptional,
    excerpt: stringOptional,
    text: stringOptional,
    section: stringOptional,
    heading: stringOptional,
    page: z.union([z.string(), z.number()]).optional(),
    confidence: z.number().optional(),
  })
  .loose();

const confidenceFieldsSchema = z
  .object({
    overall: z.number().optional(),
  })
  .loose();

/**
 * intent_json shape — produced by the LLM intent compiler / protocol
 * import pipeline.
 */
export const studyDesignIntentSchema = z
  .object({
    research_question: stringOptional,
    primary_objective: stringOptional,
    pico: z
      .object({
        population: z.unknown().optional(),
        intervention: z.unknown().optional(),
        intervention_or_exposure: z.unknown().optional(),
        exposure: z.unknown().optional(),
        comparator: z.unknown().optional(),
        outcome: z.unknown().optional(),
        outcomes: z.unknown().optional(),
        time: z.unknown().optional(),
        time_at_risk: z.unknown().optional(),
      })
      .loose()
      .optional(),
    open_questions: z.array(z.unknown()).optional(),
    risk_notes: z.array(z.unknown()).optional(),
    uncertainty: z.array(z.unknown()).optional(),
    design_assumptions: z.array(z.unknown()).optional(),
    evidence_spans: z.array(evidenceSpanSchema).optional(),
    confidence: confidenceFieldsSchema.optional(),
    protocol_evidence: z
      .object({
        evidence_spans: z.array(evidenceSpanSchema).optional(),
        confidence: confidenceFieldsSchema.optional(),
      })
      .loose()
      .optional(),
    protocol_import: z.unknown().optional(),
  })
  .loose();

/**
 * normalized_spec_json shape — the canonical normalized representation
 * produced after intent acceptance / form-state save.
 */
export const studyDesignNormalizedSpecSchema = z
  .object({
    schema_version: stringOptional,
    study: z
      .object({
        title: stringOptional,
        short_title: stringOptional,
        research_question: stringOptional,
        primary_objective: stringOptional,
        study_design: stringOptional,
        study_type: stringOptional,
        target_population_summary: stringOptional,
      })
      .loose()
      .optional(),
    pico: z
      .object({
        population: picoSubObjectSchema,
        intervention: picoSubObjectSchema,
        intervention_or_exposure: picoSubObjectSchema,
        exposure: picoSubObjectSchema,
        comparator: picoSubObjectSchema,
        outcome: picoSubObjectSchema,
        outcomes: outcomesSchema,
        time: picoSubObjectSchema,
        time_at_risk: picoSubObjectSchema,
      })
      .loose()
      .optional(),
    open_questions: z.array(z.unknown()).optional(),
    risk_notes: z.array(z.unknown()).optional(),
    uncertainty: z.array(z.unknown()).optional(),
    design_assumptions: z.array(z.unknown()).optional(),
    evidence_spans: z.array(evidenceSpanSchema).optional(),
    confidence: confidenceFieldsSchema.optional(),
    protocol_evidence: z
      .object({
        evidence_spans: z.array(evidenceSpanSchema).optional(),
        confidence: confidenceFieldsSchema.optional(),
      })
      .loose()
      .optional(),
    protocol_import: z.unknown().optional(),
  })
  .loose();

/**
 * provenance_json shape — populated by the protocol import + Abby
 * orchestration pipelines. Surfaces protocol file metadata and
 * evaluator/harness model identifiers used by the IntentReview panel.
 */
export const studyDesignProvenanceSchema = z
  .object({
    source: stringOptional,
    harness_model: stringOptional,
    evaluator_provider: stringOptional,
    evaluator_model: stringOptional,
    protocol_file: z
      .object({
        filename: stringOptional,
        text_length: z.number().optional(),
        truncated_for_ai: z.boolean().optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

export type StudyDesignIntent = z.infer<typeof studyDesignIntentSchema>;
export type StudyDesignNormalizedSpec = z.infer<
  typeof studyDesignNormalizedSpecSchema
>;
export type StudyDesignProvenance = z.infer<
  typeof studyDesignProvenanceSchema
>;

/** Coerce unknown JSON into a typed StudyDesignIntent. Never throws —
 * invalid input falls back to `{}` so existing nullish-fallback patterns
 * keep working. */
export function parseStudyDesignIntent(value: unknown): StudyDesignIntent {
  const result = studyDesignIntentSchema.safeParse(value);
  return result.success ? result.data : {};
}

/** Coerce unknown JSON into a typed StudyDesignNormalizedSpec. Never throws. */
export function parseStudyDesignNormalizedSpec(
  value: unknown,
): StudyDesignNormalizedSpec {
  const result = studyDesignNormalizedSpecSchema.safeParse(value);
  return result.success ? result.data : {};
}

/** Coerce unknown JSON into a typed StudyDesignProvenance. Never throws. */
export function parseStudyDesignProvenance(
  value: unknown,
): StudyDesignProvenance {
  const result = studyDesignProvenanceSchema.safeParse(value);
  return result.success ? result.data : {};
}
