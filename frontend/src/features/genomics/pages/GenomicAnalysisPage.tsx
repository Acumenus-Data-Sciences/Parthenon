/**
 * Genomic Analysis Page — Variant-Outcome Analysis Suite
 *
 * Three analysis panels:
 * 1. Mutation-Survival: Kaplan-Meier curves for mutated vs wild-type
 * 2. Treatment-Variant Matrix: Heatmap of event rates by gene × drug
 * 3. Genomic Characterization: Waterfall bar chart + variant type donut
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dna, BarChart3, Grid3X3, Activity, Loader2, AlertCircle } from "lucide-react";
import apiClient from "@/lib/api-client";

// ── Survival data types ──────────────────────────────────────────────────────

interface SurvivalPoint { t: number; e: number; }
interface SurvivalData {
  gene: string;
  hgvs?: string;
  mutated: SurvivalPoint[];
  wildtype: SurvivalPoint[];
  n_mutated: number;
  n_wildtype: number;
}

interface MatrixRow { gene: string; drug: string; n: number; event_rate: number; }
interface CharData {
  top_genes: { gene: string; n: number; pct: number }[];
  tmb_distribution: { bucket: string; count: number }[];
  variant_type_dist: Record<string, number>;
  total_variants: number;
}

// ── KM curve computation ─────────────────────────────────────────────────────

function computeKM(events: SurvivalPoint[]): { t: number; s: number }[] {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => a.t - b.t);
  let n = sorted.length;
  let s = 1.0;
  const curve: { t: number; s: number }[] = [{ t: 0, s: 1 }];
  for (const { t, e } of sorted) {
    if (e === 1) {
      s *= (n - 1) / n;
      curve.push({ t, s: Math.max(0, s) });
    }
    n--;
  }
  return curve;
}

// ── Inline SVG Kaplan-Meier chart ────────────────────────────────────────────

function KaplanMeierChart({ data }: { data: SurvivalData }) {
  const W = 480, H = 240, PL = 40, PR = 10, PT = 10, PB = 30;
  const mutedKM = computeKM(data.mutated);
  const wildKM = computeKM(data.wildtype);

  const maxT = Math.max(
    ...[...data.mutated, ...data.wildtype].map((p) => p.t),
    1
  );

  const xScale = (t: number) => PL + (t / maxT) * (W - PL - PR);
  const yScale = (s: number) => PT + (1 - s) * (H - PT - PB);

  const stepPath = (curve: { t: number; s: number }[]) => {
    if (!curve.length) return "";
    const pts: string[] = [`M${xScale(curve[0].t)},${yScale(curve[0].s)}`];
    for (let i = 1; i < curve.length; i++) {
      pts.push(`H${xScale(curve[i].t)}`);
      pts.push(`V${yScale(curve[i].s)}`);
    }
    pts.push(`H${xScale(maxT)}`);
    return pts.join(" ");
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* Grid */}
      {[0.25, 0.5, 0.75, 1.0].map((s) => (
        <line
          key={s}
          x1={PL}
          x2={W - PR}
          y1={yScale(s)}
          y2={yScale(s)}
          stroke="#232328"
          strokeDasharray="3,3"
        />
      ))}
      {/* Y axis labels */}
      {[0, 0.25, 0.5, 0.75, 1.0].map((s) => (
        <text key={s} x={PL - 4} y={yScale(s) + 4} textAnchor="end" fontSize="9" fill="#5A5650">
          {(s * 100).toFixed(0)}%
        </text>
      ))}
      {/* X axis label */}
      <text x={(W - PL - PR) / 2 + PL} y={H - 4} textAnchor="middle" fontSize="9" fill="#5A5650">
        Days
      </text>

      {/* KM curves */}
      {wildKM.length > 0 && (
        <path d={stepPath(wildKM)} fill="none" stroke="#60A5FA" strokeWidth="1.5" />
      )}
      {mutedKM.length > 0 && (
        <path d={stepPath(mutedKM)} fill="none" stroke="#E85A6B" strokeWidth="1.5" />
      )}

      {/* Legend */}
      <rect x={PL + 8} y={PT + 4} width={8} height={2} fill="#E85A6B" />
      <text x={PL + 20} y={PT + 10} fontSize="9" fill="#C5C0B8">
        {data.gene} mutated (n={data.n_mutated})
      </text>
      <rect x={PL + 8} y={PT + 16} width={8} height={2} fill="#60A5FA" />
      <text x={PL + 20} y={PT + 22} fontSize="9" fill="#C5C0B8">
        Wild-type (n={data.n_wildtype})
      </text>
    </svg>
  );
}

