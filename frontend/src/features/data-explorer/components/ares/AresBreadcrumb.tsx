import { useTranslation } from "react-i18next";
import type { AresSection } from "../../types/ares";

const SECTION_KEYS: Record<AresSection, string> = {
  hub: "hub",
  "network-overview": "networkOverview",
  "concept-comparison": "conceptComparison",
  "dq-history": "dqHistory",
  coverage: "coverage",
  feasibility: "feasibility",
  diversity: "diversity",
  releases: "releases",
  "unmapped-codes": "unmappedCodes",
  cost: "cost",
  annotations: "annotations",
};

interface AresBreadcrumbProps {
  activeSection: AresSection;
  onBack: () => void;
}

export function AresBreadcrumb({ activeSection, onBack }: AresBreadcrumbProps) {
  const { t } = useTranslation("app");

  if (activeSection === "hub") return null;

  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-4 py-2 text-sm">
      <button
        type="button"
        onClick={onBack}
        className="text-accent hover:text-accent transition-colors"
      >
        {t("dataExplorer.ares.name")}
      </button>
      <span className="text-text-muted">
        {t("dataExplorer.ares.breadcrumbSeparator")}
      </span>
      <span className="text-text-primary">
        {t(`dataExplorer.ares.sections.${SECTION_KEYS[activeSection]}`)}
      </span>
    </div>
  );
}
