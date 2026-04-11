import { useInvestigationStore } from "../stores/investigationStore";
import type { ClinicalState, EvidenceDomain, GenomicState, Investigation } from "../types";
import { ContextCard } from "./ContextCard";

interface ContextBarProps {
  investigation: Investigation;
}

function getPhenotypeSummary(investigation: Investigation): string {
  const count = investigation.phenotype_state.concept_sets?.length ?? 0;
  return count > 0 ? `${count} concept set${count !== 1 ? "s" : ""}` : "No concepts";
}

function getClinicalSummary(state: ClinicalState): string {
  const analyses = state.queued_analyses ?? [];
  if (analyses.length === 0) return "No analyses";

  const running = analyses.filter(
    (a) => a.status === "running" || a.status === "queued",
  ).length;
  const completed = analyses.filter((a) => a.status === "complete").length;
  const failed = analyses.filter((a) => a.status === "failed").length;

  const parts: string[] = [];
  if (completed > 0) parts.push(`${completed} complete`);
  if (running > 0) parts.push(`${running} running`);
  if (failed > 0) parts.push(`${failed} failed`);

  return parts.join(" · ") || "No analyses";
}

function ClinicalSummaryNode({
  state,
}: {
  state: ClinicalState;
}): React.ReactElement {
  const analyses = state.queued_analyses ?? [];

  if (analyses.length === 0) {
    return <span className="text-zinc-500">No analyses</span>;
  }

  const running = analyses.filter(
    (a) => a.status === "running" || a.status === "queued",
  ).length;
  const completed = analyses.filter((a) => a.status === "complete").length;
  const failed = analyses.filter((a) => a.status === "failed").length;

  const parts: React.ReactElement[] = [];

  if (completed > 0) {
    parts.push(
      <span key="complete" style={{ color: "var(--success)" }}>
        {completed} complete
      </span>,
    );
  }
  if (running > 0) {
    parts.push(
      <span key="running" style={{ color: "var(--accent)" }}>
        {running} running
      </span>,
    );
  }
  if (failed > 0) {
    parts.push(
      <span key="failed" style={{ color: "var(--primary)" }}>
        {failed} failed
      </span>,
    );
  }

  if (parts.length === 0) {
    return <span className="text-zinc-500">No analyses</span>;
  }

  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="text-zinc-600"> · </span>}
          {part}
        </span>
      ))}
    </>
  );
}

function getGenomicSummary(state: GenomicState): string {
  const queries =
    (state.open_targets_queries?.length ?? 0) +
    (state.gwas_catalog_queries?.length ?? 0);
  const uploads = state.uploaded_gwas?.length ?? 0;
  if (queries === 0 && uploads === 0) return "No evidence";
  const parts: string[] = [];
  if (queries > 0) parts.push(`${queries} quer${queries !== 1 ? "ies" : "y"}`);
  if (uploads > 0) parts.push(`${uploads} upload${uploads !== 1 ? "s" : ""}`);
  return parts.join(" · ");
}

function getSynthesisSummary(investigation: Investigation): string {
  const pinCount = investigation.pins?.length ?? 0;
  const sections = investigation.synthesis_state.section_order?.length ?? 0;
  return pinCount > 0 || sections > 0
    ? `${pinCount} pin${pinCount !== 1 ? "s" : ""}, ${sections} section${sections !== 1 ? "s" : ""}`
    : "—";
}

const DOMAIN_ORDER: EvidenceDomain[] = ["phenotype", "clinical", "genomic", "synthesis"];
const DOMAIN_LABELS: Record<EvidenceDomain, string> = {
  phenotype: "Phenotype",
  clinical: "Clinical",
  genomic: "Genomic",
  synthesis: "Synthesis",
};

interface KpiMetric {
  label: string;
  value: number;
}

interface KpiMetricCardProps {
  metric: KpiMetric;
}

function KpiMetricCard({ metric }: KpiMetricCardProps) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2 flex flex-col items-center min-w-[72px]">
      <span className="text-2xl font-bold text-zinc-100 leading-none">{metric.value}</span>
      <span className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1 whitespace-nowrap">
        {metric.label}
      </span>
    </div>
  );
}

export function ContextBar({ investigation }: ContextBarProps) {
  const { activeDomain, setActiveDomain } = useInvestigationStore();

  const summaries: Record<EvidenceDomain, string> = {
    phenotype: getPhenotypeSummary(investigation),
    clinical: getClinicalSummary(investigation.clinical_state),
    genomic: getGenomicSummary(investigation.genomic_state),
    synthesis: getSynthesisSummary(investigation),
  };

  const kpiMetrics: KpiMetric[] = [
    {
      label: "Concept Sets",
      value: investigation.phenotype_state.concept_sets?.length ?? 0,
    },
    {
      label: "Cohorts",
      value: investigation.phenotype_state.selected_cohort_ids?.length ?? 0,
    },
    {
      label: "Analyses",
      value: investigation.clinical_state.queued_analyses?.length ?? 0,
    },
    {
      label: "Pins",
      value: investigation.pins?.length ?? 0,
    },
  ];

  const allZero = kpiMetrics.every((m) => m.value === 0);

  return (
    <div className="flex flex-col border-b border-zinc-800 bg-zinc-950">
      {/* KPI summary row */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        {allZero ? (
          <p className="text-xs text-zinc-600 italic">
            Start exploring — add concepts, cohorts, and analyses to build evidence
          </p>
        ) : (
          <div className="flex items-center gap-2">
            {kpiMetrics.map((metric) => (
              <KpiMetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        )}
      </div>

      {/* Domain context cards */}
      <div className="flex gap-2 px-4 pb-3">
        {DOMAIN_ORDER.map((domain) => (
          <ContextCard
            key={domain}
            domain={domain}
            label={DOMAIN_LABELS[domain]}
            summary={summaries[domain]}
            summaryNode={
              domain === "clinical" ? (
                <ClinicalSummaryNode state={investigation.clinical_state} />
              ) : undefined
            }
            isActive={activeDomain === domain}
            onClick={() => setActiveDomain(domain)}
          />
        ))}
      </div>
    </div>
  );
}
