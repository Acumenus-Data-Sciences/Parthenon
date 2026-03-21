/**
 * safeState.ts
 *
 * Normalizers for domain state fields that may arrive as `[]` (empty JSON array)
 * from PHP's json_encode([]) when the column has never been written to.
 *
 * PHP serialises an uninitialised associative array as `[]` instead of `{}`,
 * which causes TypeScript objects with required fields to become empty arrays at
 * runtime. Every component that reads a domain state field must receive a
 * properly-shaped object, not an array.
 */

import type { ClinicalState, GenomicState, PhenotypeState, SynthesisState } from "../types";

/**
 * Returns true when `value` is missing OR is a plain array (PHP empty-array
 * serialisation artefact) OR is not an object at all.
 */
function isDegenerate(value: unknown): boolean {
  return !value || Array.isArray(value) || typeof value !== "object";
}

export function safePhenotypeState(state: unknown): PhenotypeState {
  if (isDegenerate(state)) {
    return {
      concept_sets: [],
      cohort_definition: null,
      selected_cohort_ids: [],
      primary_cohort_id: null,
      matching_config: null,
      import_mode: "parthenon",
      codewas_config: null,
      last_codewas_run_id: null,
    };
  }
  const s = state as Partial<PhenotypeState>;
  return {
    concept_sets: Array.isArray(s.concept_sets) ? s.concept_sets : [],
    cohort_definition: s.cohort_definition ?? null,
    selected_cohort_ids: Array.isArray(s.selected_cohort_ids) ? s.selected_cohort_ids : [],
    primary_cohort_id: s.primary_cohort_id ?? null,
    matching_config: s.matching_config ?? null,
    import_mode: s.import_mode ?? "parthenon",
    codewas_config: s.codewas_config ?? null,
    last_codewas_run_id: s.last_codewas_run_id ?? null,
  };
}

export function safeClinicalState(state: unknown): ClinicalState {
  if (isDegenerate(state)) {
    return {
      queued_analyses: [],
      selected_source_id: null,
      comparison_run_ids: null,
    };
  }
  const s = state as Partial<ClinicalState>;
  return {
    queued_analyses: Array.isArray(s.queued_analyses) ? s.queued_analyses : [],
    selected_source_id: s.selected_source_id ?? null,
    comparison_run_ids: s.comparison_run_ids ?? null,
  };
}

export function safeGenomicState(state: unknown): GenomicState {
  if (isDegenerate(state)) {
    return {
      open_targets_queries: [],
      gwas_catalog_queries: [],
      uploaded_gwas: [],
      uploaded_coloc: [],
      uploaded_finemap: [],
    };
  }
  const s = state as Partial<GenomicState>;
  return {
    open_targets_queries: Array.isArray(s.open_targets_queries) ? s.open_targets_queries : [],
    gwas_catalog_queries: Array.isArray(s.gwas_catalog_queries) ? s.gwas_catalog_queries : [],
    uploaded_gwas: Array.isArray(s.uploaded_gwas) ? s.uploaded_gwas : [],
    uploaded_coloc: Array.isArray(s.uploaded_coloc) ? s.uploaded_coloc : [],
    uploaded_finemap: Array.isArray(s.uploaded_finemap) ? s.uploaded_finemap : [],
  };
}

export function safeSynthesisState(state: unknown): SynthesisState {
  if (isDegenerate(state)) {
    return {
      section_order: [],
      section_narratives: {},
      export_history: [],
    };
  }
  const s = state as Partial<SynthesisState>;
  return {
    section_order: Array.isArray(s.section_order) ? s.section_order : [],
    section_narratives:
      s.section_narratives && !Array.isArray(s.section_narratives) && typeof s.section_narratives === "object"
        ? s.section_narratives
        : {},
    export_history: Array.isArray(s.export_history) ? s.export_history : [],
  };
}
