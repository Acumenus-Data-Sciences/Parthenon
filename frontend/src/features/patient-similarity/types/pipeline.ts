export type PipelineMode = 'compare' | 'expand';

export type StepStatus = 'future' | 'loading' | 'completed' | 'error';

export type PipelineStepCopyKey =
  | 'profileComparison'
  | 'covariateBalance'
  | 'propensityScoreMatching'
  | 'umapLandscape'
  | 'phenotypeDiscovery'
  | 'networkFusion'
  | 'centroidProfile'
  | 'similarPatients';

export interface StepResult {
  data: unknown;
  summary: string;
  executionTimeMs: number;
  completedAt: Date;
}

export interface StepDefinition {
  id: string;
  copyKey: PipelineStepCopyKey;
  autoTrigger: boolean;
  /** Step number displayed in the UI */
  stepNumber: number;
}

export const COMPARE_STEPS: StepDefinition[] = [
  { id: 'profile', copyKey: 'profileComparison', autoTrigger: true, stepNumber: 1 },
  { id: 'balance', copyKey: 'covariateBalance', autoTrigger: true, stepNumber: 2 },
  { id: 'psm', copyKey: 'propensityScoreMatching', autoTrigger: false, stepNumber: 3 },
  { id: 'landscape', copyKey: 'umapLandscape', autoTrigger: false, stepNumber: 4 },
  { id: 'phenotypes', copyKey: 'phenotypeDiscovery', autoTrigger: false, stepNumber: 5 },
  { id: 'snf', copyKey: 'networkFusion', autoTrigger: false, stepNumber: 6 },
];

export const EXPAND_STEPS: StepDefinition[] = [
  { id: 'centroid', copyKey: 'centroidProfile', autoTrigger: true, stepNumber: 1 },
  { id: 'similar', copyKey: 'similarPatients', autoTrigger: true, stepNumber: 2 },
  { id: 'landscape', copyKey: 'umapLandscape', autoTrigger: false, stepNumber: 3 },
  { id: 'phenotypes', copyKey: 'phenotypeDiscovery', autoTrigger: false, stepNumber: 4 },
];

export interface PipelineState {
  mode: PipelineMode;
  expandedSteps: Set<string>;
  completedSteps: Map<string, StepResult>;
  stepStatuses: Map<string, StepStatus>;
}

export interface PipelineActions {
  setMode: (mode: PipelineMode) => void;
  toggleStep: (stepId: string) => void;
  expandStep: (stepId: string) => void;
  collapseStep: (stepId: string) => void;
  markCompleted: (stepId: string, result: StepResult) => void;
  markLoading: (stepId: string) => void;
  markError: (stepId: string) => void;
  resetPipeline: () => void;
  getStepStatus: (stepId: string) => StepStatus;
  getStepResult: (stepId: string) => StepResult | undefined;
}
