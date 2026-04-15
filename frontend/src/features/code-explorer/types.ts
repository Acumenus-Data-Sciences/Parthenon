export type StratifiedCount = {
  year: number;
  gender_concept_id: number | null;
  age_decile: number | null;
  n_node: number;
  n_descendant: number;
};

export type ConceptMetadata = {
  concept_id: number;
  concept_name: string;
  domain_id?: string | null;
  vocabulary_id?: string | null;
  concept_class_id?: string | null;
  standard_concept?: string | null;
};

export type CodeCountsResponse = {
  concept: ConceptMetadata;
  stratified_counts: StratifiedCount[];
  node_count: number;
  descendant_count: number;
};

export type RelationshipRow = {
  relationship_id: string;
  concept_id_2: number;
  concept_name_2: string;
  vocabulary_id_2: string;
  standard_concept: string | null;
};

export type RelationshipsResponse = {
  relationships: RelationshipRow[];
};

export type AncestorNode = {
  concept_id: number;
  concept_name: string;
};

export type AncestorEdge = {
  src: number;
  dst: number;
  depth: number;
};

export type AncestorsResponse = {
  nodes: AncestorNode[];
  edges: AncestorEdge[];
};

export type SourceReadiness = {
  source_key: string;
  ready: boolean;
  missing: string[];
  setup_run_id: string | null;
};

export type AncestorDirection = "up" | "down" | "both";
