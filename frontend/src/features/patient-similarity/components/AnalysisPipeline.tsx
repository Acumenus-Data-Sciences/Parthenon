import type { ReactNode } from 'react';
import type { StepDefinition, StepStatus, StepResult } from '../types/pipeline';
import { PipelineStep } from './PipelineStep';

/** Steps that have a working implementation behind handleRunStep */
const RUNNABLE_STEPS = new Set(['profile', 'balance', 'psm', 'landscape', 'centroid', 'similar']);

interface AnalysisPipelineProps {
  steps: StepDefinition[];
  expandedSteps: Set<string>;
  getStepStatus: (stepId: string) => StepStatus;
  getStepResult: (stepId: string) => StepResult | undefined;
  onToggleStep: (stepId: string) => void;
  onRunStep: (stepId: string) => void;
  renderStepContent: (stepId: string) => ReactNode;
}

export function AnalysisPipeline({
  steps,
  expandedSteps,
  getStepStatus,
  getStepResult,
  onToggleStep,
  onRunStep,
  renderStepContent,
}: AnalysisPipelineProps) {
  return (
    <div className="space-y-0">
      {steps.map((step) => {
        const status = getStepStatus(step.id);
        const result = getStepResult(step.id);
        const isExpanded = expandedSteps.has(step.id);

        return (
          <PipelineStep
            key={step.id}
            stepNumber={step.stepNumber}
            name={step.name}
            description={step.description}
            status={status}
            isExpanded={isExpanded}
            summary={result?.summary}
            executionTimeMs={result?.executionTimeMs}
            onToggle={() => onToggleStep(step.id)}
            onRun={status === 'future' && RUNNABLE_STEPS.has(step.id) ? () => onRunStep(step.id) : undefined}
          >
            {renderStepContent(step.id)}
          </PipelineStep>
        );
      })}
    </div>
  );
}
