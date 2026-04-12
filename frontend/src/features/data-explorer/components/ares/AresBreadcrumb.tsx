import type { AresSection } from "../../types/ares";

const SECTION_LABELS: Record<AresSection, string> = {
  hub: "Hub",
  "network-overview": "Network Overview",
  "concept-comparison": "Concept Comparison",
  "dq-history": "DQ History",
  coverage: "Coverage",
  feasibility: "Feasibility",
  diversity: "Diversity",
  releases: "Releases",
  "unmapped-codes": "Unmapped Codes",
  cost: "Cost",
  annotations: "Annotations",
};

interface AresBreadcrumbProps {
  activeSection: AresSection;
  onBack: () => void;
}

export function AresBreadcrumb({ activeSection, onBack }: AresBreadcrumbProps) {
  if (activeSection === "hub") return null;

  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-4 py-2 text-sm">
      <button
        type="button"
        onClick={onBack}
        className="text-accent hover:text-warning transition-colors"
      >
        Ares
      </button>
      <span className="text-text-muted">&rsaquo;</span>
      <span className="text-text-primary">{SECTION_LABELS[activeSection]}</span>
    </div>
  );
}
