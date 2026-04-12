import { useState, useEffect } from "react";
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
  RefreshCw,
  Search,
  ShieldAlert,
  Database,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  useGenomicsStats,
  useGenomicUploads,
  useDeleteUpload,
  useClinVarStatus,
  useClinVarSearch,
  useSyncClinVar,
  useAnnotateClinVar,
} from "../hooks/useGenomics";
import type { GenomicUpload, UploadStatus, ClinVarVariant } from "../types";
import { UploadDialog } from "../components/UploadDialog";
import { HelpButton } from "@/features/help";

type Tab = "uploads" | "clinvar";

const STATUS_BADGE: Record<UploadStatus, string> = {
  pending: "bg-[#232328] text-[#8A857D]",
  parsing: "bg-blue-400/15 text-blue-400",
  mapped: "bg-[#2DD4BF]/15 text-[#2DD4BF]",
  review: "bg-amber-400/15 text-amber-400",
  imported: "bg-[#2DD4BF]/20 text-[#2DD4BF]",
  failed: "bg-[#E85A6B]/15 text-[#E85A6B]",
};

const SIG_BADGE: Record<string, string> = {
  pathogenic: "bg-[#E85A6B]/15 text-[#E85A6B]",
  "likely pathogenic": "bg-orange-400/15 text-orange-400",
  benign: "bg-[#2DD4BF]/15 text-[#2DD4BF]",
  "likely benign": "bg-[#2DD4BF]/10 text-[#2DD4BF]/80",
  "uncertain significance": "bg-amber-400/15 text-amber-400",
};

