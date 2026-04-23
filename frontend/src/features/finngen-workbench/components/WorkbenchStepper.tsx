// frontend/src/features/finngen-workbench/components/WorkbenchStepper.tsx
import {
  ArrowRight,
  Check,
  ChevronRight,
  GitMerge,
  Magnet,
  Save,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { WORKBENCH_STEPS, type WorkbenchStepKey } from "../lib/workbenchSteps";

interface WorkbenchStepperProps {
  current: WorkbenchStepKey;
  completed: Set<WorkbenchStepKey>;
  onStepChange: (step: WorkbenchStepKey) => void;
}

const STEP_ICONS: Record<WorkbenchStepKey, LucideIcon> = {
  "import-cohorts": Upload,
  operate: GitMerge,
  match: Magnet,
  materialize: Save,
  handoff: ArrowRight,
};

export function WorkbenchStepper({ current, completed, onStepChange }: WorkbenchStepperProps) {
  return (
    <ol className="flex flex-wrap items-center gap-1 rounded-lg border border-border-default bg-surface-raised p-1.5">
      {WORKBENCH_STEPS.map((step, idx) => {
        const isCurrent = step.key === current;
        const isDone = completed.has(step.key);
        const Icon = STEP_ICONS[step.key];
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
                {isDone ? <Check size={10} /> : <Icon size={10} />}
              </span>
              <span>{step.label}</span>
            </button>
            {idx < WORKBENCH_STEPS.length - 1 && (
              <ChevronRight size={12} className="mx-0.5 text-text-ghost" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
