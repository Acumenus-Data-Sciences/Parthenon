import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getGenomicsStats,
  listUploads,
  uploadVariantFile,
  deleteUpload,
  matchPersons,
  importToOmop,
  listVariants,
  listCriteria,
  createCriterion,
  deleteCriterion,
  getClinVarStatus,
  searchClinVar,
  syncClinVar,
  annotateClinVar,
} from "../api/genomicsApi";
import type { FileFormat, GenomeBuild, CriteriaType } from "../types";

// ──────────────────────────────────────────────────────────────────────────────
// Stats
// ──────────────────────────────────────────────────────────────────────────────

export function useGenomicsStats() {
  return useQuery({
    queryKey: ["genomics", "stats"],
    queryFn: getGenomicsStats,
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Uploads
// ──────────────────────────────────────────────────────────────────────────────

export function useGenomicUploads(params?: {
  source_id?: number;
  status?: string;
  per_page?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: ["genomics", "uploads", params],
    queryFn: () => listUploads(params),
  });
}

export function useUploadVariantFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      source_id: number;
      file: File;
      file_format: FileFormat;
      genome_build?: GenomeBuild;
      sample_id?: string;
    }) => uploadVariantFile(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["genomics", "uploads"] });
      qc.invalidateQueries({ queryKey: ["genomics", "stats"] });
    },
  });
}

export function useDeleteUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteUpload(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["genomics", "uploads"] });
      qc.invalidateQueries({ queryKey: ["genomics", "stats"] });
    },
  });
}

export function useMatchPersons() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => matchPersons(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["genomics", "uploads", id] });
      qc.invalidateQueries({ queryKey: ["genomics", "variants"] });
    },
  });
}

export function useImportToOmop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => importToOmop(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["genomics", "uploads"] });
      qc.invalidateQueries({ queryKey: ["genomics", "stats"] });
    },
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Variants
// ──────────────────────────────────────────────────────────────────────────────

export function useGenomicVariants(params?: {
  upload_id?: number;
  source_id?: number;
  gene?: string;
  clinvar_significance?: string;
  mapping_status?: string;
  per_page?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: ["genomics", "variants", params],
    queryFn: () => listVariants(params),
    enabled: !!(params?.upload_id || params?.source_id || params?.gene),
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Cohort criteria
// ──────────────────────────────────────────────────────────────────────────────

export function useGenomicCriteria(type?: CriteriaType) {
  return useQuery({
    queryKey: ["genomics", "criteria", type],
    queryFn: () => listCriteria(type ? { type } : undefined),
  });
}

export function useCreateCriterion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCriterion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["genomics", "criteria"] }),
  });
}

export function useDeleteCriterion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCriterion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["genomics", "criteria"] }),
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// ClinVar
// ──────────────────────────────────────────────────────────────────────────────

export function useClinVarStatus() {
  return useQuery({
    queryKey: ["genomics", "clinvar", "status"],
    queryFn: getClinVarStatus,
    staleTime: 60_000,
  });
}

export function useClinVarSearch(params?: {
  q?: string;
  gene?: string;
  significance?: string;
  pathogenic_only?: boolean;
  per_page?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: ["genomics", "clinvar", "search", params],
    queryFn: () => searchClinVar(params),
    enabled: !!(params?.q || params?.gene || params?.significance || params?.pathogenic_only),
  });
}

export function useSyncClinVar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (papuOnly: boolean) => syncClinVar(papuOnly),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["genomics", "clinvar"] });
    },
  });
}

export function useAnnotateClinVar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uploadId: number) => annotateClinVar(uploadId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["genomics", "uploads"] });
      qc.invalidateQueries({ queryKey: ["genomics", "variants"] });
    },
  });
}
