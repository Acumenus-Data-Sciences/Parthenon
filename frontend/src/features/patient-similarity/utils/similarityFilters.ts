import type { SimilarityFilters } from "../types/patientSimilarity";

const GENDER_CONCEPT_MAP: Record<string, number> = {
  MALE: 8507,
  FEMALE: 8532,
};

export function buildSimilarityFilters(
  ageMinInput: string,
  ageMaxInput: string,
  genderInput: string,
): SimilarityFilters | undefined {
  const filters: SimilarityFilters = {};

  const minAge = parseInt(ageMinInput, 10);
  const maxAge = parseInt(ageMaxInput, 10);

  if (!Number.isNaN(minAge) || !Number.isNaN(maxAge)) {
    const min = Math.max(0, Number.isNaN(minAge) ? 0 : minAge);
    const max = Math.min(150, Number.isNaN(maxAge) ? 150 : maxAge);
    filters.age_range = [Math.min(min, max), Math.max(min, max)];
  }

  const genderConceptId = GENDER_CONCEPT_MAP[genderInput];
  if (genderConceptId != null) {
    filters.gender_concept_id = genderConceptId;
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}
