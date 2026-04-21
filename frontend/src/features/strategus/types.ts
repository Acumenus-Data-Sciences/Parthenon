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
  copyKey: string;
  icon: string;
  alwaysIncluded?: boolean;
}

// i18n-exempt: Strategus module names, package names, and copy keys are internal identifiers.
export const KNOWN_MODULES: ModuleMetadata[] = [
  {
    name: "CohortGeneratorModule" /* i18n-exempt: internal module identifier */,
    package: "CohortGenerator",
    copyKey: "cohortGenerator",
    icon: "Users",
    alwaysIncluded: true,
  },
  {
    name: "CohortMethodModule" /* i18n-exempt: internal module identifier */,
    package: "CohortMethod",
    copyKey: "cohortMethod",
    icon: "GitCompare",
  },
  {
    name: "PatientLevelPredictionModule" /* i18n-exempt: internal module identifier */,
    package: "PatientLevelPrediction",
    copyKey: "patientLevelPrediction",
    icon: "TrendingUp",
  },
  {
    name: "SelfControlledCaseSeriesModule" /* i18n-exempt: internal module identifier */,
    package: "SelfControlledCaseSeries",
    copyKey: "selfControlledCaseSeries",
    icon: "Activity",
  },
  {
    name: "CohortDiagnosticsModule" /* i18n-exempt: internal module identifier */,
    package: "CohortDiagnostics",
    copyKey: "cohortDiagnostics",
    icon: "Stethoscope",
  },
  {
    name: "CharacterizationModule" /* i18n-exempt: internal module identifier */,
    package: "Characterization",
    copyKey: "characterization",
    icon: "BarChart3",
  },
  {
    name: "CohortIncidenceModule" /* i18n-exempt: internal module identifier */,
    package: "CohortIncidence",
    copyKey: "cohortIncidence",
    icon: "LineChart",
  },
  {
    name: "EvidenceSynthesisModule" /* i18n-exempt: internal module identifier */,
    package: "EvidenceSynthesis",
    copyKey: "evidenceSynthesis",
    icon: "Network",
  },
];
