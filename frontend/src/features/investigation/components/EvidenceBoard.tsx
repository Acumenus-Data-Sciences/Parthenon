import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useInvestigationStore } from "../stores/investigationStore";
import type { EvidenceDomain, Investigation, InvestigationStatus } from "../types";
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
    className: "bg-surface-raised text-text-muted border border-border-default",
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
    className: "bg-surface-base text-text-ghost border border-border-default",
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

const VALID_DOMAINS: EvidenceDomain[] = ["phenotype", "clinical", "genomic", "synthesis"];

export function EvidenceBoard({ investigation }: EvidenceBoardProps) {
  const pinCount = investigation.pins?.length ?? 0;
  const runCount = (investigation.clinical_state.queued_analyses ?? []).filter(
    (a) => (a as Record<string, unknown>).run_id !== null,
  ).length;

  const badge = STATUS_BADGE[investigation.status];
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeDomain, setActiveDomain } = useInvestigationStore();

  // Sync URL → store on mount (honour deep-linked ?domain= param)
  useEffect(() => {
    const urlDomain = searchParams.get("domain");
    if (urlDomain && (VALID_DOMAINS as string[]).includes(urlDomain)) {
      setActiveDomain(urlDomain as EvidenceDomain);
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync store → URL whenever activeDomain changes
  useEffect(() => {
    setSearchParams(
      (prev) => {
        prev.set("domain", activeDomain);
        return prev;
      },
      { replace: true },
    );
  }, [activeDomain, setSearchParams]);

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: "#0E0E11" }}
    >
      {/* Top bar */}
      <div className="shrink-0 border-b border-border-default bg-surface-darkest px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: back link + title + breadcrumb */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-3">
              <Link
                to="/workbench"
                className="flex items-center gap-1 text-xs text-text-ghost hover:text-text-secondary transition-colors shrink-0"
              >
                <ArrowLeft className="h-3 w-3" />
                Workbench
              </Link>
              <span className="text-text-ghost text-xs">|</span>
              <span className="text-lg font-semibold text-text-primary truncate">
                {investigation.title}
              </span>
            </div>
            <p className="text-xs text-text-ghost leading-none ml-0.5">
              Workbench{" "}
              <span className="text-text-ghost">/</span>{" "}
              Evidence Investigation{" "}
              <span className="text-text-ghost">/</span>{" "}
              <span className="text-text-muted">{investigation.title}</span>
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

      {/* Body: three-column layout — desktop-first, minimum viewport 1280px.
           On narrower screens the layout scrolls horizontally rather than crushing columns. */}
      <div className="flex flex-1 min-h-0 min-w-[1280px]">
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
