import type { ConceptSearchResult } from "../types";

/** Investigation concept set entry (lowercase, used in PhenotypeState) */
export interface InvestigationConceptEntry {
  concept_id: number;
  include_descendants: boolean;
  is_excluded: boolean;
}

/** OHDSI Atlas concept set expression item (uppercase) */
export interface AtlasConceptSetItem {
  concept: {
    CONCEPT_ID: number;
    CONCEPT_NAME: string;
    DOMAIN_ID: string;
    VOCABULARY_ID: string;
    CONCEPT_CLASS_ID: string;
    STANDARD_CONCEPT: string;
    CONCEPT_CODE: string;
  };
  isExcluded: boolean;
  includeDescendants: boolean;
  includeMapped: boolean;
}

export function toAtlasFormat(
  entries: InvestigationConceptEntry[],
  conceptLookup: Map<number, ConceptSearchResult>,
): AtlasConceptSetItem[] {
  return entries.map((entry) => {
    const concept = conceptLookup.get(entry.concept_id);
    return {
      concept: {
        CONCEPT_ID: entry.concept_id,
        CONCEPT_NAME: concept?.concept_name ?? `Concept ${entry.concept_id}`,
        DOMAIN_ID: concept?.domain_id ?? "Unknown",
        VOCABULARY_ID: concept?.vocabulary_id ?? "Unknown",
        CONCEPT_CLASS_ID: concept?.concept_class_id ?? "Unknown",
        STANDARD_CONCEPT: concept?.standard_concept ?? "S",
        CONCEPT_CODE: concept?.concept_code ?? "",
      },
      isExcluded: entry.is_excluded,
      includeDescendants: entry.include_descendants,
      includeMapped: true,
    };
  });
}

export function fromAtlasFormat(
  items: AtlasConceptSetItem[],
): InvestigationConceptEntry[] {
  return items.map((item) => ({
    concept_id: item.concept.CONCEPT_ID,
    include_descendants: item.includeDescendants,
    is_excluded: item.isExcluded,
  }));
}
