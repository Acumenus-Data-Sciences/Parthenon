import { useState } from "react";
import type { AresSection } from "../types/ares";
import { AresBreadcrumb } from "../components/ares/AresBreadcrumb";
import { AresHub } from "../components/ares/AresHub";
import { ReleasesView } from "../components/ares/releases/ReleasesView";
import { AnnotationsView } from "../components/ares/annotations/AnnotationsView";
import DqHistoryView from "../components/ares/dq-history/DqHistoryView";
import UnmappedCodesView from "../components/ares/unmapped-codes/UnmappedCodesView";
import ConceptComparisonView from "../components/ares/concept-comparison/ConceptComparisonView";
import CoverageMatrixView from "../components/ares/coverage/CoverageMatrixView";
import DiversityView from "../components/ares/diversity/DiversityView";
import FeasibilityView from "../components/ares/feasibility/FeasibilityView";
import NetworkOverviewView from "../components/ares/network-overview/NetworkOverviewView";
import CostView from "../components/ares/cost/CostView";

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

function ComingSoonPlaceholder({ section }: { section: AresSection }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-highlight bg-surface-raised py-20">
      <p className="text-lg font-semibold text-text-primary">
        {SECTION_LABELS[section]}
      </p>
      <p className="mt-2 text-sm text-text-muted">Coming soon in a future phase</p>
    </div>
  );
}

export default function AresTab() {
  const [activeSection, setActiveSection] = useState<AresSection>("hub");

  const handleNavigate = (section: AresSection) => {
    setActiveSection(section);
  };

  const handleBack = () => {
    setActiveSection("hub");
  };

  const renderSection = () => {
    switch (activeSection) {
      case "hub":
        return <AresHub onNavigate={handleNavigate} />;
      case "releases":
        return <ReleasesView />;
      case "annotations":
        return <AnnotationsView />;
      case "dq-history":
        return <DqHistoryView />;
      case "unmapped-codes":
        return <UnmappedCodesView />;
      case "network-overview":
        return <NetworkOverviewView />;
      case "concept-comparison":
        return <ConceptComparisonView />;
      case "coverage":
        return <CoverageMatrixView />;
      case "diversity":
        return <DiversityView />;
      case "feasibility":
        return <FeasibilityView />;
      case "cost":
        return <CostView />;
      default:
        return <ComingSoonPlaceholder section={activeSection} />;
    }
  };

  return (
    <div className="space-y-4">
      <AresBreadcrumb activeSection={activeSection} onBack={handleBack} />
      {renderSection()}
    </div>
  );
}
