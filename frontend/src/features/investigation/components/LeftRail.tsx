import { Activity, Dna, FileText, Microscope, Pin, Play } from "lucide-react";
import { useInvestigationStore } from "../stores/investigationStore";
import type { EvidenceDomain } from "../types";

interface DomainItem {
  domain: EvidenceDomain;
  label: string;
  icon: React.ReactNode;
  activeColor: string;
  activeBorder: string;
}

const DOMAIN_ITEMS: DomainItem[] = [
  {
    domain: "phenotype",
    label: "Phenotype",
    icon: <Microscope size={16} />,
    activeColor: "text-teal-400",
    activeBorder: "border-l-2 border-teal-400",
  },
  {
    domain: "clinical",
    label: "Clinical",
    icon: <Activity size={16} />,
    activeColor: "text-red-700",
    activeBorder: "border-l-2 border-red-700",
  },
  {
    domain: "genomic",
    label: "Genomic",
    icon: <Dna size={16} />,
    activeColor: "text-yellow-600",
    activeBorder: "border-l-2 border-yellow-600",
  },
  {
    domain: "synthesis",
    label: "Synthesis",
    icon: <FileText size={16} />,
    activeColor: "text-zinc-300",
    activeBorder: "border-l-2 border-zinc-300",
  },
];

interface LeftRailProps {
  pinCount: number;
  runCount: number;
}

export function LeftRail({ pinCount, runCount }: LeftRailProps) {
  const { activeDomain, setActiveDomain } = useInvestigationStore();

  return (
    <div
      className="w-52 flex flex-col h-full border-r border-zinc-800"
      style={{ backgroundColor: "#0E0E11" }}
    >
      <div className="px-3 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3 px-2">
          Domains
        </p>
        <nav className="flex flex-col gap-0.5">
          {DOMAIN_ITEMS.map((item) => {
            const isActive = activeDomain === item.domain;
            return (
              <button
                key={item.domain}
                onClick={() => setActiveDomain(item.domain)}
                className={[
                  "flex items-center gap-2.5 px-2 py-2 rounded-r text-left w-full transition-colors",
                  isActive
                    ? `${item.activeBorder} bg-zinc-900 ${item.activeColor}`
                    : "border-l-2 border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200",
                ].join(" ")}
              >
                <span className={isActive ? item.activeColor : ""}>{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mx-3 border-t border-zinc-800 my-2" />

      <div className="px-3 flex flex-col gap-0.5">
        <div className="flex items-center gap-2.5 px-2 py-2 text-zinc-500">
          <Pin size={14} />
          <span className="text-xs">Pinned ({pinCount})</span>
        </div>
        <div className="flex items-center gap-2.5 px-2 py-2 text-zinc-500">
          <Play size={14} />
          <span className="text-xs">Runs ({runCount})</span>
        </div>
      </div>
    </div>
  );
}
