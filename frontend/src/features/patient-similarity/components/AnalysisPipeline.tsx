import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { StepDefinition, StepStatus, StepResult } from '../types/pipeline';
import {
  getPipelineStepDescription,
  getPipelineStepName,
} from '../lib/i18n';
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
  const { t } = useTranslation("app");

  return (
    <div className="px-5 py-4">
      {steps.map((step) => {
        const status = getStepStatus(step.id);
        const result = getStepResult(step.id);
        const isExpanded = expandedSteps.has(step.id);

        return (
          <PipelineStep
            key={step.id}
            stepNumber={step.stepNumber}
            name={getPipelineStepName(t, step.copyKey)}
            description={getPipelineStepDescription(t, step.copyKey)}
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
