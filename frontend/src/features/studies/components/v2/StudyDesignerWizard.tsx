import { useMemo, useState } from "react";
import { tAuto } from "@/i18n/autoUserFacing";
import { useFlag } from "@/stores/featureFlagsStore";
import type { Study } from "../../types/study";
import { useStudyDesignWorkbench } from "../../hooks/useStudyDesignWorkbench";
import { useStudyDesignerWizardStore } from "../../stores/studyDesignerWizardStore";

import { BottomUpCompatibilityPanel } from "../workbench/BottomUpCompatibilityPanel";
import { ProtocolImportProgress } from "../ProtocolImportProgress";
import {
  specToForm,
  versionSpec,
} from "../workbench/studyDesignWorkbenchHelpers";
import { buildIntentReviewAssistance } from "../studyDesignIntentAssistance";

import { PicoCanvas } from "./stages/PicoCanvas";
import { PhenotypeMatrix } from "./stages/PhenotypeMatrix";
import { ConceptSetMatrix } from "./stages/ConceptSetMatrix";
import { CohortTriptych } from "./stages/CohortTriptych";
import { FeasibilityView } from "./stages/FeasibilityView";
import { AnalysisMatrix } from "./stages/AnalysisMatrix";
import { LockLaunchpad } from "./stages/LockLaunchpad";
import { PackageReceipt } from "./stages/PackageReceipt";

import {
  StudyDesignerStepper,
  type StepperStep,
} from "./StudyDesignerStepper";
import { WizardFooter } from "./WizardFooter";
import { AgentCopilotPanel } from "./agent/AgentCopilotPanel";
import {
  canProceed,
  computeInitialStep,
  isReachable,
  stepState,
  STEP_LABEL_KEYS,
  TOTAL_STEPS,
} from "./wizardValidation";

// Inline Study Designer Wizard — replaces CompilerWorkbench's rail/strip/
// peripheral chrome with an 8-step stepper, slide-animated step container,
// and a single footer. Mirrors the cohort-definitions CohortWizardModal
// pattern (StepIndicator + slide transitions + Back/Next footer) while
// preserving every v2 advancement (compiler-guidance-driven state, per-asset
// verification with partial/acknowledged warnings, hybrid free-navigation).
//
// Commit 1 lands this file unwired — CompilerWorkbench still ships the
// legacy rail. Commit 2 swaps CompilerWorkbench's body to mount this.

interface StudyDesignerWizardProps {
  study: Study;
}

// LockLaunchpad / PackageReceipt callbacks still emit "01".."08" station
// strings from the legacy v2 pipeline. Map them back to wizard step indices.
function stationIdToStep(stationId: string): number | null {
  const idx = Number.parseInt(stationId, 10);
  if (!Number.isInteger(idx) || idx < 1 || idx > TOTAL_STEPS) return null;
  return idx - 1;
}

// Compute which steps have any asset with verification_status === "partial".
// Surface as the warning-colored circle in the stepper. Asset types map 1:1
// to wizard steps where applicable; unknown types are skipped.
function computePartialSteps(
  assets: ReadonlyArray<{
    asset_type?: string;
    verification_status?: string | null;
  }>,
): ReadonlySet<number> {
  const ASSET_TYPE_TO_STEP: Record<string, number> = {
    intent: 0,
    phenotype: 1,
    concept_set: 2,
    cohort: 3,
    analysis: 5,
  };
  const partial = new Set<number>();
  for (const asset of assets) {
    if (asset.verification_status !== "partial") continue;
    if (!asset.asset_type) continue;
    const step = ASSET_TYPE_TO_STEP[asset.asset_type];
    if (step !== undefined) partial.add(step);
  }
  return partial;
}

