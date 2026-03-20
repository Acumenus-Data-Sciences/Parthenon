import { useInvestigationStore } from "../stores/investigationStore";
import type { Investigation } from "../types";
import { ContextBar } from "./ContextBar";
import { DomainPlaceholder } from "./DomainPlaceholder";
import { EvidenceSidebar } from "./EvidenceSidebar";
import { LeftRail } from "./LeftRail";
import { PhenotypePanel } from "./PhenotypePanel";

interface EvidenceBoardProps {
  investigation: Investigation;
}

function FocusPanel({ investigation }: { investigation: Investigation }) {
  const { activeDomain } = useInvestigationStore();

  switch (activeDomain) {
    case "phenotype":
      return <PhenotypePanel />;
    case "clinical":
      return <DomainPlaceholder domain="clinical" phase="Phase 2" />;
    case "genomic":
      return <DomainPlaceholder domain="genomic" phase="Phase 3" />;
    case "synthesis":
      return (
        <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
          Synthesis — Task 11
        </div>
      );
    default:
      return null;
  }
}

export function EvidenceBoard({ investigation }: EvidenceBoardProps) {
  const pinCount = investigation.pins?.length ?? 0;
  const runCount = investigation.clinical_state.queued_analyses.filter(
    (a) => a.run_id !== null,
  ).length;

  return (
    <div
      className="flex min-h-screen"
      style={{ backgroundColor: "#0E0E11" }}
    >
      {/* Left rail — spans full height */}
      <LeftRail pinCount={pinCount} runCount={runCount} />

      {/* Main area: context bar + focus panel stacked */}
      <div
        className="flex flex-col flex-1 min-w-0"
        style={{
          display: "grid",
          gridTemplateRows: "auto 1fr",
        }}
      >
        <ContextBar investigation={investigation} />
        <div className="overflow-auto">
          <FocusPanel investigation={investigation} />
        </div>
      </div>

      {/* Right sidebar */}
      <EvidenceSidebar investigationId={investigation.id} />
    </div>
  );
}
