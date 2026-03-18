export interface ConceptSet {
  id: number;
  name: string;
  description: string | null;
  expression_json: unknown;
  author_id: number;
  author?: { id: number; name: string; email: string };
  is_public: boolean;
  tags: string[];
  items: ConceptSetItem[];
  items_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ConceptSetItem {
  id: number;
  concept_set_id: number;
  concept_id: number;
  is_excluded: boolean;
  include_descendants: boolean;
  include_mapped: boolean;
  concept?: ConceptSummary;
}

export interface ConceptSummary {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  concept_class_id: string;
  standard_concept: string | null;
  concept_code: string;
}

export interface ConceptSetResolveResult {
  concept_ids: number[];
  count: number;
}

export interface ConceptSetStats {
  total: number;
  with_items: number;
  public: number;
}

export interface ConceptSetListParams {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string[];
  is_public?: boolean;
  with_items?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateConceptSetPayload {
  name: string;
  description?: string;
  is_public?: boolean;
  tags?: string[];
}

export interface UpdateConceptSetPayload {
  name?: string;
  description?: string;
  is_public?: boolean;
  tags?: string[];
}

export interface AddConceptSetItemPayload {
  concept_id: number;
  is_excluded?: boolean;
  include_descendants?: boolean;
  include_mapped?: boolean;
}

export interface UpdateConceptSetItemPayload {
  is_excluded?: boolean;
  include_descendants?: boolean;
  include_mapped?: boolean;
}

export interface BulkUpdateConceptSetItemsPayload {
  item_ids: number[];
  is_excluded?: boolean;
  include_descendants?: boolean;
  include_mapped?: boolean;
}
