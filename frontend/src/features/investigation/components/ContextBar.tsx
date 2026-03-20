import { useInvestigationStore } from "../stores/investigationStore";
import type { EvidenceDomain, Investigation } from "../types";
import { ContextCard } from "./ContextCard";

interface ContextBarProps {
  investigation: Investigation;
}

function getPhenotypeSummary(investigation: Investigation): string {
  const count = investigation.phenotype_state.concept_sets.length;
  return count > 0 ? `${count} concept set${count !== 1 ? "s" : ""}` : "No concepts";
}

function getClinicalSummary(investigation: Investigation): string {
  const count = investigation.clinical_state.queued_analyses.length;
  return count > 0 ? `${count} analysis${count !== 1 ? "es" : ""} queued` : "—";
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
    clinical: getClinicalSummary(investigation),
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
          isActive={activeDomain === domain}
          onClick={() => setActiveDomain(domain)}
        />
      ))}
    </div>
  );
}
