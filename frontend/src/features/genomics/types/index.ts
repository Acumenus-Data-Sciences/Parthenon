export type FileFormat = 'vcf' | 'maf' | 'cbio_maf' | 'fhir_genomics' | 'foundation_one';
export type UploadableFileFormat = Exclude<FileFormat, 'foundation_one'>;
export type GenomeBuild = 'GRCh38' | 'GRCh37' | 'hg38' | 'hg19';
export type UploadStatus = 'pending' | 'parsing' | 'mapped' | 'review' | 'imported' | 'failed';
export type MappingStatus = 'mapped' | 'unmapped' | 'review';
export type CriteriaType = 'gene_mutation' | 'tmb' | 'msi' | 'fusion' | 'pathogenicity' | 'treatment_episode';

export interface GenomicUpload {
  id: number;
  source_id: number;
  created_by: number;
  filename: string;
  file_format: FileFormat;
  file_size_bytes: number;
  status: UploadStatus;
  genome_build: GenomeBuild | null;
  sample_id: string | null;
  total_variants: number;
  mapped_variants: number;
  review_required: number;
  error_message: string | null;
  parsed_at: string | null;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
  creator?: { id: number; name: string };
  omop_context?: GenomicUploadOmopContextXref | null;
  omop_genomic_test_map?: OmopGenomicTestMap | null;
}

export interface GenomicVariant {
  id: number;
  upload_id: number;
  source_id: number;
  person_id: number | null;
  sample_id: string | null;
  chromosome: string;
  position: number;
  reference_allele: string;
  alternate_allele: string;
  genome_build: GenomeBuild | null;
  gene_symbol: string | null;
  hgvs_c: string | null;
  hgvs_p: string | null;
  variant_type: string | null;
  variant_class: string | null;
  consequence: string | null;
  quality: number | null;
  filter_status: string | null;
  zygosity: string | null;
  allele_frequency: number | null;
  read_depth: number | null;
  clinvar_id: string | null;
  clinvar_significance: string | null;
  cosmic_id: string | null;
  measurement_concept_id: number;
  mapping_status: MappingStatus;
  omop_measurement_id?: number | null;
  omop_xref?: GenomicVariantOmopXref | null;
  created_at: string;
}

export interface GenomicUploadOmopContextXref {
  upload_id: number;
  source_id: number;
  person_id: number | null;
  sample_id: string | null;
  procedure_occurrence_id: number | null;
  visit_occurrence_id: number | null;
  care_site_id: number | null;
  specimen_id: number | null;
  genomic_test_id: number | null;
  source_strategy: string;
  mapping_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OmopGenomicTestMap {
  upload_id: number;
  genomic_test_id: number | null;
  care_site_id: number | null;
  genomic_test_name: string | null;
  genomic_test_version: string | null;
  reference_genome: string | null;
  sequencing_device: string | null;
  library_preparation: string | null;
  target_capture: string | null;
  read_type: string | null;
  read_length: number | null;
  quality_control_tools: string | null;
  total_reads: number | null;
  mean_target_coverage: number | null;
  per_target_base_cover_100x: number | null;
  alignment_tools: string | null;
  variant_calling_tools: string | null;
  chromosome_corrdinate: string | null;
  annotation_tools: string | null;
  annotation_databases: string | null;
  backfill_run_id: number | null;
  mapping_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenomicVariantOmopXref {
  variant_id: number;
  variant_occurrence_id: number | null;
  procedure_occurrence_id: number | null;
  specimen_id: number | null;
  reference_specimen_id: number | null;
  target_gene1_id: string | null;
  target_gene1_symbol: string | null;
  target_gene2_id: string | null;
  target_gene2_symbol: string | null;
  backfill_run_id: number | null;
  mapping_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenomicCohortCriterion {
  id: number;
  created_by: number;
  name: string;
  criteria_type: CriteriaType;
  criteria_definition: Record<string, unknown>;
  description: string | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface GenomicsStats {
  total_uploads: number;
  total_variants: number;
  omop_context_uploads: number;
  omop_variant_occurrences: number;
  excluded_benchmark_uploads: number;
  mapped_variants: number;
  review_required: number;
  uploads_by_status: Record<string, number>;
  top_genes: Record<string, number>;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

// ── ClinVar ───────────────────────────────────────────────────────────────────

export interface ClinVarVariant {
  id: number;
  variation_id: string | null;
  rs_id: string | null;
  chromosome: string;
  position: number;
  reference_allele: string;
  alternate_allele: string;
  genome_build: string;
  gene_symbol: string | null;
  hgvs: string | null;
  clinical_significance: string | null;
  disease_name: string | null;
  review_status: string | null;
  is_pathogenic: boolean;
  last_synced_at: string | null;
}

export interface ClinVarSyncLogEntry {
  id: number;
  genome_build: string;
  papu_only: boolean;
  status: 'running' | 'completed' | 'failed';
  variants_inserted: number;
  variants_updated: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface ClinVarStatus {
  total_variants: number;
  pathogenic_count: number;
  last_sync: string | null;
  last_sync_build: string | null;
  last_sync_papu: boolean | null;
  syncs: ClinVarSyncLogEntry[];
}
