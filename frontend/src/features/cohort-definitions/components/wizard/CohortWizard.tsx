import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { WizardSidebar } from "./WizardSidebar";
import { BasicsChapter } from "./BasicsChapter";
import { EntryEventsStep } from "./EntryEventsStep";
import { ObservationWindowStep } from "./ObservationWindowStep";
import { QualifyingEventsStep } from "./QualifyingEventsStep";
import { InclusionRulesStep } from "./InclusionRulesStep";
import { DemographicsStep } from "./DemographicsStep";
import { RiskScoresStep } from "./RiskScoresStep";
import { EndStrategyStep } from "./EndStrategyStep";
import { CensoringStep } from "./CensoringStep";
import { SpecializedChapter } from "./SpecializedChapter";
import { ReviewStep } from "./ReviewStep";
import { GenerateStep } from "./GenerateStep";
import { HandoffStep } from "./HandoffStep";

const CHAPTER_TITLES: Record<number, { title: string; subtitle: string }> = {
  1: { title: "Basics", subtitle: "What are you studying?" },
  2: { title: "Define Population", subtitle: "Who enters the cohort?" },
  3: { title: "Refine & Filter", subtitle: "What else must be true?" },
  4: { title: "Follow-up & Exit", subtitle: "How long are they followed?" },
  5: { title: "Specialized Criteria", subtitle: "Any molecular or imaging criteria?" },
  6: { title: "Review & Generate", subtitle: "Does this look right?" },
};

function ActiveStep() {
  const { currentChapter, currentStep } = useCohortWizardStore();

  // Chapter 1
  if (currentChapter === 1) return <BasicsChapter />;

  // Chapter 2
  if (currentChapter === 2) {
    if (currentStep === 1) return <EntryEventsStep />;
    if (currentStep === 2) return <ObservationWindowStep />;
    if (currentStep === 3) return <QualifyingEventsStep />;
  }

  // Chapter 3
  if (currentChapter === 3) {
    if (currentStep === 1) return <InclusionRulesStep />;
    if (currentStep === 2) return <DemographicsStep />;
    if (currentStep === 3) return <RiskScoresStep />;
  }

  // Chapter 4
  if (currentChapter === 4) {
    if (currentStep === 1) return <EndStrategyStep />;
    if (currentStep === 2) return <CensoringStep />;
  }

  // Chapter 5
  if (currentChapter === 5) return <SpecializedChapter />;

  // Chapter 6
  if (currentChapter === 6) {
    if (currentStep === 1) return <ReviewStep />;
    if (currentStep === 2) return <GenerateStep />;
    if (currentStep === 3) return <HandoffStep />;
  }

  return null;
}

export function CohortWizard() {
  const { currentChapter, goNext, goBack } = useCohortWizardStore();
  const header = CHAPTER_TITLES[currentChapter];
  const isFirstStep = currentChapter === 1;
  const isLastStep = currentChapter === 6;

  return (
    <div className="flex gap-6 p-6">
      <WizardSidebar />
      <div className="min-w-0 flex-1 rounded-xl border border-[#2a2a3a] bg-[#12121a] p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="m-0 text-[#C9A227]">
              Chapter {currentChapter}: {header?.title}
            </h3>
            <p className="mt-1 text-[13px] text-[#666]">{header?.subtitle}</p>
          </div>
          <div className="flex gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1 rounded-md border border-[#333] px-3.5 py-1.5 text-[12px] text-[#888] transition-colors hover:border-[#555] hover:text-[#ccc]"
              >
                <ArrowLeft size={14} />
                Back
              </button>
            )}
            {!isLastStep && (
              <button
                type="button"
                onClick={goNext}
                className="flex items-center gap-1 rounded-md bg-[#C9A227] px-3.5 py-1.5 text-[12px] font-semibold text-[#0E0E11] transition-colors hover:bg-[#B8922A]"
              >
                Next
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
        <ActiveStep />
      </div>
    </div>
  );
}