// ── Treatment matrix heatmap ─────────────────────────────────────────────────

function TreatmentMatrix({ rows }: { rows: MatrixRow[] }) {
  const genes = [...new Set(rows.map((r) => r.gene))];
  const drugs = [...new Set(rows.map((r) => r.drug))].slice(0, 15);
  const lookup = Object.fromEntries(rows.map((r) => [`${r.gene}|${r.drug}`, r]));

  const maxRate = Math.max(...rows.map((r) => r.event_rate), 0.01);

  const colorFor = (rate: number) => {
    const intensity = Math.round((rate / maxRate) * 255);
    return `rgb(${intensity + 40}, ${Math.max(0, 80 - intensity)}, ${Math.max(0, 80 - intensity)})`;
  };

  if (!rows.length) {
    return <p className="text-xs text-gray-500 py-4">No data. Upload variants + ensure CDM connection for drug exposure data.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] border-collapse">
        <thead>
          <tr>
            <th className="px-2 py-1 text-gray-500 font-normal text-left min-w-[60px]">Gene</th>
            {drugs.map((d) => (
              <th key={d} className="px-1 py-1 text-gray-500 font-normal" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", maxWidth: 80 }} title={d}>
                {d.length > 20 ? d.slice(0, 18) + "…" : d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {genes.map((gene) => (
            <tr key={gene}>
              <td className="px-2 py-1 font-semibold text-purple-300">{gene}</td>
              {drugs.map((drug) => {
                const cell = lookup[`${gene}|${drug}`];
                return (
                  <td
                    key={drug}
                    className="w-8 h-8 text-center"
                    style={{ backgroundColor: cell ? colorFor(cell.event_rate) : "#111" }}
                    title={cell ? `n=${cell.n}, rate=${(cell.event_rate * 100).toFixed(1)}%` : "No data"}
                  >
                    {cell ? (
                      <span className="text-white text-[9px]">{(cell.event_rate * 100).toFixed(0)}%</span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

type Tab = "survival" | "matrix" | "characterization";

export default function GenomicAnalysisPage() {
  const [tab, setTab] = useState<Tab>("survival");
  const [sourceId] = useState(9); // TODO: source selector
  const [gene, setGene] = useState("EGFR");
  const [hgvs, setHgvs] = useState("");
  const [matrixGenes, setMatrixGenes] = useState("EGFR,KRAS,ALK");

  const survivalQuery = useQuery({
    queryKey: ["genomics", "analysis", "survival", sourceId, gene, hgvs],
    queryFn: async () => {
      const { data } = await apiClient.get("/genomics/analysis/survival", {
        params: { source_id: sourceId, gene, hgvs: hgvs || undefined },
      });
      return data.data as SurvivalData;
    },
    enabled: tab === "survival" && !!gene,
  });

  const matrixQuery = useQuery({
    queryKey: ["genomics", "analysis", "matrix", sourceId, matrixGenes],
    queryFn: async () => {
      const genes = matrixGenes.split(",").map((g) => g.trim()).filter(Boolean);
      const { data } = await apiClient.get("/genomics/analysis/treatment-matrix", {
        params: { source_id: sourceId, "genes[]": genes },
      });
      return data.data as MatrixRow[];
    },
    enabled: tab === "matrix" && !!matrixGenes,
  });

  const charQuery = useQuery({
    queryKey: ["genomics", "analysis", "characterization", sourceId],
    queryFn: async () => {
      const { data } = await apiClient.get("/genomics/analysis/characterization", {
        params: { source_id: sourceId },
      });
      return data.data as CharData;
    },
    enabled: tab === "characterization",
  });

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "survival", label: "Mutation-Survival", icon: Activity },
    { id: "matrix", label: "Treatment-Variant Matrix", icon: Grid3X3 },
    { id: "characterization", label: "Genomic Characterization", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white p-6">
      <div className="flex items-center gap-3 mb-6">
        <Dna size={24} className="text-purple-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Variant-Outcome Analysis Suite</h1>
          <p className="text-sm text-gray-400">Population-level genomic analytics linked to OMOP clinical outcomes</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-white/10">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === id
                ? "border-purple-500 text-purple-300"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Survival panel */}
      {tab === "survival" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Gene</label>
              <input
                value={gene}
                onChange={(e) => setGene(e.target.value.toUpperCase())}
                className="bg-[#0f0f23] border border-white/10 rounded px-3 py-1.5 text-sm text-white w-28 focus:outline-none focus:border-purple-500"
                placeholder="EGFR"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">HGVS (optional)</label>
              <input
                value={hgvs}
                onChange={(e) => setHgvs(e.target.value)}
                className="bg-[#0f0f23] border border-white/10 rounded px-3 py-1.5 text-sm text-white w-40 focus:outline-none focus:border-purple-500"
                placeholder="p.Leu858Arg"
              />
            </div>
          </div>

          <div className="bg-[#0f0f23] rounded-xl border border-white/10 p-4">
            {survivalQuery.isLoading && (
              <div className="flex items-center gap-2 text-gray-400 py-8 justify-center">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Running survival analysis...</span>
              </div>
            )}
            {survivalQuery.isError && (
              <div className="flex items-center gap-2 text-red-400 py-4">
                <AlertCircle size={14} />
                <span className="text-sm">Analysis failed. Ensure CDM source has genomic + outcome data.</span>
              </div>
            )}
            {survivalQuery.data && (
              <>
                <h3 className="text-sm font-semibold text-white mb-3">
                  {survivalQuery.data.gene} {survivalQuery.data.hgvs ?? ""} — Overall Survival
                </h3>
                {survivalQuery.data.mutated.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4">No matched survival data. Upload VCF files with person_id matching and ensure patients have observation periods.</p>
                ) : (
                  <KaplanMeierChart data={survivalQuery.data} />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Treatment matrix panel */}
      {tab === "matrix" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Genes (comma-separated)</label>
            <input
              value={matrixGenes}
              onChange={(e) => setMatrixGenes(e.target.value)}
              className="bg-[#0f0f23] border border-white/10 rounded px-3 py-1.5 text-sm text-white w-80 focus:outline-none focus:border-purple-500"
              placeholder="EGFR,KRAS,ALK,BRAF"
            />
          </div>
          <div className="bg-[#0f0f23] rounded-xl border border-white/10 p-4">
            {matrixQuery.isLoading && (
              <div className="flex items-center gap-2 text-gray-400 py-8 justify-center">
                <Loader2 size={18} className="animate-spin" />
              </div>
            )}
            {matrixQuery.data && <TreatmentMatrix rows={matrixQuery.data} />}
          </div>
        </div>
      )}

      {/* Characterization panel */}
      {tab === "characterization" && (
        <div className="space-y-4">
          <div className="bg-[#0f0f23] rounded-xl border border-white/10 p-4">
            {charQuery.isLoading && (
              <div className="flex items-center gap-2 text-gray-400 py-8 justify-center">
                <Loader2 size={18} className="animate-spin" />
              </div>
            )}
            {charQuery.data && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">
                    Top Mutated Genes
                    <span className="ml-2 text-xs text-gray-500">({charQuery.data.total_variants.toLocaleString()} total variants)</span>
                  </h3>
                  <div className="space-y-1">
                    {charQuery.data.top_genes.map((g) => (
                      <div key={g.gene} className="flex items-center gap-3">
                        <span className="w-16 text-xs font-semibold text-purple-300 text-right">{g.gene}</span>
                        <div className="flex-1 bg-[#151518] rounded-full h-4 overflow-hidden">
                          <div
                            className="h-4 bg-gradient-to-r from-purple-700 to-purple-400 rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${g.pct}%` }}
                          >
                            <span className="text-[9px] text-white font-medium">{g.pct}%</span>
                          </div>
                        </div>
                        <span className="w-12 text-xs text-gray-500 text-right">{g.n.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {Object.keys(charQuery.data.variant_type_dist).length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">Variant Types</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(charQuery.data.variant_type_dist).map(([type, n]) => (
                        <div key={type} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#151518] rounded-lg border border-white/10">
                          <span className="text-xs font-semibold text-white">{type}</span>
                          <span className="text-xs text-gray-500">{Number(n).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {charQuery.data.tmb_distribution.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">Mutation Load per Sample</h3>
                    <div className="flex items-end gap-2 h-24">
                      {charQuery.data.tmb_distribution.map((b) => {
                        const maxCount = Math.max(...charQuery.data.tmb_distribution.map((x) => x.count));
                        return (
                          <div key={b.bucket} className="flex flex-col items-center gap-1 flex-1">
                            <span className="text-[9px] text-gray-500">{b.count}</span>
                            <div
                              className="w-full bg-teal-700 rounded-t"
                              style={{ height: `${(b.count / maxCount) * 64}px` }}
                            />
                            <span className="text-[9px] text-gray-500">{b.bucket}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {charQuery.data?.total_variants === 0 && (
              <p className="text-sm text-gray-500 py-4">No variants loaded. Upload VCF/MAF files first.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
