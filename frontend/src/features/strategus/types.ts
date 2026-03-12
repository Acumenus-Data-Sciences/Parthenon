// ---------------------------------------------------------------------------
// Strategus Study Package — Type Definitions
// ---------------------------------------------------------------------------

export interface StrategusModule {
  name: string;
  package: string;
  version: string;
  available: boolean;
}

export interface ModuleSpec {
  module: string;
  settings: Record<string, unknown>;
}

export interface SharedCohortDefinition {
  cohortId: number;
  cohortName: string;
  json: object;
  sql: string;
}

export interface NegativeControlOutcome {
  outcomeId: number;
  outcomeName: string;
}

export interface SharedResource {
  cohortDefinitions?: SharedCohortDefinition[];
  negativeControlOutcomes?: NegativeControlOutcome[];
}

export interface AnalysisSpecification {
  sharedResources: SharedResource;
  moduleSpecifications: ModuleSpec[];
}

export interface ValidationIssue {
  module: string;
  message: string;
  severity: string;
}

export interface ValidationWarning {
  module: string;
  message: string;
}

export interface StrategusValidation {
  validation: "passed" | "failed";
  issues: ValidationIssue[];
  warnings: ValidationWarning[];
}

export interface StrategusExecutionResult {
  status: string;
  modules_executed: string[];
  result_files: number;
  output_directory: string;
  elapsed_seconds: number;
}

// ---------------------------------------------------------------------------
// Wizard state
// ---------------------------------------------------------------------------

export interface WizardState {
  studyName: string;
  studyDescription: string;
  selectedModules: string[];
  sharedCohorts: SharedCohortRef[];
  analysisSpec: AnalysisSpecification;
}

export interface SharedCohortRef {
  cohortId: number;
  cohortName: string;
  role: "target" | "comparator" | "outcome";
  json?: object;
  sql?: string;
}

// ---------------------------------------------------------------------------
// Module metadata (static — describes each known module)
// ---------------------------------------------------------------------------

export interface ModuleMetadata {
  name: string;
  package: string;
  label: string;
  description: string;
  icon: string;
  alwaysIncluded?: boolean;
}

export const KNOWN_MODULES: ModuleMetadata[] = [
  {
    name: "CohortGeneratorModule",
    package: "CohortGenerator",
    label: "Cohort Generator",
    description: "Generates cohorts from definitions. Required for all study types.",
    icon: "Users",
    alwaysIncluded: true,
  },
  {
    name: "CohortMethodModule",
    package: "CohortMethod",
    label: "Cohort Method",
    description: "Population-level effect estimation using comparative cohort design.",
    icon: "GitCompare",
  },
  {
    name: "PatientLevelPredictionModule",
    package: "PatientLevelPrediction",
    label: "Patient Level Prediction",
    description: "Builds prediction models for patient-level outcomes using ML.",
    icon: "TrendingUp",
  },
  {
    name: "SelfControlledCaseSeriesModule",
    package: "SelfControlledCaseSeries",
    label: "Self-Controlled Case Series",
    description: "Estimates incidence rate ratios using SCCS design.",
    icon: "Activity",
  },
  {
    name: "CohortDiagnosticsModule",
    package: "CohortDiagnostics",
    label: "Cohort Diagnostics",
    description: "Evaluates phenotype algorithms and characterizes cohorts.",
    icon: "Stethoscope",
  },
  {
    name: "CharacterizationModule",
    package: "Characterization",
    label: "Characterization",
    description: "Computes baseline characteristics across target and comparator cohorts.",
    icon: "BarChart3",
  },
  {
    name: "CohortIncidenceModule",
    package: "CohortIncidence",
    label: "Cohort Incidence",
    description: "Calculates incidence rates of outcomes in target populations.",
    icon: "LineChart",
  },
  {
    name: "EvidenceSynthesisModule",
    package: "EvidenceSynthesis",
    label: "Evidence Synthesis",
    description: "Meta-analysis across data sources using fixed/random effects models.",
    icon: "Network",
  },
];
