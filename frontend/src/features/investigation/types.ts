export type { AnalysisExecution } from "@/features/analyses/types/analysis";

export type ClinicalAnalysisType =
  | "characterization"
  | "incidence_rate"
  | "estimation"
  | "prediction"
  | "sccs"
  | "evidence_synthesis"
  | "pathway";

export type ClinicalAnalysisGroup = "characterize" | "compare" | "predict";

export interface AnalysisTypeDescriptor {
  type: ClinicalAnalysisType;
  group: ClinicalAnalysisGroup;
  name: string;
  description: string;
  icon: string;
  prerequisites: string[];
  estimatedTime: string;
  apiPrefix: string;
}

export interface ClinicalAnalysisConfig {
  type: ClinicalAnalysisType;
  source_id: number | null; // null for evidence_synthesis
  target_cohort_id: number | null;
  comparator_cohort_id: number | null;
  outcome_cohort_ids: number[];
  parameters: Record<string, unknown>;
}

export type InvestigationStatus = "draft" | "active" | "complete" | "archived";
export type EvidenceDomain = "phenotype" | "clinical" | "genomic" | "synthesis";
export type FindingType =
  | "cohort_summary"
  | "hazard_ratio"
  | "incidence_rate"
  | "kaplan_meier"
  | "codewas_hit"
  | "gwas_locus"
  | "colocalization"
  | "open_targets_association"
  | "prediction_model"
  | "custom";
export type PinSection =
  | "phenotype_definition"
  | "population"
  | "clinical_evidence"
  | "genomic_evidence"
  | "synthesis"
  | "limitations"
  | "methods";

export interface PhenotypeState {
  concept_sets: Array<{
    id: string;
    name: string;
    concepts: Array<{
      concept_id: number;
      include_descendants: boolean;
      is_excluded: boolean;
    }>;
  }>;
  cohort_definition: Record<string, unknown> | null;
  selected_cohort_ids: number[];
  primary_cohort_id: number | null;
  matching_config: {
    enabled: boolean;
    strategy: string;
    covariates: string[];
    ratio: number;
    caliper: number;
  } | null;
  import_mode: "parthenon" | "atlas" | "file" | "json" | "phenotype_library";
  codewas_config: {
    control_cohort_id: number | null;
    time_windows: number[];
  } | null;
  last_codewas_run_id: number | null;
}

export interface ClinicalState {
  queued_analyses: Array<{
    analysis_type: ClinicalAnalysisType;
    api_prefix: string;
    analysis_id: number;
    execution_id: number | null;
    config: Record<string, unknown>;
    status: "configured" | "queued" | "running" | "complete" | "failed";
  }>;
  selected_source_id: number | null;
  comparison_run_ids: [number, number] | null;
}

export interface GenomicState {
  open_targets_queries: Array<{
    query_type: "gene" | "disease";
    term: string;
    cached_at: string | null;
  }>;
  gwas_catalog_queries: Array<{
    query_type: "trait" | "gene";
    term: string;
    cached_at: string | null;
  }>;
  uploaded_gwas: Array<{
    file_name: string;
    column_mapping: Record<string, string>;
    upload_id: string;
    top_loci_count: number;
    lambda_gc: number | null;
  }>;
  uploaded_coloc: Array<{ file_name: string; upload_id: string }>;
  uploaded_finemap: Array<{ file_name: string; upload_id: string }>;
}

export interface SynthesisState {
  section_order: string[];
  section_narratives: Record<string, string>;
  export_history: Array<{
    format: string;
    exported_at: string;
    exported_by: number;
  }>;
}

export interface Investigation {
  id: number;
  title: string;
  research_question: string | null;
  status: InvestigationStatus;
  owner_id: number;
  phenotype_state: PhenotypeState;
  clinical_state: ClinicalState;
  genomic_state: GenomicState;
  synthesis_state: SynthesisState;
  completed_at: string | null;
  last_modified_by: number | null;
  created_at: string;
  updated_at: string;
  pins?: EvidencePin[];
  owner?: { id: number; name: string };
}