export function StudyDesignerWizard({ study }: StudyDesignerWizardProps) {
  const wb = useStudyDesignWorkbench(study);
  const { currentStep, slideDir, visited, setStep, goNext, goBack } =
    useStudyDesignerWizardStore();
  const [animKey, setAnimKey] = useState(0);
  const agentsEnabled = useFlag("ai.agents");

  // One-shot auto-jump to the user's last-active stage on first guidance
  // arrival — mirrors v1's `useState(defaultActive)` resume behavior. Uses
  // the "adjust state during render" pattern (React docs) so it doesn't
  // trigger cascading-renders lint warnings. Guarded by `initialized` so we
  // only do this once; after that the user's clicks are authoritative.
  const [initialized, setInitialized] = useState(false);
  if (!initialized && wb.compilerGuidance) {
    const targetStep = computeInitialStep(wb.compilerGuidance);
    setInitialized(true);
    if (targetStep !== 0 && currentStep === 0) {
      setStep(targetStep);
    }
  }

  const partialSteps = useMemo(
    () => computePartialSteps(wb.assets ?? []),
    [wb.assets],
  );

  const stepperSteps: ReadonlyArray<StepperStep> = useMemo(() => {
    const guidance = wb.compilerGuidance ?? null;
    return Array.from({ length: TOTAL_STEPS }, (_, i) => ({
      key: `step-${i}`,
      label: tAuto(STEP_LABEL_KEYS[i]),
      state: stepState(guidance, i, partialSteps),
      reachable: isReachable(guidance, i, visited),
    }));
  }, [wb.compilerGuidance, partialSteps, visited]);

  const proceedable = canProceed(wb.compilerGuidance ?? null, currentStep);

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

  const versionLabel = wb.selectedVersion
    ? `v${wb.selectedVersion.version_number} · ${wb.selectedVersion.status}`
    : null;

  function navigateToStep(step: number) {
    if (step === currentStep) return;
    setAnimKey((k) => k + 1);
    setStep(step);
  }
  function handleNext() {
    setAnimKey((k) => k + 1);
    goNext();
  }
  function handleBack() {
    setAnimKey((k) => k + 1);
    goBack();
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="studies-v2-wizard flex flex-col flex-1 min-w-0 h-full">
        <style>{`
          @keyframes wizardSlideFromRight {
            from { opacity: 0; transform: translateX(18px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes wizardSlideFromLeft {
            from { opacity: 0; transform: translateX(-18px); }
            to   { opacity: 1; transform: translateX(0); }
          }
        `}</style>

        <ProtocolImportProgress
          phase={wb.protocolImportPhase}
          elapsedSeconds={wb.protocolElapsedSeconds}
          fileName={wb.protocolFileName}
          className="px-8 pt-4"
        />

        <StudyDesignerStepper
          steps={stepperSteps}
          currentStep={currentStep}
          onStepClick={navigateToStep}
        />

        <main
          className="flex-1 min-h-0 overflow-y-auto px-8 py-4"
          aria-label={tAuto("studies.v2.activeEditor")}
        >
          <div
            key={animKey}
            style={{
              animation: `${slideDir === "forward" ? "wizardSlideFromRight" : "wizardSlideFromLeft"} 220ms ease forwards`,
            }}
          >
            {currentStep === 0 ? (
              <>
                <PicoCanvas
                  session={wb.selectedSession}
                  version={wb.selectedVersion}
                  assistance={assistance}
                  initialFormState={initialFormState}
                  onSave={wb.handleSaveReview}
                  onAccept={wb.handleAccept}
                  onGenerateIntent={(question) => {
                    void wb.handleGenerate(question);
                  }}
                  onDirtyChange={wb.setIntentReviewDirty}
                  isSaving={wb.updateVersion.isPending}
                  isAccepting={wb.acceptVersion.isPending}
                  isGenerating={wb.generateIntent.isPending}
                  generationGate={wb.intentGenerationGate}
                />
                {wb.selectedVersion ? (
                  <BottomUpCompatibilityPanel
                    assets={wb.assets}
                    isImporting={wb.importExistingStudy.isPending}
                    isCritiquing={wb.critiqueStudyDesign.isPending}
                    canCritique={wb.selectedVersion.status !== "locked"}
                    onImport={wb.handleImportExistingStudy}
                    onCritique={wb.handleCritiqueStudyDesign}
                  />
                ) : null}
              </>
            ) : currentStep === 1 ? (
              <PhenotypeMatrix workbench={wb} />
            ) : currentStep === 2 ? (
              <ConceptSetMatrix workbench={wb} />
            ) : currentStep === 3 ? (
              <CohortTriptych workbench={wb} />
            ) : currentStep === 4 ? (
              <FeasibilityView workbench={wb} />
            ) : currentStep === 5 ? (
              <AnalysisMatrix workbench={wb} />
            ) : currentStep === 6 ? (
              <LockLaunchpad
                workbench={wb}
                studyTitle={study.short_title?.trim() || study.title}
                onNavigateStation={(id) => {
                  const step = stationIdToStep(id);
                  if (step !== null) navigateToStep(step);
                }}
              />
            ) : currentStep === 7 ? (
              <PackageReceipt
                workbench={wb}
                onNavigateStation={(id) => {
                  const step = stationIdToStep(id);
                  if (step !== null) navigateToStep(step);
                }}
              />
            ) : null}
          </div>
        </main>

        <WizardFooter
          currentStep={currentStep}
          totalSteps={TOTAL_STEPS}
          canProceed={proceedable}
          onBack={handleBack}
          onNext={handleNext}
          protocolInputRef={wb.protocolInputRef}
          onProtocolUpload={wb.handleProtocolUpload}
          protocolBusy={wb.protocolBusy}
          versionLabel={versionLabel}
          versions={wb.versions}
          activeVersionId={wb.selectedVersion?.id ?? null}
          onSelectVersion={wb.guardedSetSelectedVersion}
        />
      </div>

      {agentsEnabled && (
        <AgentCopilotPanel
          slug={wb.slug}
          sessionId={wb.selectedSession?.id ?? null}
          versionId={wb.selectedVersion?.id ?? null}
        />
      )}
    </div>
  );
}

