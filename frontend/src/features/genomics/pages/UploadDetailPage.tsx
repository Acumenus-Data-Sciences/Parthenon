import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Dna,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  UserCheck,
  DatabaseZap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getUpload } from "../api/genomicsApi";
import { useGenomicVariants, useMatchPersons, useImportToOmop } from "../hooks/useGenomics";
import type { GenomicVariant, UploadStatus } from "../types";

const STATUS_COLOR: Record<UploadStatus, string> = {
  pending: "text-text-muted",
  parsing: "text-blue-400",
  mapped: "text-success",
  review: "text-amber-400",
  imported: "text-success",
  failed: "text-critical",
};

const MAPPING_BADGE: Record<string, string> = {
  mapped: "bg-success/15 text-success",
  review: "bg-amber-400/15 text-amber-400",
  unmapped: "bg-surface-elevated text-text-ghost",
};

const CLINVAR_COLOR: Record<string, string> = {
  Pathogenic: "text-critical",
  "Likely pathogenic": "text-orange-400",
  "Uncertain significance": "text-amber-400",
  "Likely benign": "text-blue-400",
  Benign: "text-success",
};

export default function UploadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const uploadId = Number(id);

  const { data: upload, isLoading: uploadLoading } = useQuery({
    queryKey: ["genomics", "uploads", uploadId],
    queryFn: () => getUpload(uploadId),
    enabled: !!uploadId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "parsing" || status === "pending" ? 3000 : false;
    },
  });

  const matchPersons = useMatchPersons();
  const importOmop = useImportToOmop();

  const { data: variantsPage, isLoading: variantsLoading } = useGenomicVariants({
    upload_id: uploadId,
    per_page: 100,
  });

  const variants = variantsPage?.data ?? [];

  if (uploadLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-success" />
      </div>
    );
  }

  if (!upload) {
    return (
      <div className="flex items-center justify-center py-24 text-text-muted">
        Upload not found
      </div>
    );
  }

  // Group variants by gene
  const byGene = variants.reduce(
    (acc: Record<string, GenomicVariant[]>, v) => {
      const gene = v.gene_symbol ?? "Unknown";
      if (!acc[gene]) acc[gene] = [];
      acc[gene].push(v);
      return acc;
    },
    {}
  );
  void byGene;

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <button
        type="button"
        onClick={() => navigate("/genomics")}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Genomics
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[var(--domain-observation)]/12 flex-shrink-0">
            <Dna size={18} style={{ color: "var(--domain-observation)" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary font-mono">{upload.filename}</h1>
            <div className="flex items-center gap-2 text-sm text-text-muted mt-0.5">
              <span className="uppercase text-xs">{upload.file_format}</span>
              {upload.genome_build && <span>· {upload.genome_build}</span>}
              {upload.sample_id && <span>· {upload.sample_id}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {upload.status === "mapped" && (
            <>
              <button
                type="button"
                onClick={() => matchPersons.mutate(uploadId)}
                disabled={matchPersons.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-xs font-medium text-text-muted hover:text-text-secondary hover:border-surface-highlight disabled:opacity-50 transition-colors"
              >
                {matchPersons.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <UserCheck size={12} />
                )}
                Match Persons
              </button>
              <button
                type="button"
                onClick={() => importOmop.mutate(uploadId)}
                disabled={importOmop.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-xs font-medium text-surface-base hover:bg-success disabled:opacity-50 transition-colors"
              >
                {importOmop.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <DatabaseZap size={12} />
                )}
                Import to OMOP
              </button>
            </>
          )}
          <div className={`flex items-center gap-1.5 text-sm font-medium ${STATUS_COLOR[upload.status]}`}>
            {upload.status === "parsing" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : upload.status === "failed" ? (
              <AlertCircle size={14} />
            ) : upload.status === "mapped" || upload.status === "imported" ? (
              <CheckCircle2 size={14} />
            ) : (
              <Clock size={14} />
            )}
            {upload.status}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {upload.error_message && (
        <div className="rounded-lg border border-critical/30 bg-critical/10 p-4 text-critical text-sm">
          <strong>Parse error:</strong> {upload.error_message}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Variants", value: upload.total_variants.toLocaleString(), color: "var(--domain-observation)" },
          { label: "OMOP Mapped", value: upload.mapped_variants.toLocaleString(), color: "var(--success)" },
          { label: "Needs Review", value: upload.review_required.toLocaleString(), color: "#F59E0B" },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-border-default bg-surface-raised px-4 py-3">
            <p className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">{c.label}</p>
            <p
              className="text-2xl font-semibold font-['IBM_Plex_Mono',monospace]"
              style={{ color: c.color }}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Variants table */}
      <div className="rounded-lg border border-border-default bg-surface-raised">
        <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Variants</h2>
          <span className="text-xs text-text-ghost">{variants.length.toLocaleString()} shown</span>
        </div>

        {variantsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={22} className="animate-spin text-success" />
          </div>
        ) : variants.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm">
            {upload.status === "parsing" ? "Parsing in progress..." : "No variants available"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-default">
                  {["Gene", "Variant", "HGVS", "Type", "Zygosity", "AF", "ClinVar", "OMOP"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[10px] font-medium text-text-ghost uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E1E23]">
                {variants.map((v: GenomicVariant) => (
                  <tr key={v.id} className="hover:bg-surface-overlay transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-[var(--domain-observation)]">{v.gene_symbol ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-text-secondary">
                      {v.chromosome}:{v.position} {v.reference_allele}→{v.alternate_allele}
                    </td>
                    <td
                      className="px-4 py-2.5 font-mono text-text-muted max-w-[180px] truncate"
                      title={v.hgvs_p ?? v.hgvs_c ?? ""}
                    >
                      {v.hgvs_p ?? v.hgvs_c ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-text-muted">{v.variant_type ?? "—"}</td>
                    <td className="px-4 py-2.5 text-text-muted">{v.zygosity ?? "—"}</td>
                    <td className="px-4 py-2.5 text-text-muted">
                      {v.allele_frequency != null
                        ? (v.allele_frequency * 100).toFixed(1) + "%"
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {v.clinvar_significance ? (
                        <span
                          className={`text-xs font-medium ${
                            CLINVAR_COLOR[v.clinvar_significance] ?? "text-text-muted"
                          }`}
                        >
                          {v.clinvar_significance}
                        </span>
                      ) : (
                        <span className="text-surface-highlight">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          MAPPING_BADGE[v.mapping_status] ?? MAPPING_BADGE.unmapped
                        }`}
                      >
                        {v.mapping_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
