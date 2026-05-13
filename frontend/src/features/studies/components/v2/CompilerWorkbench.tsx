import type { ReactNode } from "react";
import { tAuto } from "@/i18n/autoUserFacing";
import type { Study } from "../../types/study";
import { IdentityStrip } from "./IdentityStrip";
import { PipelineRail, type PipelineStage } from "./PipelineRail";

// Phase 1 — three-pane Compiler Workbench shell.
//
// Renders `children` (the existing `StudyDesignWorkbench`) inside the center
// pane unchanged. The left pane is the static `PipelineRail` and the right
// pane is a placeholder for the Peripheral Rail (Phase 2). Layout collapses
// per Decision Q5 of the spec (breakpoints handled in studies-v2.css).

interface CompilerWorkbenchProps {
  study: Study;
  children: ReactNode;
}

// TODO(phase 2): derive these from the real `compilerGuidance` object that
// the workbench already computes (see `useStudyDesignWorkbench`).
const STAGES: ReadonlyArray<PipelineStage> = [
  {
    id: "intent",
    number: "01",
    name: "Intent",
    state: "accepted",
    detail: "protocol parsed, 12 fields",
    lastTouched: "4h ago",
    progressArc: 1,
  },
  {
    id: "phenotypes",
    number: "02",
    name: "Phenotypes",
    state: "validated",
    detail: "4 endpoints linked",
    lastTouched: "4h ago",
    progressArc: 1,
  },
  {
    id: "concept-sets",
    number: "03",
    name: "Concept Sets",
    state: "validated",
    detail: "3/4 materialized · 1 pending review",
    lastTouched: "3h ago",
    progressArc: 0.75,
  },
  {
    id: "cohorts",
    number: "04",
    name: "Cohorts",
    state: "review",
    detail: "2 blockers",
    lastTouched: "2h ago",
    progressArc: 0.66,
  },
  {
    id: "feasibility",
    number: "05",
    name: "Feasibility",
    state: "partial",
    detail: "single CDM readiness pending",
    lastTouched: "2h ago",
    progressArc: 0.5,
  },
  {
    id: "analyses",
    number: "06",
    name: "Analyses",
    state: "not-started",
    detail: "",
    lastTouched: "—",
    progressArc: 0,
  },
  {
    id: "lock",
    number: "07",
    name: "Lock",
    state: "gated",
    detail: "awaiting resolution",
    lastTouched: "—",
    progressArc: 0,
    isLock: true,
  },
  {
    id: "package",
    number: "08",
    name: "Package",
    state: "gated",
    detail: "",
    lastTouched: "—",
    progressArc: 0,
  },
];

// The six Peripheral Rail tabs from the spec — inert in Phase 1.
const PERIPHERAL_TABS = ["Evidence", "Lint", "Notes", "Sites", "Versions", "Abby"] as const;

export function CompilerWorkbench({ study, children }: CompilerWorkbenchProps) {
  return (
    <div className="studies-v2-root">
      <IdentityStrip study={study} />

      {/* <768px banner — per Decision Q5; CSS toggles visibility. */}
      <div className="studies-v2-narrow-banner" role="note">
        {tAuto("studies.v2.bestViewedOnDesktop")}{" "}
        <a href="/studies">{tAuto("studies.v2.backToStudies")}</a>
      </div>

      <main className="studies-v2-workbench">
        <PipelineRail stages={STAGES} activeStageId="cohorts" />

        <section
          className="pane studies-v2-center"
          aria-label={tAuto("studies.v2.activeEditor")}
        >
          {children}
        </section>

        <aside className="pane studies-v2-periph" aria-label={tAuto("studies.v2.peripheralRail")}>
          <div className="tabs" role="tablist" aria-label={tAuto("studies.v2.peripheralTabs")}>
            {PERIPHERAL_TABS.map((tab, index) => (
              <div
                key={tab}
                className={index === 0 ? "tab active" : "tab"}
                role="tab"
                aria-selected={index === 0}
                aria-disabled="true"
              >
                {tab}
              </div>
            ))}
          </div>
          <div className="periph-body">
            <div className="periph-stamp wb-mono">
              <span className="stamp-h wb-serif">Peripheral Rail</span>
              coming in Phase 2
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
