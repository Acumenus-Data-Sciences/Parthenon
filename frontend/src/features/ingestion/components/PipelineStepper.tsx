import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IngestionStep, ExecutionStatus } from "@/types/ingestion";

const STEPS: { key: IngestionStep; label: string }[] = [
  { key: "profiling", label: "Profiling" },
  { key: "schema_mapping", label: "Schema Mapping" },
  { key: "concept_mapping", label: "Concept Mapping" },
  { key: "review", label: "Review" },
  { key: "cdm_writing", label: "CDM Writing" },
  { key: "validation", label: "Validation" },
];

interface PipelineStepperProps {
  currentStep: IngestionStep | null;
  status: ExecutionStatus;
}

export function PipelineStepper({ currentStep, status }: PipelineStepperProps) {
  const currentIndex = currentStep
    ? STEPS.findIndex((s) => s.key === currentStep)
    : -1;

  function getStepState(index: number) {
    if (status === "failed" && index === currentIndex) return "failed";
    if (index < currentIndex) return "completed";
    if (index === currentIndex) {
      if (status === "completed") return "completed";
      return "active";
    }
    return "pending";
  }

  return (
    <div className="flex items-center justify-between w-full px-4 py-6">
      {STEPS.map((step, index) => {
        const state = getStepState(index);
        const isLast = index === STEPS.length - 1;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-all shrink-0",
                  state === "completed" &&
                    "bg-success text-surface-base",
                  state === "active" &&
                    "bg-primary text-text-primary animate-pulse",
                  state === "pending" &&
                    "border-2 border-surface-highlight text-text-ghost bg-transparent",
                  state === "failed" &&
                    "bg-critical text-text-primary",
                )}
              >
                {state === "completed" ? (
                  <Check size={16} strokeWidth={3} />
                ) : state === "failed" ? (
                  <X size={16} strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  state === "completed" && "text-success",
                  state === "active" && "text-text-primary",
                  state === "pending" && "text-text-ghost",
                  state === "failed" && "text-critical",
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="flex-1 mx-3 mt-[-1.25rem]">
                <div
                  className={cn(
                    "h-[2px] w-full rounded-full",
                    index < currentIndex
                      ? "bg-success"
                      : "bg-surface-highlight",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
