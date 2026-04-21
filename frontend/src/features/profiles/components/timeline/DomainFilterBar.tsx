import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { ClinicalDomain, ClinicalEvent } from "../../types/profile";
import { DOMAIN_CONFIG, getTimelineDomainLabel } from "../../lib/timeline-utils";

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
  const { t } = useTranslation("app");
  return (
    <div className="flex items-center gap-1.5 px-4 py-2 bg-[var(--patient-timeline-panel-bg)] border-b border-border-default overflow-x-auto">
      <span className="text-[10px] text-text-ghost shrink-0 mr-1">
        {t("profiles.timeline.domainsLabel")}
      </span>
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
                ? "border-surface-highlight text-text-ghost bg-transparent"
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
            {getTimelineDomainLabel(domain)} ({count})
          </button>
        );
      })}
    </div>
  );
}
