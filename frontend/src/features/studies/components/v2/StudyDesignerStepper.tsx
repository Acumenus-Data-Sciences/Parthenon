import type { KeyboardEvent } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { tAuto } from "@/i18n/autoUserFacing";
import type { WizardStepState } from "./wizardValidation";

// Gold-standard match — mirrors CohortWizardModal's StepIndicator
// (frontend/src/features/cohort-definitions/components/wizard/CohortWizardModal.tsx:32-77).
// Same Tailwind tokens, same circle states, same connector pattern.
//
// Differences from the cohort wizard's indicator:
//   • 8 nodes instead of 6 (study-design has more stages)
//   • Adds `partial` state (warning-colored circle) for the v2 acknowledge-
//     warnings affordance — assets with verification_status === "partial"
//   • Adds `blocked` state (error-colored circle) for compiler-guidance
//     blocked stages
//   • Each circle is a real <button> (not a div) so keyboard nav works for
//     hybrid free-click navigation

export interface StepperStep {
  /** Stable key for React reconciliation. */
  key: string;
  /** Localized label shown beneath the circle. */
  label: string;
  /** Display state — drives circle + label coloring. */
  state: WizardStepState;
  /** Whether the user can click this step (hybrid free-nav rules). */
  reachable: boolean;
}

interface StudyDesignerStepperProps {
  steps: ReadonlyArray<StepperStep>;
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function StudyDesignerStepper({
  steps,
  currentStep,
  onStepClick,
}: StudyDesignerStepperProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      for (let i = index + 1; i < steps.length; i++) {
        if (steps[i].reachable) {
          onStepClick(i);
          return;
        }
      }
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      for (let i = index - 1; i >= 0; i--) {
        if (steps[i].reachable) {
          onStepClick(i);
          return;
        }
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (steps[index].reachable) onStepClick(index);
    }
  }

  return (
    <nav
      className="flex items-center justify-between pl-8 pr-14 pt-6 pb-2"
      role="tablist"
      aria-label={tAuto("studies.v2.wizard.stepperAria")}
    >
      {steps.map((step, index) => {
        const isCompleted = step.state === "complete";
        const isActive = index === currentStep;
        const isPartial = step.state === "partial";
        const isBlocked = step.state === "blocked" && !isActive;
        const isPending =
          step.state === "pending" && !isActive && !isPartial && !isBlocked;
        const isLast = index === steps.length - 1;

        const ariaLabel = `${tAuto("studies.v2.wizard.stepNumberAria", { n: index + 1 })} ${step.label} (${step.state})`;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? "step" : undefined}
                aria-disabled={!step.reachable}
                aria-label={ariaLabel}
                onClick={() => {
                  if (step.reachable) onStepClick(index);
                }}
                onKeyDown={(event) => handleKeyDown(event, index)}
                disabled={!step.reachable}
                tabIndex={isActive ? 0 : -1}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all shrink-0",
                  isCompleted && "bg-accent text-surface-base",
                  isActive &&
                    !isPartial &&
                    !isBlocked &&
                    !isCompleted &&
                    "border-2 border-accent bg-accent/10 text-accent",
                  isPartial &&
                    "border-2 border-warning bg-warning/10 text-warning",
                  isBlocked &&
                    "border-2 border-error bg-error/10 text-error",
                  isPending &&
                    "border-2 border-surface-highlight text-text-ghost bg-transparent",
                  !step.reachable && "cursor-not-allowed",
                  step.reachable && !isActive && "cursor-pointer hover:opacity-80",
                )}
              >
                {isCompleted ? (
                  <Check size={14} strokeWidth={3} />
                ) : isPartial ? (
                  <AlertTriangle size={12} />
                ) : (
                  index + 1
                )}
              </button>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isCompleted && "text-accent",
                  isActive && !isPartial && !isBlocked && "text-text-primary",
                  isPartial && "text-warning",
                  isBlocked && "text-error",
                  isPending && "text-text-ghost",
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast ? (
              <div className="flex-1 mx-2 mb-5">
                <div
                  className={cn(
                    "h-[2px] w-full rounded-full",
                    isCompleted
                      ? "bg-accent"
                      : isPartial
                        ? "bg-warning/40"
                        : "bg-surface-highlight",
                  )}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
