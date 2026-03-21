import { cn } from "@/lib/utils";
import type { ClinicalDomain, ClinicalEvent } from "../../types/profile";
import { DOMAIN_CONFIG } from "../../lib/timeline-utils";

interface DomainFilterBarProps {
  allPresentDomains: ClinicalDomain[];
  hiddenDomains: Set<ClinicalDomain>;
  events: ClinicalEvent[];
  onToggleHide: (domain: ClinicalDomain) => void;
}

export function DomainFilterBar({
  allPresentDomains,
  hiddenDomains,
  events,
  onToggleHide,
}: DomainFilterBarProps) {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2 bg-[#151518] border-b border-[#232328] overflow-x-auto">
      <span className="text-[10px] text-[#5A5650] shrink-0 mr-1">Domains:</span>
      {allPresentDomains.map((domain) => {
        const cfg = DOMAIN_CONFIG[domain];
        const hidden = hiddenDomains.has(domain);
        const count = events.filter((e) => e.domain === domain).length;
        return (
          <button
            key={domain}
            type="button"
            onClick={() => onToggleHide(domain)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-all shrink-0",
              hidden
                ? "border-[#323238] text-[#5A5650] bg-transparent"
                : "border-opacity-30 text-opacity-90",
            )}
            style={
              hidden
                ? {}
                : {
                    backgroundColor: `${cfg.color}15`,
                    color: cfg.color,
                    borderColor: `${cfg.color}40`,
                  }
            }
          >
            {cfg.label} ({count})
          </button>
        );
      })}
    </div>
  );
}