export interface EvidencePin {
  id: number;
  investigation_id: number;
  domain: EvidenceDomain;
  section: PinSection;
  finding_type: FindingType;
  finding_payload: Record<string, unknown>;
  sort_order: number;
  is_key_finding: boolean;
  narrative_before: string | null;
  narrative_after: string | null;
  created_at: string;
  updated_at: string;
}

export interface CodeWASSignal {
  label: string;
  count: number;
}

export interface CodeWASDisplayResult {
  top_signals: CodeWASSignal[];
  analysis_summary: Record<string, unknown>;
  forest_plot?: Array<{ label: string; hr: number; lower: number; upper: number }>;
  case_cohort_name: string;
  control_cohort_name: string;
}

/** Volcano plot data point — populated by Darkstar CodeWAS endpoint (future) */
export interface VolcanoPoint {
  concept_id: number;
  concept_name: string;
  odds_ratio: number;
  log2_or: number;
  p_value: number;
  neg_log10_p: number;
  ci_lower: number;
  ci_upper: number;
  significant: boolean;
  direction: "risk" | "protective" | "neutral";
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
}

export interface ConceptSearchResult {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  concept_class_id: string;
  standard_concept: string | null;
  concept_code: string;
}

export interface ConceptHierarchy {
  ancestors: ConceptSearchResult[];
  descendants: ConceptSearchResult[];
}

export type SetOperationType = "union" | "intersect" | "subtract";

export interface AttritionStep {
  label: string;
  count: number;
  percent: number;
}

export interface CohortOperationResult {
  compile_summary: Record<string, unknown>;
  attrition: AttritionStep[];
  result_count: number;
  operation_type: SetOperationType;
  export_summary: Record<string, unknown>;
  matching_summary?: Record<string, unknown>;
  handoff_ready: boolean;
}

// ── Open Targets types ────────────────────────────────────────────────

export interface OpenTargetsSearchHit {
  id: string;
  name: string;
  score: number;
  object: Record<string, unknown>;
}

export interface OpenTargetsResult {
  data: {
    search?: { hits: OpenTargetsSearchHit[] };
    target?: Record<string, unknown>;
    disease?: Record<string, unknown>;
  } | null;
  errors?: Array<{ message: string }>;
}

// ── GWAS Catalog types ────────────────────────────────────────────────

export interface GwasCatalogStudy {
  accessionId: string;
  diseaseTrait?: { trait: string };
  publicationInfo?: {
    pubmedId: string;
    publication: string;
    title: string;
    author: { fullname: string };
    publicationDate: string;
  };
  initialSampleSize: string;
  snpCount: number;
}

export interface GwasCatalogAssociation {
  pvalue: number;
  pvalueMantissa: number;
  pvalueExponent: number;
  orPerCopyNum: number | null;
  betaNum: number | null;
  betaDirection: string | null;
  range: string | null;
  riskFrequency: string | null;
  loci: Array<{
    strongestRiskAlleles: Array<{ riskAlleleName: string; riskFrequency: string }>;
    authorReportedGenes: Array<{ geneName: string; ensemblGeneIds: string[] }>;
  }>;
}

export interface GwasCatalogResult {
  _embedded?: Record<string, unknown[]>;
  page?: { totalElements: number; totalPages: number; number: number; size: number };
}

// ── GWAS Upload types ─────────────────────────────────────────────────

export interface GwasUploadResult {
  upload_id: string;
  file_name: string;
  file_size: number;
  total_rows: number;
  columns: string[];
  sample_rows: string[][];
  column_mapping: Record<string, string>;
}

export interface GwasSummaryRow {
  chr: string;
  pos: number;
  ref: string;
  alt: string;
  beta: number;
  se: number;
  p: number;
}

// ── Cross-Domain Links ────────────────────────────────────────────────

export interface CrossLink {
  pin_id: number;
  domain: string;
  finding_type: string;
  link_type: "concept" | "gene";
  link_value: number | string;
}

export type CrossLinksMap = Record<number, CrossLink[]>;
