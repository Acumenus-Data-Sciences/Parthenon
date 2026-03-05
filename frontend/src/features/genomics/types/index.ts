export type FileFormat = 'vcf' | 'maf' | 'cbio_maf' | 'fhir_genomics';
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
  created_at: string;
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
