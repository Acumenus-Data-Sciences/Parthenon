import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Dna, CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getUpload } from "../api/genomicsApi";
import { useGenomicVariants } from "../hooks/useGenomics";
import type { GenomicVariant, UploadStatus } from "../types";

const STATUS_COLOR: Record<UploadStatus, string> = {
  pending: "text-gray-400",
  parsing: "text-blue-400",
  mapped: "text-green-400",
  review: "text-yellow-400",
  imported: "text-teal-400",
  failed: "text-red-400",
};

const CLINVAR_COLOR: Record<string, string> = {
  Pathogenic: "text-red-400",
  "Likely pathogenic": "text-orange-400",
  "Uncertain significance": "text-yellow-400",
  "Likely benign": "text-blue-400",
  Benign: "text-green-400",
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

  const { data: variantsPage, isLoading: variantsLoading } = useGenomicVariants({
    upload_id: uploadId,
    per_page: 100,
  });

  const variants = variantsPage?.data ?? [];

  if (uploadLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-purple-400" />
      </div>
    );
  }

  if (!upload) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center text-gray-400">
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

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white p-6">
      {/* Header */}
      <button
        onClick={() => navigate("/genomics")}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Genomics
      </button>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Dna size={24} className="text-purple-400 flex-shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-white font-mono">{upload.filename}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-400 mt-0.5">
              <span className="uppercase">{upload.file_format}</span>
              {upload.genome_build && <span>· {upload.genome_build}</span>}
              {upload.sample_id && <span>· {upload.sample_id}</span>}
            </div>
          </div>
        </div>
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

      {upload.error_message && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 mb-6 text-red-300 text-sm">
          <strong>Parse error:</strong> {upload.error_message}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Variants", value: upload.total_variants.toLocaleString() },
          { label: "OMOP Mapped", value: upload.mapped_variants.toLocaleString() },
          { label: "Needs Review", value: upload.review_required.toLocaleString() },
        ].map((c) => (
          <div key={c.label} className="bg-[#0f0f23] rounded-xl p-4 border border-white/10">
            <div className="text-xs text-gray-400 mb-1">{c.label}</div>
            <div className="text-2xl font-bold text-white">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Variants by gene */}
      <div className="bg-[#0f0f23] rounded-xl border border-white/10">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Variants</h2>
          <span className="text-xs text-gray-500">{variants.length.toLocaleString()} shown</span>
        </div>

        {variantsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-purple-400" />
          </div>
        ) : variants.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            {upload.status === "parsing"
              ? "Parsing in progress..."
              : "No variants available"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  {["Gene", "Variant", "HGVS", "Type", "Zygosity", "AF", "ClinVar", "OMOP"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {variants.map((v: GenomicVariant) => (
                  <tr key={v.id} className="hover:bg-white/5">
                    <td className="px-4 py-2 font-semibold text-purple-300">{v.gene_symbol ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-gray-300">
                      {v.chromosome}:{v.position} {v.reference_allele}→{v.alternate_allele}
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-400 max-w-[180px] truncate" title={v.hgvs_p ?? v.hgvs_c ?? ""}>
                      {v.hgvs_p ?? v.hgvs_c ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-400">{v.variant_type ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-400">{v.zygosity ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-400">
                      {v.allele_frequency != null ? (v.allele_frequency * 100).toFixed(1) + "%" : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {v.clinvar_significance ? (
                        <span
                          className={`text-xs font-medium ${
                            CLINVAR_COLOR[v.clinvar_significance] ?? "text-gray-400"
                          }`}
                        >
                          {v.clinvar_significance}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs ${
                          v.mapping_status === "mapped"
                            ? "bg-green-900/40 text-green-300"
                            : v.mapping_status === "review"
                            ? "bg-yellow-900/40 text-yellow-300"
                            : "bg-gray-800 text-gray-500"
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
