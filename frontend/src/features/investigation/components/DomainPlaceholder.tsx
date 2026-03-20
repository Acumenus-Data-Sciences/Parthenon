import { Activity, Dna, FileText, Microscope } from "lucide-react";
import type { EvidenceDomain } from "../types";

interface DomainPlaceholderProps {
  domain: EvidenceDomain;
  phase: string;
}

const DOMAIN_ICON: Record<EvidenceDomain, React.ReactNode> = {
  phenotype: <Microscope size={48} />,
  clinical: <Activity size={48} />,
  genomic: <Dna size={48} />,
  synthesis: <FileText size={48} />,
};

const DOMAIN_LABEL: Record<EvidenceDomain, string> = {
  phenotype: "Phenotype",
  clinical: "Clinical",
  genomic: "Genomic",
  synthesis: "Synthesis",
};

export function DomainPlaceholder({ domain, phase }: DomainPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-600">
      <span className="text-zinc-700">{DOMAIN_ICON[domain]}</span>
      <div className="text-center">
        <p className="text-base font-medium text-zinc-500">{DOMAIN_LABEL[domain]}</p>
        <p className="text-sm text-zinc-600 mt-1">Coming in {phase}</p>
      </div>
    </div>
  );
}
