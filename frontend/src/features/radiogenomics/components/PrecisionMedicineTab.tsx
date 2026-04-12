import { Fragment, useState } from "react";
import {
  Dna, Pill, ShieldAlert, ShieldCheck, AlertTriangle,
  ChevronDown, ChevronUp, Loader2, TrendingDown, TrendingUp,
  Minus, FlaskConical, Activity,
} from "lucide-react";
import { useRadiogenomicsPanel } from "../hooks/useRadiogenomics";
import type {
  RadiogenomicsPanel,
  VariantDrugCorrelation,
  PrecisionRecommendation,
  VariantSummary,
} from "../types";
import type { DrugExposure } from "../../imaging/types";

// ── Colors & Constants ──────────────────────────────────────────────────

const RELATIONSHIP_STYLES: Record<string, { color: string; label: string; icon: typeof ShieldCheck }> = {
  sensitive:         { color: "var(--success)", label: "Sensitive",         icon: ShieldCheck },
  resistant:         { color: "var(--critical)", label: "Resistant",         icon: ShieldAlert },
  partial_response:  { color: "var(--accent)", label: "Partial Response",  icon: Activity },
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high:   "var(--success)",
  medium: "var(--accent)",
  low:    "var(--text-muted)",
};

const SIGNIFICANCE_COLORS: Record<string, string> = {
  Pathogenic:            "var(--critical)",
  "Likely pathogenic":   "var(--critical)",
  "Uncertain significance": "var(--accent)",
  Benign:                "var(--success)",
  "Likely benign":       "var(--success)",
};

// ── Main Component ──────────────────────────────────────────────────────

interface PrecisionMedicineTabProps {
  personId: number;
  sourceId?: number;
}

export default function PrecisionMedicineTab({ personId, sourceId }: PrecisionMedicineTabProps) {
  const { data: panel, isLoading, error } = useRadiogenomicsPanel(personId, sourceId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-domain-observation" />
      </div>
    );
  }

  if (error || !panel) {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-dashed border-surface-highlight bg-surface-raised">
        <Dna size={24} className="text-text-ghost mb-3" />
        <p className="text-sm text-text-muted">
          {error ? "Failed to load precision medicine panel" : "No genomic data available for this patient"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary Header */}
      <PanelSummary panel={panel} />

      {/* Precision Recommendations (most actionable — show first) */}
      {panel.recommendations.length > 0 && (
        <RecommendationsSection recommendations={panel.recommendations} />
      )}

      {/* Variant-Drug Correlations */}
      {panel.correlations.length > 0 && (
        <CorrelationsTable correlations={panel.correlations} />
      )}

      {/* Genomic Variants */}
      <VariantsSection variants={panel.variants} />

      {/* Treatment History */}
      {panel.drug_exposures.length > 0 && (
        <TreatmentHistory drugs={panel.drug_exposures} />
      )}
    </div>
  );
}

// ── Panel Summary ───────────────────────────────────────────────────────

