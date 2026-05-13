import { useMemo, useState } from "react";
import { tAuto } from "@/i18n/autoUserFacing";
import type {
  Study,
  StudyCompilerGuidance,
  StudyCompilerStage,
  StudyCompilerStageId,
  StudyCompilerStageStatus,
} from "../../types/study";
import {
  specToForm,
  versionSpec,
} from "../workbench/studyDesignWorkbenchHelpers";
import { buildIntentReviewAssistance } from "../studyDesignIntentAssistance";
import { useStudyDesignWorkbench } from "../../hooks/useStudyDesignWorkbench";
import { StudyDesignWorkbench } from "../StudyDesignWorkbench";
import { IdentityStrip } from "./IdentityStrip";
import { PipelineRail, type PipelineStage, type PipelineStageState } from "./PipelineRail";
import { PicoCanvas } from "./stages/PicoCanvas";
import { PhenotypeMatrix } from "./stages/PhenotypeMatrix";
import { ConceptSetMatrix } from "./stages/ConceptSetMatrix";
import { CohortTriptych } from "./stages/CohortTriptych";
import { FeasibilityView } from "./stages/FeasibilityView";
import { AnalysisMatrix } from "./stages/AnalysisMatrix";
import { LockLaunchpad } from "./stages/LockLaunchpad";
import { PackageReceipt } from "./stages/PackageReceipt";
import { VersionTimeline } from "./peripheral/VersionTimeline";

// Phase 2 — CompilerWorkbench now owns its data.
//
// It calls `useStudyDesignWorkbench(study)` internally, derives the rail
// stages from `compilerGuidance`, and routes the center pane by
// `activeStageId`. The Intent station (01) renders the new `<PicoCanvas/>`;
// every other station renders the existing v1 `<StudyDesignWorkbench/>` as an
// honest "v2 stage not yet implemented" fallback until subsequent phases land.
//
// Phase 5: stations 07/08 land (LockLaunchpad + PackageReceipt) and a
// horizontal VersionTimeline strip renders between IdentityStrip and the
// active editor when the session has at least one version.
//
// TODO: Phase 3 — Upload-protocol icon wiring + session switcher menu
// TODO: Phase 3+ — Peripheral Rail tabs become live (Evidence / Lint / etc.)

interface CompilerWorkbenchProps {
  study: Study;
}

type PipelineStation = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08";

// The eight Pipeline Rail stations in the canonical vertical order. These
// don't always 1:1 match the compiler-guidance stage ids — see
// SOURCE_TO_STATION below. "Package" has no compiler-guidance counterpart
// yet; it stays gated/not-started until backend exposes it.
const RAIL_STATIONS: ReadonlyArray<{
  id: PipelineStation;
  number: string;
  name: string;
  /** Optional guidance source. `null` means "no upstream signal, always slate". */
  source: StudyCompilerStageId | null;
  isLock?: boolean;
}> = [
  { id: "01", number: "01", name: "Intent", source: "intent" },
  { id: "02", number: "02", name: "Phenotypes", source: "phenotypes" },
  { id: "03", number: "03", name: "Concept Sets", source: "concept_sets" },
  { id: "04", number: "04", name: "Cohorts", source: "cohorts" },
  { id: "05", number: "05", name: "Feasibility", source: "feasibility" },
  { id: "06", number: "06", name: "Analyses", source: "analysis" },
  { id: "07", number: "07", name: "Lock", source: "lock", isLock: true },
  { id: "08", number: "08", name: "Package", source: null },
];

// The six Peripheral Rail tabs from the spec — inert in Phase 2.
// TODO: Phase 3+ — tabs become live.
const PERIPHERAL_TABS = ["Evidence", "Lint", "Notes", "Sites", "Versions", "Abby"] as const;

// Map a compiler-guidance stage id to the corresponding rail station number.
const SOURCE_TO_STATION: Partial<Record<StudyCompilerStageId, PipelineStation>> = {
  intent: "01",
  phenotypes: "02",
  concept_sets: "03",
  cohorts: "04",
  feasibility: "05",
  analysis: "06",
  lock: "07",
};

// Map compiler-guidance status → rail-station state. Pure-data transform.
function statusToState(status: StudyCompilerStageStatus): PipelineStageState {
  if (status === "complete") return "validated";
  if (status === "active") return "review";
  if (status === "blocked") return "review";
  return "not-started";
}

function buildRailStages(
  guidance: StudyCompilerGuidance | null,
): { stages: ReadonlyArray<PipelineStage>; defaultActive: PipelineStation } {
  const guidanceById = new Map<StudyCompilerStageId, StudyCompilerStage>();
  if (guidance) {
    for (const stage of guidance.stages) {
      guidanceById.set(stage.id, stage);
    }
  }

  const stages: PipelineStage[] = RAIL_STATIONS.map((station) => {
    const guidanceStage = station.source ? guidanceById.get(station.source) ?? null : null;
    return buildStation(station, guidanceStage);
  });

  const currentStageId = guidance?.currentStage?.id;
  const defaultActive: PipelineStation =
    (currentStageId ? SOURCE_TO_STATION[currentStageId] : undefined) ?? "01";

  return { stages, defaultActive };
}

