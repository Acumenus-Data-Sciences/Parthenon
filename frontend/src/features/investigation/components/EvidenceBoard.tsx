import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useInvestigationStore } from "../stores/investigationStore";
import type { Investigation, InvestigationStatus } from "../types";
import { ClinicalPanel } from "./clinical/ClinicalPanel";
import { ContextBar } from "./ContextBar";
import { EvidenceSidebar } from "./EvidenceSidebar";
import { GenomicPanel } from "./genomic/GenomicPanel";
import { LeftRail } from "./LeftRail";
import { PhenotypePanel } from "./PhenotypePanel";
import { SynthesisPanel } from "./SynthesisPanel";

interface EvidenceBoardProps {
  investigation: Investigation;
}

const STATUS_BADGE: Record<
  InvestigationStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-zinc-800 text-zinc-400 border border-zinc-700",
  },
  active: {
    label: "Active",
    className: "bg-teal-900/50 text-teal-300 border border-teal-700",
  },
  complete: {
    label: "Complete",
    className: "bg-emerald-900/50 text-emerald-300 border border-emerald-700",
  },
  archived: {
    label: "Archived",
    className: "bg-zinc-900 text-zinc-600 border border-zinc-700",
  },
};

function FocusPanel({ investigation }: { investigation: Investigation }) {
  const { activeDomain } = useInvestigationStore();

  switch (activeDomain) {
    case "phenotype":
      return <PhenotypePanel investigation={investigation} />;
    case "clinical":
      return <ClinicalPanel investigation={investigation} />;
    case "genomic":
      return <GenomicPanel investigation={investigation} />;
    case "synthesis":
      return <SynthesisPanel investigation={investigation} />;
    default:
      return null;
  }
}

export function EvidenceBoard({ investigation }: EvidenceBoardProps) {
  const pinCount = investigation.pins?.length ?? 0;
  const runCount = investigation.clinical_state.queued_analyses.filter(
    (a) => a.run_id !== null,
  ).length;

  const badge = STATUS_BADGE[investigation.status];

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: "#0E0E11" }}
    >
      {/* Top bar */}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: back link + title + breadcrumb */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-3">
              <Link
                to="/workbench"
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
              >
                <ArrowLeft className="h-3 w-3" />
                Workbench
              </Link>
              <span className="text-zinc-700 text-xs">|</span>
              <span className="text-lg font-semibold text-zinc-100 truncate">
                {investigation.title}
              </span>
            </div>
            <p className="text-xs text-zinc-500 leading-none ml-0.5">
              Workbench{" "}
              <span className="text-zinc-700">/</span>{" "}
              Evidence Investigation{" "}
              <span className="text-zinc-700">/</span>{" "}
              <span className="text-zinc-400">{investigation.title}</span>
            </p>
          </div>

          {/* Right: status badge */}
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
      </div>

      {/* Body: three-column layout */}
      <div className="flex flex-1 min-h-0">
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
    </div>
  );
}
