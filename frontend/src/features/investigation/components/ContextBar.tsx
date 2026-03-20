import { useInvestigationStore } from "../stores/investigationStore";
import type { ClinicalState, EvidenceDomain, Investigation } from "../types";
import { ContextCard } from "./ContextCard";

interface ContextBarProps {
  investigation: Investigation;
}

function getPhenotypeSummary(investigation: Investigation): string {
  const count = investigation.phenotype_state.concept_sets.length;
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
      <span key="complete" style={{ color: "#2DD4BF" }}>
        {completed} complete
      </span>,
    );
  }
  if (running > 0) {
    parts.push(
      <span key="running" style={{ color: "#C9A227" }}>
        {running} running
      </span>,
    );
  }
  if (failed > 0) {
    parts.push(
      <span key="failed" style={{ color: "#9B1B30" }}>
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

function getGenomicSummary(investigation: Investigation): string {
  const count = investigation.genomic_state.uploaded_gwas.length;
  return count > 0 ? `${count} GWAS file${count !== 1 ? "s" : ""}` : "—";
}

function getSynthesisSummary(investigation: Investigation): string {
  const pinCount = investigation.pins?.length ?? 0;
  const sections = investigation.synthesis_state.section_order.length;
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

export function ContextBar({ investigation }: ContextBarProps) {
  const { activeDomain, setActiveDomain } = useInvestigationStore();

  const summaries: Record<EvidenceDomain, string> = {
    phenotype: getPhenotypeSummary(investigation),
    clinical: getClinicalSummary(investigation.clinical_state),
    genomic: getGenomicSummary(investigation),
    synthesis: getSynthesisSummary(investigation),
  };

  return (
    <div className="flex gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-950">
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
  );
}