function buildStation(
  station: (typeof RAIL_STATIONS)[number],
  guidanceStage: StudyCompilerStage | null,
): PipelineStage {
  if (!guidanceStage) {
    return {
      id: station.id,
      number: station.number,
      name: station.name,
      state: "not-started",
      detail: "",
      lastTouched: "—",
      progressArc: 0,
      ...(station.isLock ? { isLock: true } : {}),
    };
  }

  const state = statusToState(guidanceStage.status);
  const progressArc = guidanceStage.status === "complete"
    ? 1
    : guidanceStage.status === "active"
      ? 0.55
      : guidanceStage.status === "blocked"
        ? 0.4
        : 0;

  const detail = truncate(guidanceStage.blocker ?? guidanceStage.detail ?? "", 64);

  return {
    id: station.id,
    number: station.number,
    name: station.name,
    state,
    detail,
    lastTouched: "—",
    progressArc,
    ...(station.isLock ? { isLock: true } : {}),
  };
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export function CompilerWorkbench({ study }: CompilerWorkbenchProps) {
  const wb = useStudyDesignWorkbench(study);

  const { stages, defaultActive } = useMemo(
    () => buildRailStages(wb.compilerGuidance ?? null),
    [wb.compilerGuidance],
  );

  // User-controlled active stage — overrides the default once the user clicks.
  const [activeStageId, setActiveStageId] = useState<PipelineStation>(defaultActive);

  // The initial form state + assistance the PicoCanvas needs. Mirrors the
  // existing v1 StudyDesignWorkbench → IntentReviewPanel data pass-through.
  const initialFormState = useMemo(
    () => (wb.selectedVersion ? specToForm(versionSpec(wb.selectedVersion)) : null),
    [wb.selectedVersion],
  );
  const assistance = useMemo(
    () =>
      wb.selectedVersion && initialFormState
        ? buildIntentReviewAssistance(wb.selectedVersion, initialFormState)
        : null,
    [wb.selectedVersion, initialFormState],
  );

  return (
    <div className="studies-v2-root">
      <IdentityStrip study={study} />

      {/* <768px banner — per Decision Q5; CSS toggles visibility. */}
      <div className="studies-v2-narrow-banner" role="note">
        {tAuto("studies.v2.bestViewedOnDesktop")}{" "}
        <a href="/studies">{tAuto("studies.v2.backToStudies")}</a>
      </div>

      <main className="studies-v2-workbench">
        <PipelineRail
          stages={stages}
          activeStageId={activeStageId}
          onSelectStage={(id) => setActiveStageId(id as PipelineStation)}
        />

        <section
          className="pane studies-v2-center"
          aria-label={tAuto("studies.v2.activeEditor")}
        >
          {wb.versions.length > 0 ? (
            <VersionTimeline
              versions={wb.versions}
              activeVersionId={wb.selectedVersion?.id ?? null}
              onSelectVersion={(id) => wb.guardedSetSelectedVersion(id)}
            />
          ) : null}

          {activeStageId === "01" ? (
            <PicoCanvas
              session={wb.selectedSession}
              version={wb.selectedVersion}
              assistance={assistance}
              initialFormState={initialFormState}
              onSave={wb.handleSaveReview}
              onAccept={wb.handleAccept}
              onGenerateIntent={(question) => {
                // Pass the question through directly; the hook syncs its own
                // state inside handleGenerate to avoid the stale-closure bug
                // that would have fired if we called setResearchQuestion +
                // handleGenerate in the same tick.
                void wb.handleGenerate(question);
              }}
              onDirtyChange={wb.setIntentReviewDirty}
              isSaving={wb.updateVersion.isPending}
              isAccepting={wb.acceptVersion.isPending}
              isGenerating={wb.generateIntent.isPending}
              generationGate={wb.intentGenerationGate}
            />
          ) : activeStageId === "02" ? (
            <PhenotypeMatrix workbench={wb} />
          ) : activeStageId === "03" ? (
            <ConceptSetMatrix workbench={wb} />
          ) : activeStageId === "04" ? (
            <CohortTriptych workbench={wb} />
          ) : activeStageId === "05" ? (
            <FeasibilityView workbench={wb} />
          ) : activeStageId === "06" ? (
            <AnalysisMatrix workbench={wb} />
          ) : activeStageId === "07" ? (
            <LockLaunchpad
              workbench={wb}
              studyTitle={study.short_title?.trim() || study.title}
              onNavigateStation={(id) => setActiveStageId(id)}
            />
          ) : activeStageId === "08" ? (
            <PackageReceipt
              workbench={wb}
              onNavigateStation={(id) => setActiveStageId(id)}
            />
          ) : (
            <div className="phase2-fallback">
              <div className="phase2-fallback-eyebrow wb-mono">
                {tAuto("studies.v2.fallbackEyebrow")}
              </div>
              <StudyDesignWorkbench study={study} />
            </div>
          )}
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
              coming in Phase 3
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
