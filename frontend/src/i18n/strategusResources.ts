type MessageTree = {
  [key: string]: string | MessageTree;
};

function mergeMessageTrees(base: MessageTree, overrides: MessageTree): MessageTree {
  return Object.fromEntries(
    Object.entries(base).map(([key, baseValue]) => {
      const overrideValue = overrides[key];
      if (
        baseValue &&
        typeof baseValue === "object" &&
        !Array.isArray(baseValue)
      ) {
        return [
          key,
          mergeMessageTrees(
            baseValue,
            overrideValue &&
              typeof overrideValue === "object" &&
              !Array.isArray(overrideValue)
              ? overrideValue
              : {},
          ),
        ];
      }

      return [key, overrideValue ?? baseValue];
    }),
  );
}

const enStrategus: MessageTree = {
  strategus: {
    common: {
      added: "Added",
      auto: "Auto",
      back: "Back",
      comparator: "Comparator",
      cohorts: "Cohorts",
      description: "Description",
      issues: "Issues",
      modules: "Modules",
      next: "Next",
      noneConfigured: "None configured",
      outcome: "Outcome",
      required: "Required",
      source: "Source",
      status: "Status",
      target: "Target",
      warnings: "Warnings",
    },
    page: {
      header: {
        title: "Study Packages",
        subtitle:
          "Build and execute Strategus multi-analysis OHDSI study packages",
        importJson: "Import JSON",
        exportJson: "Export JSON",
      },
      steps: {
        studyInfo: "Study Info",
        selectModules: "Select Modules",
        sharedCohorts: "Shared Cohorts",
        moduleSettings: "Module Settings",
        jsonPreview: "JSON Preview",
        reviewValidate: "Review & Validate",
        execute: "Execute",
      },
      studyInfo: {
        title: "Study Information",
        intro:
          "Name your study package and provide an optional description.",
        studyName: "Study Name",
        description: "Description",
        studyNamePlaceholder:
          "e.g., SGLT2i vs DPP4i Heart Failure Risk Study",
        descriptionPlaceholder:
          "Briefly describe the study objectives, population, and expected outcomes...",
        info:
          "Strategus executes multi-analysis OHDSI study packages across one or more CDM data sources. Each analysis module runs independently and writes results to the configured output directory.",
      },
      selectModules: {
        loading: "Loading available modules...",
        title: "Select Analysis Modules",
        intro:
          "Choose which OHDSI analysis modules to include. CohortGenerator is required and always included.",
        selectedSummary_one:
          "{{count}} module selected (including CohortGenerator)",
        selectedSummary_other:
          "{{count}} modules selected (including CohortGenerator)",
      },
      sharedCohorts: {
        title: "Shared Cohort Definitions",
        intro:
          "Add target, comparator, and outcome cohorts shared across all analysis modules.",
        addCohort: "Add Cohort",
        searchPlaceholder: "Search cohort definitions...",
        loading: "Loading cohorts...",
        noneFound: "No cohort definitions found.",
        empty:
          "No cohorts added yet. Most analysis modules require at least one target cohort.",
        roles: {
          target: "Target",
          comparator: "Comparator",
          outcome: "Outcome",
        },
      },
      review: {
        title: "Study Package Summary",
        studyName: "Study Name",
        description: "Description",
        modules: "Modules",
        cohorts: "Cohorts",
        validateTitle: "Validate Specification",
        validateIntro:
          "Check the analysis spec for module configuration issues before executing.",
        runValidation: "Run Validation",
        validationPassed: "Validation passed",
        validationFailed: "Validation failed",
        validationFailedWithMessage: "Validation failed: {{message}}",
        validationRequestFailed: "Validation request failed",
        severity: {
          error: "Error",
          warning: "Warning",
        },
      },
      execute: {
        title: "Execute Study Package",
        intro:
          'Select a CDM data source and execute "{{studyName}}" across all configured modules.',
        targetDataSource: "Target Data Source",
        loadingSources: "Loading sources...",
        selectSource: "Select a source",
        executeStudyPackage: "Execute Study Package",
        executing: "Executing...",
        runningTitle: "Study package is running...",
        runningIntro:
          "Strategus is orchestrating module execution. This may take several minutes depending on dataset size and number of modules.",
        executionFailed: "Execution failed: {{message}}",
        executionRequestFailed: "Execution request failed",
        executionComplete: "Execution Complete",
        outputDirectory: "Output Directory",
        modulesExecuted: "Modules Executed",
        resultStats: {
          status: "Status",
          modulesRun: "Modules Run",
          resultFiles: "Result Files",
        },
        statusLabels: {
          completed: "Completed",
          running: "Running",
          failed: "Failed",
        },
      },
    },
    jsonEditor: {
      title: "JSON Spec Preview",
      intro:
        "Review the generated analysis specification. Edit directly or apply changes below.",
      copied: "Copied",
      copyToClipboard: "Copy to Clipboard",
      resetToGenerated: "Reset to Generated",
      lineCount_one: "{{count}} line",
      lineCount_other: "{{count}} lines",
      validJson: "Valid JSON",
      invalidJson: "Invalid JSON",
      applyChanges: "Apply Changes",
    },
    moduleSettings: {
      title: "Module Settings",
      intro:
        "Configure per-module parameters. Click a module to expand its settings.",
      unknownModule: "Unknown module: {{moduleName}}",
      autoBadge: "Auto",
      noConfigurationNeeded:
        "No configuration needed. CohortGenerator automatically builds cohorts from the shared cohort definitions.",
      noCohorts:
        "No cohorts available. Add cohorts in the Shared Cohorts step.",
      noRoleCohorts:
        "No {{role}} cohorts available. Add cohorts in the Shared Cohorts step.",
      sections: {
        cohortAssignment: "Cohort Assignment",
        parameters: "Parameters",
        covariateSettings: "Covariate Settings",
        modelConfiguration: "Model Configuration",
        timeAtRisk: "Time at Risk",
        trainingParameters: "Training Parameters",
        eraCovariateSettings: "Era Covariate Settings",
        diagnosticsOptions: "Diagnostics Options",
        synthesisConfiguration: "Synthesis Configuration",
      },
      fields: {
        targetCohorts: "Target Cohorts",
        comparatorCohorts: "Comparator Cohorts",
        outcomeCohorts: "Outcome Cohorts",
        exposureCohorts: "Exposure Cohorts",
        washoutPeriod: "Washout Period (days)",
        maxCohortSize: "Max Cohort Size (0 = unlimited)",
        demographics: "Demographics",
        conditionOccurrence: "Condition Occurrence",
        drugExposure: "Drug Exposure",
        procedureOccurrence: "Procedure Occurrence",
        measurement: "Measurement",
        modelType: "Model Type",
        windowStart: "Window Start (days)",
        windowEnd: "Window End (days)",
        minCohortSize: "Min Cohort Size",
        splitSeed: "Split Seed",
        testFraction: "Test Fraction",
        includeEraOverlap: "Include Era Overlap",
        firstOccurrenceOnly: "First Occurrence Only",
        inclusionStatistics: "Inclusion Statistics",
        incidenceRate: "Incidence Rate",
        timeSeries: "Time Series",
        breakdownIndexEvents: "Breakdown Index Events",
        orphanConcepts: "Orphan Concepts",
        minCellCount: "Min Cell Count",
        minPriorObservation: "Min Prior Observation (days)",
        dechallengeStopInterval: "Dechallenge Stop Interval",
        dechallengeEvalWindow: "Dechallenge Eval Window",
        start: "Start (days)",
        end: "End (days)",
        cleanWindow: "Clean Window (days)",
        method: "Method",
        evidenceSourceModule: "Evidence Source Module",
      },
      options: {
        modelTypes: {
          lassoLogistic: "Lasso Logistic Regression",
          gradientBoosting: "Gradient Boosting",
          randomForest: "Random Forest",
          deepLearning: "Deep Learning",
        },
        synthesisMethods: {
          fixedEffects: "Fixed Effects",
          randomEffects: "Random Effects",
          bayesian: "Bayesian",
        },
        evidenceSources: {
          cohortMethod: "Cohort Method",
          selfControlledCaseSeries: "Self-Controlled Case Series",
        },
      },
    },
    moduleMeta: {
      cohortGenerator: {
        label: "Cohort Generator",
        description:
          "Generates cohorts from definitions. Required for all study types.",
      },
      cohortMethod: {
        label: "Cohort Method",
        description:
          "Population-level effect estimation using comparative cohort design.",
      },
      patientLevelPrediction: {
        label: "Patient Level Prediction",
        description:
          "Builds prediction models for patient-level outcomes using ML.",
      },
      selfControlledCaseSeries: {
        label: "Self-Controlled Case Series",
        description:
          "Estimates incidence rate ratios using SCCS design.",
      },
      cohortDiagnostics: {
        label: "Cohort Diagnostics",
        description:
          "Evaluates phenotype algorithms and characterizes cohorts.",
      },
      characterization: {
        label: "Characterization",
        description:
          "Computes baseline characteristics across target and comparator cohorts.",
      },
      cohortIncidence: {
        label: "Cohort Incidence",
        description:
          "Calculates incidence rates of outcomes in target populations.",
      },
      evidenceSynthesis: {
        label: "Evidence Synthesis",
        description:
          "Meta-analysis across data sources using fixed/random effects models.",
      },
    },
  },
};

export const strategusResources: Record<string, MessageTree> = {
  "en-US": enStrategus,
  "es-ES": mergeMessageTrees(enStrategus, {}),
  "fr-FR": mergeMessageTrees(enStrategus, {}),
  "de-DE": mergeMessageTrees(enStrategus, {}),
  "pt-BR": mergeMessageTrees(enStrategus, {}),
  "fi-FI": mergeMessageTrees(enStrategus, {}),
  "ja-JP": mergeMessageTrees(enStrategus, {}),
  "zh-Hans": mergeMessageTrees(enStrategus, {}),
  "ko-KR": mergeMessageTrees(enStrategus, {}),
  "hi-IN": mergeMessageTrees(enStrategus, {}),
  ar: mergeMessageTrees(enStrategus, {}),
  "en-XA": mergeMessageTrees(enStrategus, {}),
};
