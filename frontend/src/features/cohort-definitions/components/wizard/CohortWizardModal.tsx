import { useState } from "react";
import { Check, X, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { BasicsChapter } from "./BasicsChapter";
import { SpecializedChapter } from "./SpecializedChapter";
import { PopulationStep } from "./steps/PopulationStep";
import { CriteriaStep } from "./steps/CriteriaStep";
import { FollowUpStep } from "./steps/FollowUpStep";
import { ReviewGenerateStep } from "./steps/ReviewGenerateStep";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

const STEPS = [
  { key: "basics", label: "Basics" },
  { key: "population", label: "Population" },
  { key: "criteria", label: "Criteria" },
  { key: "followup", label: "Follow-up" },
  { key: "specialized", label: "Specialized" },
  { key: "review", label: "Review" },
] as const;

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between pl-8 pr-14 pt-6 pb-2">
      {STEPS.map((s, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const isPending = index > currentStep;
        const isLast = index === STEPS.length - 1;

        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all shrink-0",
                  isCompleted && "bg-[#C9A227] text-[#0E0E11]",
                  isActive && "border-2 border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]",
                  isPending && "border-2 border-[#323238] text-[#5A5650] bg-transparent",
                )}
              >
                {isCompleted ? <Check size={14} strokeWidth={3} /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isCompleted && "text-[#C9A227]",
                  isActive && "text-[#F0EDE8]",
                  isPending && "text-[#5A5650]",
                )}
              >
                {s.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 mx-2 mb-5">
                <div className={cn("h-[2px] w-full rounded-full", isCompleted ? "bg-[#C9A227]" : "bg-[#323238]")} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CohortWizardModal({ onClose }: Props) {
  const { currentStep, slideDir, goNext, goBack, canProceed, reset } =
    useCohortWizardStore();
  const [animKey, setAnimKey] = useState(0);

  function handleClose() {
    reset();
    onClose();
  }

  function handleNext() {
    setAnimKey((k) => k + 1);
    goNext();
  }

  function handleBack() {
    setAnimKey((k) => k + 1);
    goBack();
  }

  // ── Step content ──────────────────────────────────────────────────────────

  const stepContent: Record<number, React.ReactNode> = {
    0: <BasicsChapter />,
    1: <PopulationStep />,
    2: <CriteriaStep />,
    3: <FollowUpStep />,
    4: <SpecializedChapter />,
    5: <ReviewGenerateStep onClose={handleClose} />,
  };

  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <>
      <style>{`
        @keyframes cohortWizardSlideFromRight {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes cohortWizardSlideFromLeft {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E0E11]/90 backdrop-blur-sm">
        <div className="relative mx-4 flex w-full max-w-3xl flex-col rounded-2xl border border-[#232328] bg-[#151518] shadow-2xl max-h-[90vh]">

          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-[#5A5650] hover:text-[#8A857D] transition-colors"
          >
            <X size={18} />
          </button>

          <StepIndicator currentStep={currentStep} />

          <div className="flex-1 overflow-y-auto px-8 py-4">
            <div
              key={animKey}
              style={{
                animation: `${slideDir === "forward" ? "cohortWizardSlideFromRight" : "cohortWizardSlideFromLeft"} 220ms ease forwards`,
              }}
            >
              {stepContent[currentStep]}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#232328] px-8 py-4">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                currentStep === 0
                  ? "cursor-not-allowed text-[#323238]"
                  : "text-[#8A857D] hover:text-[#C5C0B8]",
              )}
            >
              <ArrowLeft size={14} />
              Back
            </button>

            {!isLastStep && (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed()}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  canProceed()
                    ? "bg-[#C9A227] text-[#0E0E11] hover:bg-[#D4AF37]"
                    : "cursor-not-allowed bg-[#232328] text-[#5A5650]",
                )}
              >
                Next
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