function sigBadgeClass(sig: string | null): string {
  if (!sig) return "bg-[#232328] text-[#5A5650]";
  const key = sig.toLowerCase();
  for (const [k, v] of Object.entries(SIG_BADGE)) {
    if (key.includes(k)) return v;
  }
  return "bg-[#232328] text-[#8A857D]";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ──────────────────────────────────────────────────────────────────────────────
// ClinVar Panel
// ──────────────────────────────────────────────────────────────────────────────

function ClinVarPanel({ initialGene }: { initialGene?: string }) {
  const [gene, setGene] = useState(initialGene ?? "");
  const [sig, setSig] = useState("");
  const [pathogenicOnly, setPathogenicOnly] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (initialGene) {
      setGene(initialGene);
      setPage(1);
    }
  }, [initialGene]);
  const [syncingPapu, setSyncingPapu] = useState(false);

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useClinVarStatus();
  const syncMutation = useSyncClinVar();

  const activeParams = {
    q: searchQ || undefined,
    gene: gene || undefined,
    significance: sig || undefined,
    pathogenic_only: pathogenicOnly || undefined,
    page,
    per_page: 50,
  };
  const hasFilters = !!(searchQ || gene || sig || pathogenicOnly);

  const { data: results, isLoading: searching } = useClinVarSearch(hasFilters ? activeParams : undefined);

  async function handleSync(papuOnly: boolean) {
    setSyncingPapu(papuOnly);
    try {
      await syncMutation.mutateAsync(papuOnly);
      refetchStatus();
    } finally {
      setSyncingPapu(false);
    }
  }

  const isEmpty = status ? status.total_variants === 0 : false;

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[#E85A6B]/10 flex-shrink-0">
              <ShieldAlert size={18} className="text-[#E85A6B]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#F0EDE8]">ClinVar Reference Database</p>
              <p className="text-xs text-[#5A5650] mt-0.5">
                NCBI ClinVar · GRCh38 · Updated weekly
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSync(true)}
              disabled={syncMutation.isPending}
              title="Download P/LP variants only (~69 KB, fast)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A30] bg-[#151518] px-3 py-2 text-xs font-medium text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#3A3A42] transition-colors disabled:opacity-50"
            >
              {syncMutation.isPending && syncingPapu ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              P/LP Only
            </button>
            <button
              type="button"
              onClick={() => handleSync(false)}
              disabled={syncMutation.isPending}
              title="Download full ClinVar (~181 MB, slower)"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2DD4BF] px-3 py-2 text-xs font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50"
            >
              {syncMutation.isPending && !syncingPapu ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              Full Sync
            </button>
          </div>
        </div>

        {statusLoading ? (
          <div className="mt-3 flex items-center gap-2 text-[#5A5650]">
            <Loader2 size={12} className="animate-spin" />
            <span className="text-xs">Loading status…</span>
          </div>
        ) : status ? (
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div
              className="rounded-md border border-[#232328] bg-[#1A1A1F] px-3 py-2 transition-colors hover:border-[#3A3A40] cursor-pointer"
              onClick={() => { setSearchQ(""); setGene(""); setSig(""); setPathogenicOnly(false); setPage(1); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setSearchQ(""); setGene(""); setSig(""); setPathogenicOnly(false); setPage(1); } }}
            >
              <p className="text-xs text-[#5A5650] uppercase tracking-wider">Total Variants</p>
              <p className="text-base font-semibold font-['IBM_Plex_Mono',monospace] text-[#F0EDE8] mt-0.5">
                {status.total_variants.toLocaleString()}
              </p>
            </div>
            <div
              className="rounded-md border border-[#232328] bg-[#1A1A1F] px-3 py-2 transition-colors hover:border-[#3A3A40] cursor-pointer"
              onClick={() => { setPathogenicOnly(true); setSig(""); setSearchQ(""); setGene(""); setPage(1); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setPathogenicOnly(true); setSig(""); setSearchQ(""); setGene(""); setPage(1); } }}
            >
              <p className="text-xs text-[#5A5650] uppercase tracking-wider">Pathogenic / LP</p>
              <p className="text-base font-semibold font-['IBM_Plex_Mono',monospace] text-[#E85A6B] mt-0.5">
                {status.pathogenic_count.toLocaleString()}
              </p>
            </div>
            <div className="rounded-md border border-[#232328] bg-[#1A1A1F] px-3 py-2">
              <p className="text-xs text-[#5A5650] uppercase tracking-wider">Last Sync</p>
              <p className="text-sm text-[#C5C0B8] mt-0.5">
                {formatDate(status.last_sync)}
                {status.last_sync_papu && (
                  <span className="ml-1.5 text-[10px] text-[#8A857D] bg-[#232328] px-1.5 py-0.5 rounded">P/LP</span>
                )}
              </p>
            </div>
          </div>
        ) : null}

        {syncMutation.isSuccess && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 px-3 py-2 text-xs text-[#2DD4BF]">
            <CheckCircle2 size={12} />
            Sync complete — {syncMutation.data?.inserted.toLocaleString()} inserted, {syncMutation.data?.updated.toLocaleString()} updated
          </div>
        )}
        {syncMutation.isError && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-3 py-2 text-xs text-[#E85A6B]">
            <AlertCircle size={12} />
            Sync failed — check server logs
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="rounded-lg border border-[#232328] bg-[#151518] flex flex-col items-center justify-center py-14 text-[#5A5650]">
          <Database size={32} className="mb-3 opacity-40" />
          <p className="text-sm font-medium text-[#8A857D]">No ClinVar data indexed yet</p>
          <p className="text-xs mt-1">Use "P/LP Only" for a fast 69 KB seed, or "Full Sync" for all 181 MB</p>
        </div>
      ) : (
        <>
          {/* Search controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]" />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setPage(1); }}
                placeholder="Search gene, HGVS, disease, RS ID…"
                className="w-full pl-8 pr-3 py-2 text-sm bg-[#151518] border border-[#232328] rounded-lg text-[#F0EDE8] placeholder-[#5A5650] focus:outline-none focus:border-[#2DD4BF]/50 focus:ring-1 focus:ring-[#2DD4BF]/30"
              />
            </div>
            <input
              type="text"
              value={gene}
              onChange={(e) => { setGene(e.target.value); setPage(1); }}
              placeholder="Gene"
              className="w-28 px-3 py-2 text-sm bg-[#151518] border border-[#232328] rounded-lg text-[#F0EDE8] placeholder-[#5A5650] focus:outline-none focus:border-[#2DD4BF]/50 focus:ring-1 focus:ring-[#2DD4BF]/30"
            />
            <select
              value={sig}
              onChange={(e) => { setSig(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm bg-[#151518] border border-[#232328] rounded-lg text-[#8A857D] focus:outline-none focus:border-[#2DD4BF]/50"
            >
              <option value="">All significance</option>
              <option value="pathogenic">Pathogenic</option>
              <option value="likely pathogenic">Likely pathogenic</option>
              <option value="uncertain">Uncertain significance</option>
              <option value="benign">Benign</option>
              <option value="likely benign">Likely benign</option>
              <option value="conflicting">Conflicting</option>
            </select>
            <button
              type="button"
              onClick={() => { setPathogenicOnly(!pathogenicOnly); setPage(1); }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                pathogenicOnly
                  ? "bg-[#E85A6B]/15 border-[#E85A6B]/30 text-[#E85A6B]"
                  : "bg-[#151518] border-[#232328] text-[#8A857D] hover:text-[#C5C0B8]"
              }`}
            >
              <ShieldAlert size={12} />
              P/LP
            </button>
          </div>

          {/* Results table */}
          {!hasFilters ? (
            <div className="rounded-lg border border-[#232328] bg-[#151518] flex flex-col items-center justify-center py-10 text-[#5A5650]">
              <Filter size={22} className="mb-2 opacity-40" />
              <p className="text-sm text-[#8A857D]">Enter a search term or apply a filter to browse ClinVar</p>
            </div>
          ) : searching ? (
            <div className="rounded-lg border border-[#232328] bg-[#151518] flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-[#2DD4BF]" />
            </div>
          ) : results && results.data.length === 0 ? (
            <div className="rounded-lg border border-[#232328] bg-[#151518] flex flex-col items-center justify-center py-12 text-[#5A5650]">
              <Dna size={28} className="mb-2 opacity-40" />
              <p className="text-sm text-[#8A857D]">No variants match your search</p>
            </div>
          ) : results ? (
            <div className="rounded-lg border border-[#232328] bg-[#151518]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#232328]">
                      {["Gene", "HGVS / Variant", "Significance", "Disease", "Review Status", "Build", "IDs"].map((h) => (
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
                    {results.data.map((v: ClinVarVariant) => (
                      <tr key={v.id} className="hover:bg-[#1A1A1F] transition-colors">
                        <td className="px-4 py-3 font-semibold text-[#F0EDE8] text-xs">
                          {v.gene_symbol ?? <span className="text-[#3A3A42]">—</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#C5C0B8] max-w-xs truncate">
                          {v.hgvs ?? `${v.chromosome}:${v.position} ${v.reference_allele}>${v.alternate_allele}`}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${sigBadgeClass(v.clinical_significance)}`}>
                            {v.clinical_significance ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#8A857D] max-w-[200px] truncate" title={v.disease_name ?? undefined}>
                          {v.disease_name ?? <span className="text-[#3A3A42]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-[10px] text-[#5A5650]">
                          {v.review_status ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#5A5650]">
                          {v.genome_build}
                        </td>
                        <td className="px-4 py-3 text-[10px] text-[#5A5650] space-y-0.5">
                          {v.variation_id && <div>VCV{v.variation_id}</div>}
                          {v.rs_id && <div className="text-[#3A3A42]">{v.rs_id}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {results.last_page > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#232328]">
                  <p className="text-xs text-[#5A5650]">
                    {results.total.toLocaleString()} variants · page {results.current_page} of {results.last_page}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={results.current_page === 1}
                      className="p-1.5 rounded text-[#5A5650] hover:text-[#C5C0B8] hover:bg-[#232328] disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(results.last_page, p + 1))}
                      disabled={results.current_page === results.last_page}
                      className="p-1.5 rounded text-[#5A5650] hover:text-[#C5C0B8] hover:bg-[#232328] disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────────────────

export default function GenomicsPage() {
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("uploads");
  const [clinvarGeneFilter, setClinvarGeneFilter] = useState("");

  const { data: stats, isLoading: statsLoading } = useGenomicsStats();
  const { data: uploadsPage, isLoading: uploadsLoading } = useGenomicUploads({ per_page: 20 });
  const deleteUpload = useDeleteUpload();
  const annotate = useAnnotateClinVar();

  const uploads = uploadsPage?.data ?? [];

  const metricCards = stats
    ? [
        { label: "Total Uploads", value: stats.total_uploads, icon: Upload, color: "#60A5FA" },
        { label: "Total Variants", value: stats.total_variants.toLocaleString(), icon: Dna, color: "#A78BFA" },
        { label: "OMOP Mapped", value: stats.mapped_variants.toLocaleString(), icon: CheckCircle2, color: "#2DD4BF" },
        { label: "Pending Review", value: stats.review_required.toLocaleString(), icon: Clock, color: "#F59E0B" },
      ]
    : [];

  const tabs: { id: Tab; label: string; icon: typeof Database }[] = [
    { id: "uploads", label: "Uploads", icon: FileText },
    { id: "clinvar", label: "ClinVar Reference", icon: Database },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold text-[#F0EDE8]">Molecular Genomics</h1>
            <p className="mt-1 text-sm text-[#8A857D]">
              Variant ingestion, OMOP mapping, and cohort genomic criteria
            </p>
          </div>
          <HelpButton helpKey="genomics" />
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
          <span className="text-sm">Loading stats…</span>
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
                onClick={() => {
                  setClinvarGeneFilter(gene);
                  setActiveTab("clinvar");
                }}
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

      {/* Tabs */}
      <div className="border-b border-[#232328]">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#2DD4BF] text-[#2DD4BF]"
                  : "border-transparent text-[#8A857D] hover:text-[#C5C0B8]"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Uploads */}
      {activeTab === "uploads" && (
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
                          <span title={upload.error_message}>
                            <AlertCircle
                              className="inline ml-1 text-[#E85A6B] w-3 h-3"
                            />
                          </span>
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
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              annotate.mutate(upload.id);
                            }}
                            disabled={annotate.isPending}
                            title="Annotate variants with ClinVar significance"
                            className="p-1 rounded text-[#5A5650] hover:text-[#2DD4BF] hover:bg-[#2DD4BF]/10 transition-colors disabled:opacity-30"
                          >
                            {annotate.isPending ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Sparkles size={13} />
                            )}
                          </button>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: ClinVar */}
      {activeTab === "clinvar" && <ClinVarPanel initialGene={clinvarGeneFilter} />}

      {showUpload && <UploadDialog onClose={() => setShowUpload(false)} />}
    </div>
  );
}
