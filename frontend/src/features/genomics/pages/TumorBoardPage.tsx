/**
 * Molecular Tumor Board Dashboard
 *
 * Per-patient molecular evidence panel:
 * - Variant table with pathogenicity classification
 * - Patient demographics
 * - Outcomes from molecularly similar patients (n, median survival, event rate)
 * - Drug exposure patterns in similar patients
 * - Exportable evidence summary
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dna,
  User,
  Users,
  Pill,
  FileText,
  Loader2,
  AlertCircle,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import apiClient from "@/lib/api-client";

interface Variant {
  id: number;
  gene: string | null;
  hgvs_p: string | null;
  hgvs_c: string | null;
  variant_type: string | null;
  variant_class: string | null;
  clinvar_significance: string | null;
  clinvar_id: string | null;
  allele_frequency: number | null;
  zygosity: string | null;
  chromosome: string;
  position: number;
}

interface SimilarOutcome {
  gene: string;
  n_similar: number;
  median_survival_days: number | null;
  event_rate: number;
}

interface DrugPattern {
  drug: string;
  n: number;
  pct: number;
}

interface Panel {
  person_id: number;
  source_id: number;
  variants: Variant[];
  demographics: Record<string, string | number> | null;
  actionable_genes: string[];
  similar_patients: SimilarOutcome[];
  drug_patterns: DrugPattern[];
  evidence_summary: string;
}

const CLINVAR_SEVERITY: Record<string, { color: string; icon: typeof ShieldAlert; label: string }> = {
  pathogenic: { color: "text-critical", icon: ShieldAlert, label: "Pathogenic" },
  "likely pathogenic": { color: "text-orange-400", icon: ShieldAlert, label: "Likely Pathogenic" },
  "uncertain significance": { color: "text-amber-400", icon: ShieldQuestion, label: "VUS" },
  "likely benign": { color: "text-blue-400", icon: ShieldCheck, label: "Likely Benign" },
  benign: { color: "text-success", icon: ShieldCheck, label: "Benign" },
};

function clinvarInfo(sig: string | null) {
  if (!sig) return null;
  const key = sig.toLowerCase();
  for (const [k, v] of Object.entries(CLINVAR_SEVERITY)) {
    if (key.includes(k)) return v;
  }
  return null;
}

export default function TumorBoardPage() {
  const [personId, setPersonId] = useState("");
  const [sourceId] = useState(9);
  const [submitted, setSubmitted] = useState<number | null>(null);

  const { data: panel, isLoading, isError } = useQuery({
    queryKey: ["genomics", "tumor-board", submitted, sourceId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/genomics/tumor-board/${submitted}`, {
        params: { source_id: sourceId },
      });
      return data.data as Panel;
    },
    enabled: submitted !== null,
  });

  const handleSearch = () => {
    const id = parseInt(personId, 10);
    if (id > 0) setSubmitted(id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-domain-observation/12 flex-shrink-0">
          <Dna size={18} style={{ color: "var(--domain-observation)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Molecular Tumor Board</h1>
          <p className="text-sm text-text-muted">
            Per-patient molecular evidence panel — variants, similar patient outcomes, drug patterns
          </p>
        </div>
      </div>

      {/* Patient search */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4">
        <label className="block text-xs text-text-muted mb-2">OMOP Person ID</label>
        <div className="flex items-center gap-2">
          <input
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Enter person_id..."
            className="w-48 rounded-lg bg-surface-base border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success focus:ring-1 focus:ring-success/40 transition-colors"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={!personId}
            className="inline-flex items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base hover:bg-success-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Search size={14} />
            Load Panel
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-text-muted py-8 justify-center">
          <Loader2 size={20} className="animate-spin text-success" />
          <span className="text-sm">Building evidence panel...</span>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-critical/30 bg-critical/10 p-4 text-critical">
          <AlertCircle size={16} />
          <span className="text-sm">
            Failed to load panel. Check that person_id exists and genomic data is available.
          </span>
        </div>
      )}

      {panel && !isLoading && (
        <div className="space-y-4">
          {/* Evidence summary banner */}
          <div className="rounded-lg border border-success/30 bg-success/10 p-4">
            <div className="flex items-start gap-2">
              <FileText size={16} className="text-success flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-text-primary mb-1">Evidence Summary</p>
                <p className="text-sm text-text-secondary">{panel.evidence_summary}</p>
                {panel.actionable_genes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {panel.actionable_genes.map((g) => (
                      <span
                        key={g}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-critical/15 border border-critical/30 text-critical"
                      >
                        {g} — Actionable
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Variants */}
            <div className="lg:col-span-2 rounded-lg border border-border-default bg-surface-raised">
              <div className="px-4 py-3 border-b border-border-default flex items-center gap-2">
                <Dna size={14} className="text-domain-observation" />
                <h2 className="text-sm font-semibold text-text-primary">
                  Variants ({panel.variants.length})
                </h2>
              </div>
              {panel.variants.length === 0 ? (
                <p className="text-xs text-text-ghost p-4">
                  No genomic variants on record for this patient.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border-default">
                        {["Gene", "Alteration", "Type", "Class", "AF", "Classification"].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2.5 text-left text-[10px] font-medium text-text-ghost uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {panel.variants.map((v) => {
                        const sig = clinvarInfo(v.clinvar_significance);
                        const SigIcon = sig?.icon ?? ShieldQuestion;
                        return (
                          <tr key={v.id} className="hover:bg-surface-overlay transition-colors">
                            <td className="px-3 py-2.5 font-semibold text-domain-observation">
                              {v.gene ?? "—"}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-text-secondary">
                              {v.hgvs_p ?? v.hgvs_c ?? `${v.chromosome}:${v.position}`}
                            </td>
                            <td className="px-3 py-2.5 text-text-muted">{v.variant_type ?? "—"}</td>
                            <td
                              className="px-3 py-2.5 text-text-muted max-w-[120px] truncate"
                              title={v.variant_class ?? ""}
                            >
                              {v.variant_class ?? "—"}
                            </td>
                            <td className="px-3 py-2.5 text-text-muted">
                              {v.allele_frequency != null
                                ? (v.allele_frequency * 100).toFixed(1) + "%"
                                : "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              {sig ? (
                                <span className={`flex items-center gap-1 ${sig.color}`}>
                                  <SigIcon size={11} />
                                  <span>{sig.label}</span>
                                </span>
                              ) : (
                                <span className="text-text-disabled">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right column: demographics + drug patterns */}
            <div className="space-y-4">
              {/* Demographics */}
              {panel.demographics && (
                <div className="rounded-lg border border-border-default bg-surface-raised p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <User size={14} className="text-blue-400" />
                    <h2 className="text-sm font-semibold text-text-primary">Demographics</h2>
                  </div>
                  <dl className="space-y-1.5">
                    {Object.entries(panel.demographics).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <dt className="text-text-ghost capitalize">{k.replace(/_/g, " ")}</dt>
                        <dd className="text-text-secondary font-medium">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/* Drug patterns */}
              {panel.drug_patterns.length > 0 && (
                <div className="rounded-lg border border-border-default bg-surface-raised p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Pill size={14} className="text-success" />
                    <h2 className="text-sm font-semibold text-text-primary">
                      Drug Patterns in Similar Patients
                    </h2>
                  </div>
                  <div className="space-y-2">
                    {panel.drug_patterns.map((d) => (
                      <div key={d.drug} className="flex items-center gap-2">
                        <div className="flex-1 truncate text-xs text-text-secondary" title={d.drug}>
                          {d.drug}
                        </div>
                        <div className="w-24 bg-surface-base rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${Math.min(d.pct, 100)}%`,
                              backgroundColor: "var(--success)",
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-text-ghost w-10 text-right">{d.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Similar patient outcomes */}
          {panel.similar_patients.length > 0 && (
            <div className="rounded-lg border border-border-default bg-surface-raised">
              <div className="px-4 py-3 border-b border-border-default flex items-center gap-2">
                <Users size={14} className="text-success" />
                <h2 className="text-sm font-semibold text-text-primary">
                  Outcomes in Molecularly Similar Patients
                </h2>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-default">
                    {["Gene", "Similar Patients (n)", "Median Survival", "Event Rate"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-[10px] font-medium text-text-ghost uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {panel.similar_patients.map((s) => (
                    <tr key={s.gene} className="hover:bg-surface-overlay transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-domain-observation">{s.gene}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{s.n_similar.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-text-secondary">
                        {s.median_survival_days !== null
                          ? `${Math.round(s.median_survival_days / 30.4)} months`
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-surface-base rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${Math.min(s.event_rate * 100, 100)}%`,
                                backgroundColor: `hsl(${(1 - s.event_rate) * 120}, 60%, 50%)`,
                              }}
                            />
                          </div>
                          <span className="text-text-secondary">{(s.event_rate * 100).toFixed(1)}%</span>
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
    </div>
  );
}
