export interface Concept {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  concept_class_id: string;
  standard_concept: string | null;
  concept_code: string;
  valid_start_date?: string;
  valid_end_date?: string;
  invalid_reason?: string | null;
  synonyms?: { concept_synonym_name: string }[];
}

export interface ConceptRelationship {
  concept_id_1: number;
  concept_id_2: number;
  relationship_id: string;
  related_concept: Concept;
}

export interface ConceptHierarchyNode {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  concept_class_id: string;
  standard_concept: string | null;
  depth: number;
  children?: ConceptHierarchyNode[];
  is_current?: boolean;
}

export interface VocabularyInfo {
  vocabulary_id: string;
  vocabulary_name: string;
  vocabulary_concept_id: number;
  vocabulary_version: string | null;
}

export interface DomainInfo {
  domain_id: string;
  domain_name: string;
  domain_concept_id: number;
}

export interface ConceptSearchParams {
  q: string;
  domain?: string;
  vocabulary?: string;
  standard?: boolean;
  concept_class?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

export interface FacetCounts {
  domain_id?: Record<string, number>;
  vocabulary_id?: Record<string, number>;
  concept_class_id?: Record<string, number>;
  standard_concept?: Record<string, number>;
}

export interface ConceptSearchResult {
  items: Concept[];
  total: number;
  page: number;
  limit: number;
  facets?: FacetCounts;
  highlights?: Record<string, Record<string, string[]>>;
  engine?: "solr" | "postgresql";
}

export interface SuggestResult {
  concept_name: string;
  weight: number;
}

export interface PaginatedRelationships {
  items: ConceptRelationship[];
  total: number;
  page: number;
  limit: number;
}

export interface SemanticSearchResult {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  score: number;
}

export interface ConceptComparisonEntry {
  concept: Concept;
  ancestors: {
    concept_id: number;
    concept_name: string;
    domain_id: string;
    vocabulary_id: string;
    min_levels_of_separation: number;
  }[];
  relationships: {
    relationship_id: string;
    concept_id_2: number;
    concept_name: string;
    domain_id: string;
    vocabulary_id: string;
  }[];
}

export interface MapsFromEntry {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  concept_class_id: string;
  concept_code: string;
  standard_concept: string | null;
}

export interface MapsFromResult {
  data: MapsFromEntry[];
  total: number;
  concept_id: number;
}

export interface ConceptTreeNode {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  concept_class_id: string;
  child_count: number;
  depth: number;
}

export interface AnchorDetail {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  concept_class_id: string;
}

export interface ClinicalGrouping {
  id: number;
  name: string;
  description: string | null;
  domain_id: string;
  anchor_concept_ids: number[];
  anchors: AnchorDetail[];
  sort_order: number;
  icon: string | null;
  color: string | null;
  parent_grouping_id: number | null;
}
