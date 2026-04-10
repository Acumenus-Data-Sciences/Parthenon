export type PipelineMode = 'compare' | 'expand';

export type StepStatus = 'future' | 'loading' | 'completed' | 'error';

export interface StepResult {
  data: unknown;
  summary: string;
  executionTimeMs: number;
  completedAt: Date;
}

export interface StepDefinition {
  id: string;
  name: string;
  description: string;
  autoTrigger: boolean;
  /** Step number displayed in the UI */
  stepNumber: number;
}

export const COMPARE_STEPS: StepDefinition[] = [
  { id: 'profile', name: 'Profile Comparison', description: 'Divergence radar across 6 clinical dimensions', autoTrigger: true, stepNumber: 1 },
  { id: 'balance', name: 'Covariate Balance', description: 'SMD analysis with Love plot', autoTrigger: true, stepNumber: 2 },
  { id: 'psm', name: 'Propensity Score Matching', description: 'Create balanced comparison groups', autoTrigger: false, stepNumber: 3 },
  { id: 'landscape', name: 'UMAP Landscape', description: 'Project both cohorts into 2D/3D patient space', autoTrigger: false, stepNumber: 4 },
  { id: 'phenotypes', name: 'Phenotype Discovery', description: 'Find latent subgroups via consensus clustering', autoTrigger: false, stepNumber: 5 },
  { id: 'snf', name: 'Network Fusion', description: 'Multi-modal SNF with community detection', autoTrigger: false, stepNumber: 6 },
];

export const EXPAND_STEPS: StepDefinition[] = [
  { id: 'centroid', name: 'Centroid Profile', description: 'Cohort centroid radar with dimension coverage', autoTrigger: true, stepNumber: 1 },
  { id: 'similar', name: 'Similar Patients', description: 'Find patients matching cohort profile', autoTrigger: true, stepNumber: 2 },
  { id: 'landscape', name: 'UMAP Landscape', description: 'Project seed cohort and similar patients', autoTrigger: false, stepNumber: 3 },
  { id: 'phenotypes', name: 'Phenotype Discovery', description: 'Discover subgroups in combined population', autoTrigger: false, stepNumber: 4 },
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
