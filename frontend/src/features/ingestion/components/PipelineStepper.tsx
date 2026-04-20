import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IngestionStep, ExecutionStatus } from "@/types/ingestion";

const STEPS: { key: IngestionStep; labelKey: string }[] = [
  { key: "profiling", labelKey: "ingestion.pipeline.profiling" },
  { key: "schema_mapping", labelKey: "ingestion.pipeline.schemaMapping" },
  { key: "concept_mapping", labelKey: "ingestion.pipeline.conceptMapping" },
  { key: "review", labelKey: "ingestion.pipeline.review" },
  { key: "cdm_writing", labelKey: "ingestion.pipeline.cdmWriting" },
  { key: "validation", labelKey: "ingestion.pipeline.validation" },
];

interface PipelineStepperProps {
  currentStep: IngestionStep | null;
  status: ExecutionStatus;
}

export function PipelineStepper({ currentStep, status }: PipelineStepperProps) {
  const { t } = useTranslation("app");
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
                    "bg-primary text-primary-foreground animate-pulse",
                  state === "pending" &&
                    "border-2 border-surface-highlight text-text-ghost bg-transparent",
                  state === "failed" &&
                    "bg-critical text-white",
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
                {t(step.labelKey)}
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
