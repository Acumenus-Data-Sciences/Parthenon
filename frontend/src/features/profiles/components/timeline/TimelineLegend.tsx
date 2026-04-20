import type { ClinicalDomain, ClinicalEvent, ObservationPeriod } from "../../types/profile";
import { DOMAIN_CONFIG } from "../../lib/timeline-utils";

interface TimelineLegendProps {
  activeDomains: ClinicalDomain[];
  domainEvents: Record<ClinicalDomain, ClinicalEvent[]>;
  observationPeriods: ObservationPeriod[];
}

export function TimelineLegend({
  activeDomains,
  domainEvents,
  observationPeriods,
}: TimelineLegendProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-t border-border-default bg-[var(--patient-timeline-toolbar-bg)]">
      <div className="flex flex-wrap gap-3">
        {activeDomains.map((domain) => {
          const config = DOMAIN_CONFIG[domain];
          return (
            <div key={domain} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-[10px] text-text-muted">
                {config.label} ({domainEvents[domain].length})
              </span>
            </div>
          );
        })}
        {observationPeriods.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-success opacity-30" />
            <span className="text-[10px] text-text-muted">Obs. period</span>
          </div>
        )}
      </div>
      <span className="text-[10px] text-text-disabled">
        Ctrl+scroll to zoom · Drag to pan · Arrow keys · +/- keys · Click event for details
      </span>
    </div>
  );
}
