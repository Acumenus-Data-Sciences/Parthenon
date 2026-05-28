import type { AdminLibraryItemType } from "../api/adminLibraryApi";
import type { LibraryEntity } from "@/features/library/types";

/**
 * Maps the admin library's snake_case `item_type` (returned by the
 * `/admin/library` union endpoint) to the kebab-case lifecycle entity slug
 * consumed by the per-entity lifecycle endpoints
 * (`POST /{entity}/{id}/{promote|archive|restore}` and
 * `POST /{entity}/{bulk-archive|bulk-restore}`). This lets the super-admin
 * surface reuse the exact same lifecycle backend the feature pages use.
 */
export const ADMIN_ITEM_TYPE_TO_ENTITY: Record<
  AdminLibraryItemType,
  LibraryEntity
> = {
  concept_set: "concept-sets",
  cohort_definition: "cohort-definitions",
  characterization: "characterizations",
  incidence_rate_analysis: "incidence-rate-analyses",
  pathway_analysis: "pathway-analyses",
  estimation_analysis: "estimation-analyses",
  prediction_analysis: "prediction-analyses",
  feature_analysis: "feature-analyses",
  sccs_analysis: "sccs-analyses",
  evidence_synthesis_analysis: "evidence-synthesis-analyses",
  self_controlled_cohort_analysis: "self-controlled-cohort-analyses",
};

/** Human-friendly labels for the otherwise machine-readable `item_type`. */
const ITEM_TYPE_LABELS: Record<AdminLibraryItemType, string> = {
  concept_set: "Concept Set",
  cohort_definition: "Cohort Definition",
  characterization: "Characterization",
  incidence_rate_analysis: "Incidence Rate",
  pathway_analysis: "Pathway",
  estimation_analysis: "Estimation",
  prediction_analysis: "Prediction",
  feature_analysis: "Feature Extraction",
  sccs_analysis: "SCCS",
  evidence_synthesis_analysis: "Evidence Synthesis",
  self_controlled_cohort_analysis: "Self-Controlled Cohort",
};

export function entityForAdminItemType(type: AdminLibraryItemType): LibraryEntity {
  return ADMIN_ITEM_TYPE_TO_ENTITY[type];
}

export function adminItemTypeLabel(type: AdminLibraryItemType): string {
  return ITEM_TYPE_LABELS[type] ?? type;
}
