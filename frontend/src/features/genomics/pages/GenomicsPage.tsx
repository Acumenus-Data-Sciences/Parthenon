import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dna,
  Upload,
  FileText,
  BarChart3,
  Loader2,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Clock,
  FlaskConical,
} from "lucide-react";
import { useGenomicsStats, useGenomicUploads, useDeleteUpload } from "../hooks/useGenomics";
import type { GenomicUpload, UploadStatus } from "../types";
import { UploadDialog } from "../components/UploadDialog";

const STATUS_BADGE: Record<UploadStatus, string> = {
  pending: "bg-gray-700 text-gray-300",
  parsing: "bg-blue-900 text-blue-300",
  mapped: "bg-green-900 text-green-300",
  review: "bg-yellow-900 text-yellow-300",
  imported: "bg-teal-900 text-teal-300",
  failed: "bg-red-900 text-red-300",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GenomicsPage() {
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false);

  const { data: stats, isLoading: statsLoading } = useGenomicsStats();
  const { data: uploadsPage, isLoading: uploadsLoading } = useGenomicUploads({ per_page: 20 });
  const deleteUpload = useDeleteUpload();

  const uploads = uploadsPage?.data ?? [];

  const metricCards = stats
    ? [
        {
          label: "Total Uploads",
          value: stats.total_uploads,
          icon: Upload,
          color: "text-blue-400",
        },
        {
          label: "Total Variants",
          value: stats.total_variants.toLocaleString(),
          icon: Dna,
          color: "text-purple-400",
        },
        {
          label: "OMOP Mapped",
          value: stats.mapped_variants.toLocaleString(),
          icon: CheckCircle2,
          color: "text-green-400",
        },
        {
          label: "Pending Review",
          value: stats.review_required.toLocaleString(),
          icon: Clock,
          color: "text-yellow-400",
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Dna className="text-purple-400" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-white">Molecular Genomics</h1>
            <p className="text-sm text-gray-400">
              Variant ingestion, OMOP mapping, and cohort genomic criteria
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Upload size={16} />
          Upload Variants
        </button>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="flex items-center gap-2 text-gray-400 mb-6">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading stats...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {metricCards.map((card) => (
            <div key={card.label} className="bg-[#0f0f23] rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">{card.label}</span>
                <card.icon size={16} className={card.color} />
              </div>
              <div className="text-2xl font-bold text-white">{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Top Genes */}
      {stats && Object.keys(stats.top_genes).length > 0 && (
        <div className="bg-[#0f0f23] rounded-xl p-4 border border-white/10 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Top Mutated Genes</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.top_genes).map(([gene, count]) => (
              <button
                key={gene}
                onClick={() => navigate(`/genomics/variants?gene=${gene}`)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-900/40 hover:bg-purple-900/60 border border-purple-700/50 rounded-full text-xs text-purple-200 transition-colors"
              >
                <Dna size={10} />
                {gene}
                <span className="text-purple-400">{count.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Uploads table */}
      <div className="bg-[#0f0f23] rounded-xl border border-white/10">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <FileText size={16} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-white">Recent Uploads</h2>
        </div>

        {uploadsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-purple-400" />
          </div>
        ) : uploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <FlaskConical size={40} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">No variant files uploaded yet</p>
            <p className="text-xs mt-1">Upload a VCF or MAF file to begin genomic analysis</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {["Filename", "Format", "Genome", "Variants", "Status", "Uploaded", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {uploads.map((upload: GenomicUpload) => (
                  <tr
                    key={upload.id}
                    className="hover:bg-white/5 cursor-pointer"
                    onClick={() => navigate(`/genomics/uploads/${upload.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-200 max-w-xs truncate">
                      {upload.filename}
                    </td>
                    <td className="px-4 py-3 text-gray-400 uppercase text-xs">
                      {upload.file_format}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {upload.genome_build ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {upload.total_variants.toLocaleString()}
                      {upload.status === "failed" && upload.error_message && (
                        <AlertCircle size={12} className="inline ml-1 text-red-400" title={upload.error_message} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[upload.status]}`}
                      >
                        {upload.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(upload.created_at).toLocaleDateString()}{" "}
                      <span className="text-gray-600">
                        ({formatBytes(upload.file_size_bytes)})
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete upload "${upload.filename}"?`)) {
                            deleteUpload.mutate(upload.id);
                          }
                        }}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showUpload && <UploadDialog onClose={() => setShowUpload(false)} />}
    </div>
  );
}
