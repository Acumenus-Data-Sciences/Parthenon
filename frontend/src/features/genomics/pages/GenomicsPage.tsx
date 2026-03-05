import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dna,
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Clock,
  Activity,
  Users,
  FlaskConical,
  Trash2,
} from "lucide-react";
import { useGenomicsStats, useGenomicUploads, useDeleteUpload } from "../hooks/useGenomics";
import type { GenomicUpload, UploadStatus } from "../types";
import { UploadDialog } from "../components/UploadDialog";

const STATUS_BADGE: Record<UploadStatus, string> = {
  pending: "bg-[#232328] text-[#8A857D]",
  parsing: "bg-blue-400/15 text-blue-400",
  mapped: "bg-[#2DD4BF]/15 text-[#2DD4BF]",
  review: "bg-amber-400/15 text-amber-400",
  imported: "bg-[#2DD4BF]/20 text-[#2DD4BF]",
  failed: "bg-[#E85A6B]/15 text-[#E85A6B]",
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
          color: "#60A5FA",
        },
        {
          label: "Total Variants",
          value: stats.total_variants.toLocaleString(),
          icon: Dna,
          color: "#A78BFA",
        },
        {
          label: "OMOP Mapped",
          value: stats.mapped_variants.toLocaleString(),
          icon: CheckCircle2,
          color: "#2DD4BF",
        },
        {
          label: "Pending Review",
          value: stats.review_required.toLocaleString(),
          icon: Clock,
          color: "#F59E0B",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">Molecular Genomics</h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Variant ingestion, OMOP mapping, and cohort genomic criteria
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/genomics/analysis")}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A30] bg-[#151518] px-4 py-2.5 text-sm font-medium text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#3A3A42] transition-colors"
          >
            <Activity size={16} />
            Analysis Suite
          </button>
          <button
            type="button"
            onClick={() => navigate("/genomics/tumor-board")}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A30] bg-[#151518] px-4 py-2.5 text-sm font-medium text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#3A3A42] transition-colors"
          >
            <Users size={16} />
            Tumor Board
          </button>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors"
          >
            <Upload size={16} />
            Upload Variants
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {statsLoading ? (
        <div className="flex items-center gap-2 text-[#5A5650]">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-sm">Loading stats...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metricCards.map((card) => (
            <div
              key={card.label}
              className="flex items-center gap-3 rounded-lg border border-[#232328] bg-[#151518] px-4 py-3"
            >
              <div
                className="flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0"
                style={{ backgroundColor: `${card.color}18` }}
              >
                <card.icon size={16} style={{ color: card.color }} />
              </div>
              <div>
                <p
                  className="text-lg font-semibold font-['IBM_Plex_Mono',monospace]"
                  style={{ color: card.color }}
                >
                  {card.value}
                </p>
                <p className="text-[10px] text-[#5A5650] uppercase tracking-wider">
                  {card.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top Genes */}
      {stats && Object.keys(stats.top_genes).length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-[#2DD4BF]" />
            <h2 className="text-sm font-semibold text-[#F0EDE8]">Top Mutated Genes</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.top_genes).map(([gene, count]) => (
              <button
                key={gene}
                type="button"
                onClick={() => navigate(`/genomics/variants?gene=${gene}`)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#2DD4BF]/10 hover:bg-[#2DD4BF]/20 border border-[#2DD4BF]/30 hover:border-[#2DD4BF]/50 rounded-full text-xs text-[#2DD4BF] transition-colors"
              >
                <Dna size={10} />
                {gene}
                <span className="text-[#2DD4BF]/70">{count.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Uploads table */}
      <div className="rounded-lg border border-[#232328] bg-[#151518]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#232328]">
          <FileText size={14} className="text-[#5A5650]" />
          <h2 className="text-sm font-semibold text-[#F0EDE8]">Recent Uploads</h2>
        </div>

        {uploadsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={22} className="animate-spin text-[#2DD4BF]" />
          </div>
        ) : uploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#5A5650]">
            <FlaskConical size={36} className="mb-3 opacity-40" />
            <p className="text-sm font-medium text-[#8A857D]">No variant files uploaded yet</p>
            <p className="text-xs mt-1">Upload a VCF or MAF file to begin genomic analysis</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#232328]">
                  {["Filename", "Format", "Genome", "Variants", "Status", "Uploaded", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[10px] font-medium text-[#5A5650] uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E1E23]">
                {uploads.map((upload: GenomicUpload) => (
                  <tr
                    key={upload.id}
                    className="hover:bg-[#1A1A1F] cursor-pointer transition-colors"
                    onClick={() => navigate(`/genomics/uploads/${upload.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[#C5C0B8] max-w-xs truncate">
                      {upload.filename}
                    </td>
                    <td className="px-4 py-3 text-[#8A857D] uppercase text-xs">
                      {upload.file_format}
                    </td>
                    <td className="px-4 py-3 text-[#8A857D] text-xs">
                      {upload.genome_build ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[#C5C0B8] text-sm">
                      {upload.total_variants.toLocaleString()}
                      {upload.status === "failed" && upload.error_message && (
                        <AlertCircle
                          size={12}
                          className="inline ml-1 text-[#E85A6B]"
                          title={upload.error_message}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[upload.status]}`}
                      >
                        {upload.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#5A5650] text-xs">
                      {new Date(upload.created_at).toLocaleDateString()}{" "}
                      <span className="text-[#3A3A42]">({formatBytes(upload.file_size_bytes)})</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete upload "${upload.filename}"?`)) {
                            deleteUpload.mutate(upload.id);
                          }
                        }}
                        className="p-1 rounded text-[#5A5650] hover:text-[#E85A6B] hover:bg-[#E85A6B]/10 transition-colors"
                        title="Delete upload"
                      >
                        <Trash2 size={13} />
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