function PanelSummary({ panel }: { panel: RadiogenomicsPanel }) {
  const { variants, correlations, recommendations, drug_exposures } = panel;

  const stats = [
    { label: "Total Variants", value: variants.total, color: "var(--domain-observation)", icon: Dna },
    { label: "Pathogenic", value: variants.pathogenic_count, color: "var(--critical)", icon: AlertTriangle },
    { label: "VUS", value: variants.vus_count, color: "var(--accent)", icon: FlaskConical },
    { label: "Drug Correlations", value: correlations.length, color: "var(--success)", icon: Pill },
    { label: "Recommendations", value: recommendations.length, color: "var(--info)", icon: ShieldCheck },
    { label: "Treatments", value: drug_exposures.length, color: "var(--text-primary)", icon: Pill },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="rounded-lg border border-border-default bg-surface-raised px-3 py-3 text-center"
          >
            <Icon size={14} className="mx-auto mb-1" style={{ color: s.color }} />
            <p className="text-lg font-bold font-mono" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="text-[10px] text-text-ghost uppercase tracking-wider">{s.label}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Recommendations Section ─────────────────────────────────────────────

function RecommendationsSection({ recommendations }: { recommendations: PrecisionRecommendation[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <ShieldCheck size={14} className="text-info" />
        Precision Medicine Recommendations
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {recommendations.map((rec, i) => (
          <RecommendationCard key={i} rec={rec} />
        ))}
      </div>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: PrecisionRecommendation }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-lg border border-info/20 bg-info/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Dna size={14} className="text-domain-observation" />
          <span className="text-sm font-semibold text-text-primary">
            {rec.gene} {rec.variant}
          </span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-text-ghost" /> : <ChevronDown size={14} className="text-text-ghost" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Drugs to avoid */}
          {rec.drugs_avoid.length > 0 && (
            <div>
              <p className="text-[10px] text-critical uppercase tracking-wider font-semibold mb-1.5">
                Avoid (predicted resistance)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {rec.drugs_avoid.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-critical/10 text-critical border border-critical/20"
                  >
                    <ShieldAlert size={10} />
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Drugs to consider */}
          {rec.drugs_consider.length > 0 && (
            <div>
              <p className="text-[10px] text-success uppercase tracking-wider font-semibold mb-1.5">
                Consider (predicted sensitivity)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {rec.drugs_consider.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-success/10 text-success border border-success/20"
                  >
                    <ShieldCheck size={10} />
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Rationale */}
          <p className="text-xs text-text-muted italic leading-relaxed">{rec.rationale}</p>
        </div>
      )}
    </div>
  );
}

// ── Correlations Table ──────────────────────────────────────────────────

function CorrelationsTable({ correlations }: { correlations: VariantDrugCorrelation[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Pill size={14} className="text-success" />
          Variant-Drug Correlations ({correlations.length})
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border-subtle text-[10px] uppercase tracking-wider text-text-ghost">
              <th className="px-4 py-2 font-medium">Gene</th>
              <th className="px-4 py-2 font-medium">Variant</th>
              <th className="px-4 py-2 font-medium">Drug</th>
              <th className="px-4 py-2 font-medium">Relationship</th>
              <th className="px-4 py-2 font-medium">Confidence</th>
              <th className="px-4 py-2 font-medium">Received</th>
              <th className="px-4 py-2 font-medium">Response</th>
              <th className="px-4 py-2 font-medium w-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {correlations.map((c, i) => {
              const relStyle = RELATIONSHIP_STYLES[c.relationship] ?? RELATIONSHIP_STYLES.sensitive;
              const RelIcon = relStyle.icon;
              const isExpanded = expanded === i;

              return (
                <Fragment key={i}>
                  <tr className="group">
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-semibold text-domain-observation">{c.gene_symbol}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-mono text-text-secondary">{c.hgvs_p ?? "—"}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-text-primary">{c.drug_name}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: `${relStyle.color}18`, color: relStyle.color }}
                      >
                        <RelIcon size={10} />
                        {relStyle.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-[10px] font-medium uppercase"
                        style={{ color: CONFIDENCE_COLORS[c.confidence] ?? "var(--text-muted)" }}
                      >
                        {c.confidence}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {c.patient_received_drug ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-success">
                          <ShieldCheck size={10} />
                          Yes{c.drug_days ? ` (${c.drug_days}d)` : ""}
                        </span>
                      ) : (
                        <span className="text-[10px] text-text-ghost">No</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {c.response_category ? (
                        <ResponseChip category={c.response_category} />
                      ) : (
                        <span className="text-[10px] text-text-ghost">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : i)}
                        className="text-text-ghost hover:text-text-secondary transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="px-4 py-3 bg-surface-base">
                        <div className="space-y-2 text-xs text-text-muted">
                          {c.mechanism && <p><span className="text-text-ghost">Mechanism:</span> {c.mechanism}</p>}
                          {c.evidence_summary && <p><span className="text-text-ghost">Evidence:</span> {c.evidence_summary}</p>}
                          {c.response_rationale && <p><span className="text-text-ghost">Rationale:</span> {c.response_rationale}</p>}
                          {c.drug_start && (
                            <p>
                              <span className="text-text-ghost">Treatment period:</span>{" "}
                              {c.drug_start} — {c.drug_end ?? "ongoing"}
                            </p>
                          )}
                          <p>
                            <span className="text-text-ghost">Evidence level:</span>{" "}
                            <span className="text-accent">{c.evidence_level}</span>
                            {" · "}
                            <span className="text-text-ghost">ClinVar:</span> {c.clinvar_significance}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Variants Section ────────────────────────────────────────────────────

function VariantsSection({ variants }: { variants: VariantSummary }) {
  const [showAll, setShowAll] = useState(false);
  const displayVariants = showAll ? variants.all : variants.all.slice(0, 10);

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Dna size={14} className="text-domain-observation" />
          Genomic Variants ({variants.total})
        </h3>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-critical">{variants.pathogenic_count} pathogenic</span>
          <span className="text-accent">{variants.vus_count} VUS</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border-subtle text-[10px] uppercase tracking-wider text-text-ghost">
              <th className="px-4 py-2 font-medium">Gene</th>
              <th className="px-4 py-2 font-medium">Variant</th>
              <th className="px-4 py-2 font-medium">Class</th>
              <th className="px-4 py-2 font-medium">Significance</th>
              <th className="px-4 py-2 font-medium">Disease</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {displayVariants.map((v) => {
              const isActionable = v.id in variants.actionable;
              const isVus = v.id in variants.vus;
              const sigColor = SIGNIFICANCE_COLORS[v.clinvar_significance] ?? "var(--text-muted)";

              return (
                <tr key={v.id} className="group hover:bg-surface-overlay transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-semibold text-domain-observation">{v.gene_symbol}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-mono text-text-secondary">{v.hgvs_p ?? "—"}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-text-muted">{v.variant_class}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-medium" style={{ color: sigColor }}>
                      {v.clinvar_significance}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-text-muted max-w-[200px] truncate block">
                      {v.clinvar_disease ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {isActionable && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-critical bg-critical/10 px-2 py-0.5 rounded-full">
                        <AlertTriangle size={9} />
                        Actionable
                      </span>
                    )}
                    {isVus && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                        <FlaskConical size={9} />
                        VUS
                      </span>
                    )}
                    {!isActionable && !isVus && (
                      <span className="text-[10px] text-text-ghost">Other</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {variants.all.length > 10 && (
        <div className="px-4 py-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-domain-observation hover:text-domain-observation transition-colors"
          >
            {showAll ? "Show less" : `Show all ${variants.total} variants`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Treatment History ───────────────────────────────────────────────────

function TreatmentHistory({ drugs }: { drugs: DrugExposure[] }) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <div className="px-4 py-3 border-b border-border-default">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Pill size={14} className="text-accent" />
          Treatment History ({drugs.length})
        </h3>
      </div>

      <div className="divide-y divide-border-subtle">
        {drugs.map((d, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: "var(--accent)" }}
              />
              <div>
                <p className="text-xs font-medium text-text-primary">{d.drug_name}</p>
                {d.drug_class && (
                  <p className="text-[10px] text-text-ghost">{d.drug_class}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted">
                {d.start_date} — {d.end_date ?? "ongoing"}
              </p>
              <p className="text-[10px] text-text-ghost">{d.total_days} days</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared Components ───────────────────────────────────────────────────

function ResponseChip({ category }: { category: string }) {
  const styles: Record<string, { color: string; icon: typeof TrendingDown }> = {
    CR: { color: "var(--success)", icon: TrendingDown },
    PR: { color: "var(--info)", icon: TrendingDown },
    SD: { color: "var(--accent)", icon: Minus },
    PD: { color: "var(--critical)", icon: TrendingUp },
  };
  const s = styles[category] ?? { color: "var(--text-muted)", icon: Minus };
  const Icon = s.icon;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: `${s.color}18`, color: s.color }}
    >
      <Icon size={9} />
      {category}
    </span>
  );
}
