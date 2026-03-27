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
// Per-module settings interfaces
// ---------------------------------------------------------------------------

export interface CohortMethodSettings {
  targetCohortIds: number[];
  comparatorCohortIds: number[];
  outcomeCohortIds: number[];
  washoutPeriod: number;
  maxCohortSize: number;
  covariateSettings: {
    useDemographics: boolean;
    useConditionOccurrence: boolean;
    useDrugExposure: boolean;
    useProcedureOccurrence: boolean;
    useMeasurement: boolean;
  };
}

export interface PatientLevelPredictionSettings {
  targetCohortIds: number[];
  outcomeCohortIds: number[];
  modelType: "lassoLogistic" | "gradientBoosting" | "randomForest" | "deepLearning";
  timeAtRisk: {
    riskWindowStart: number;
    riskWindowEnd: number;
  };
  minCohortSize: number;
  splitSeed: number;
  testFraction: number;
}

export interface SelfControlledCaseSeriesSettings {
  outcomeCohortIds: number[];
  exposureCohortIds: number[];
  eraCovariateSettings: {
    includeEraOverlap: boolean;
    firstOccurrenceOnly: boolean;
  };
}

export interface CohortDiagnosticsSettings {
  targetCohortIds: number[];
  runInclusionStatistics: boolean;
  runIncidenceRate: boolean;
  runTimeSeries: boolean;
  runBreakdownIndexEvents: boolean;
  runOrphanConcepts: boolean;
  minCellCount: number;
}

export interface CharacterizationSettings {
  targetCohortIds: number[];
  comparatorCohortIds: number[];
  minPriorObservation: number;
  dechallengeStopInterval: number;
  dechallengeEvaluationWindow: number;
}

export interface CohortIncidenceSettings {
  targetCohortIds: number[];
  outcomeCohortIds: number[];
  timeAtRiskStart: number;
  timeAtRiskEnd: number;
  cleanWindow: number;
}

export interface EvidenceSynthesisSettings {
  method: "fixedEffects" | "randomEffects" | "bayesian";
  evidenceSynthesisSource: string;
}

export type CohortGeneratorSettings = Record<string, never>;

export type ModuleSettings =
  | CohortMethodSettings
  | PatientLevelPredictionSettings
  | SelfControlledCaseSeriesSettings
  | CohortDiagnosticsSettings
  | CharacterizationSettings
  | CohortIncidenceSettings
  | EvidenceSynthesisSettings
  | CohortGeneratorSettings;

export type ModuleSettingsMap = Record<string, ModuleSettings>;

export function getDefaultSettings(moduleName: string): ModuleSettings {
  switch (moduleName) {
    case "CohortMethodModule":
      return {
        targetCohortIds: [],
        comparatorCohortIds: [],
        outcomeCohortIds: [],
        washoutPeriod: 365,
        maxCohortSize: 0,
        covariateSettings: {
          useDemographics: true,
          useConditionOccurrence: true,
          useDrugExposure: true,
          useProcedureOccurrence: true,
          useMeasurement: true,
        },
      } satisfies CohortMethodSettings;
    case "PatientLevelPredictionModule":
      return {
        targetCohortIds: [],
        outcomeCohortIds: [],
        modelType: "lassoLogistic",
        timeAtRisk: { riskWindowStart: 1, riskWindowEnd: 365 },
        minCohortSize: 100,
        splitSeed: 42,
        testFraction: 0.25,
      } satisfies PatientLevelPredictionSettings;
    case "SelfControlledCaseSeriesModule":
      return {
        outcomeCohortIds: [],
        exposureCohortIds: [],
        eraCovariateSettings: {
          includeEraOverlap: true,
          firstOccurrenceOnly: false,
        },
      } satisfies SelfControlledCaseSeriesSettings;
    case "CohortDiagnosticsModule":
      return {
        targetCohortIds: [],
        runInclusionStatistics: true,
        runIncidenceRate: true,
        runTimeSeries: true,
        runBreakdownIndexEvents: true,
        runOrphanConcepts: true,
        minCellCount: 5,
      } satisfies CohortDiagnosticsSettings;
    case "CharacterizationModule":
      return {
        targetCohortIds: [],
        comparatorCohortIds: [],
        minPriorObservation: 365,
        dechallengeStopInterval: 30,
        dechallengeEvaluationWindow: 30,
      } satisfies CharacterizationSettings;
    case "CohortIncidenceModule":
      return {
        targetCohortIds: [],
        outcomeCohortIds: [],
        timeAtRiskStart: 0,
        timeAtRiskEnd: 365,
        cleanWindow: 0,
      } satisfies CohortIncidenceSettings;
    case "EvidenceSynthesisModule":
      return {
        method: "fixedEffects",
        evidenceSynthesisSource: "CohortMethod",
      } satisfies EvidenceSynthesisSettings;
    case "CohortGeneratorModule":
    default:
      return {} as CohortGeneratorSettings;
  }
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
