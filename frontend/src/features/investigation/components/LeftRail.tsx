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
    activeColor: "text-text-secondary",
    activeBorder: "border-l-2 border-border-hover",
  },
];

interface LeftRailProps {
  pinCount: number;
  runCount: number;
}

export function LeftRail({ pinCount, runCount }: LeftRailProps) {
  const { activeDomain, setActiveDomain, toggleSidebar } = useInvestigationStore();

  return (
    <div
      className="w-52 flex flex-col h-full border-r border-border-default"
      style={{ backgroundColor: "var(--surface-base)" }}
    >
      <div className="px-3 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-ghost mb-3 px-2">
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
                    ? `${item.activeBorder} bg-surface-base ${item.activeColor}`
                    : "border-l-2 border-transparent text-text-muted hover:bg-surface-base hover:text-text-primary",
                ].join(" ")}
              >
                <span className={isActive ? item.activeColor : ""}>{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mx-3 border-t border-border-default my-2" />

      <div className="px-3 flex flex-col gap-0.5">
        <button
          type="button"
          onClick={toggleSidebar}
          className={[
            "flex items-center gap-2.5 px-2 py-2 w-full text-left rounded transition-colors",
            pinCount > 0
              ? "text-teal-400 hover:bg-surface-base"
              : "text-text-ghost hover:bg-surface-base hover:text-text-secondary",
          ].join(" ")}
          aria-label="Toggle evidence sidebar"
        >
          <Pin size={14} />
          <span className="text-xs">Pinned ({pinCount})</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveDomain("clinical");
          }}
          className={[
            "flex items-center gap-2.5 px-2 py-2 w-full text-left rounded transition-colors",
            runCount > 0
              ? "text-teal-400 hover:bg-surface-base"
              : "text-text-ghost hover:bg-surface-base hover:text-text-secondary",
          ].join(" ")}
          aria-label="Switch to clinical domain run history"
        >
          <Play size={14} />
          <span className="text-xs">Runs ({runCount})</span>
        </button>
      </div>
    </div>
  );
}
