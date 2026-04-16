// frontend/src/features/finngen-workbench/components/WorkbenchStepper.tsx
import { Check, ChevronRight } from "lucide-react";

export type WorkbenchStepKey =
  | "select-source"
  | "import-cohorts"
  | "operate"
  | "match"
  | "materialize"
  | "handoff";

export const WORKBENCH_STEPS: { key: WorkbenchStepKey; label: string }[] = [
  { key: "select-source", label: "Select source" },
  { key: "import-cohorts", label: "Import cohorts" },
  { key: "operate", label: "Operate" },
  { key: "match", label: "Match" },
  { key: "materialize", label: "Materialize" },
  { key: "handoff", label: "Handoff" },
];

interface WorkbenchStepperProps {
  current: WorkbenchStepKey;
  completed: Set<WorkbenchStepKey>;
  onStepChange: (step: WorkbenchStepKey) => void;
}

export function WorkbenchStepper({ current, completed, onStepChange }: WorkbenchStepperProps) {
  return (
    <ol className="flex flex-wrap items-center gap-1 rounded-lg border border-border-default bg-surface-raised p-1.5">
      {WORKBENCH_STEPS.map((step, idx) => {
        const isCurrent = step.key === current;
        const isDone = completed.has(step.key);
        return (
          <li key={step.key} className="flex items-center">
            <button
              type="button"
              onClick={() => onStepChange(step.key)}
              className={[
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
                isCurrent
                  ? "bg-success text-bg-canvas"
                  : isDone
                  ? "text-success hover:bg-success/10"
                  : "text-text-ghost hover:bg-surface-overlay",
              ].join(" ")}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">
                {isDone ? <Check size={10} /> : idx + 1}
              </span>
              <span>{step.label}</span>
            </button>
            {idx < WORKBENCH_STEPS.length - 1 && (
              <ChevronRight size={12} className="text-text-ghost mx-0.5" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
