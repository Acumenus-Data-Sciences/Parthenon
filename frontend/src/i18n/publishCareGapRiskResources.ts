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

const enPublishCareGapRisk: MessageTree = {
  riskScores: {
    common: {
      status: {
        draft: "Draft",
        pending: "Pending",
        running: "Running",
        completed: "Completed",
        failed: "Failed",
      },
      tier: {
        low: "Low",
        intermediate: "Intermediate",
        high: "High",
        veryHigh: "Very High",
        uncomputable: "Uncomputable",
        filtered: "Filtered",
        customFilter: "Custom filter",
      },
      category: {
        cardiovascular: "Cardiovascular",
        comorbidityBurden: "Comorbidity Burden",
        hepatic: "Hepatic",
        pulmonary: "Pulmonary",
        respiratory: "Respiratory",
        metabolic: "Metabolic",
        endocrine: "Endocrine",
        musculoskeletal: "Musculoskeletal",
      },
      tabs: {
        overview: "Overview",
        results: "Results",
        patients: "Patients",
        recommendations: "Recommendations",
        configuration: "Configuration",
      },
      actions: {
        back: "Back",
        close: "Close",
        cancel: "Cancel",
        clear: "Clear",
        refresh: "Refresh",
        reRun: "Re-run",
        reRunAnalysis: "Re-run Analysis",
        runAnalysis: "Run Analysis",
        quickRun: "Quick Run",
        createAnalysis: "Create Analysis",
        createCohort: "Create Cohort",
        createCohortFromFilter: "Create Cohort from Filter",
        newAnalysis: "New Analysis",
        duplicateAnalysis: "Duplicate analysis",
        deleteAnalysis: "Delete analysis",
        openCatalogue: "Open Catalogue",
        viewFullResults: "View Full Results",
      },
      values: {
        noneSelected: "None selected",
        noDescription: "No description",
        unknown: "Unknown",
        notAvailable: "N/A",
        yes: "Yes",
        no: "No",
      },
      view: {
        table: "Table view",
        card: "Card view",
      },
      search: {
        analysesPlaceholder: "Search analyses...",
        noMatch: "No analyses match \"{{query}}\"",
        typeToFilter: "Type to filter {{count}} analyses",
      },
      count: {
        cohort_one: "{{count}} cohort",
        cohort_other: "{{count}} cohorts",
        score_one: "{{count}} score",
        score_other: "{{count}} scores",
        analysis_one: "{{count}} analysis",
        analysis_other: "{{count}} analyses",
        patient_one: "{{count}} patient",
        patient_other: "{{count}} patients",
      },
      duration: {
        milliseconds: "{{value}}ms",
        seconds: "{{value}}s",
        minutesSeconds: "{{minutes}}m {{seconds}}s",
        total: "{{value}} total",
      },
      headers: {
        name: "Name",
        cohort: "Cohort",
        scores: "Scores",
        status: "Status",
        lastRun: "Last Run",
        author: "Author",
        created: "Created",
        tier: "Tier",
        count: "Count",
        meanScore: "Mean Score",
        confidence: "Confidence",
        score: "Score",
        value: "Value",
        riskTier: "Risk Tier",
        completeness: "Completeness",
        missing: "Missing",
        started: "Started",
        duration: "Duration",
        actions: "Actions",
        number: "#",
      },
      pagination: {
        showingRange: "Showing {{from}}-{{to}} of {{total}}",
        pageXOfY: "{{current}} / {{total}}",
      },
    },
    hub: {
      title: "Risk Score Analyses",
      subtitle: "Stratify patient populations by validated clinical risk scores",
      metrics: {
        total: "Total",
        running: "Running",
        completed: "Completed",
        scoresAvailable: "Scores Available",
        patientsScored: "Patients Scored",
      },
      filters: {
        status: "Status",
        category: "Category",
        allCategories: "All Categories",
      },
      tabs: {
        analyses: "Analyses",
        scoreCatalogue: "Score Catalogue",
      },
      drilldown: {
        analyses: "{{status}} Analyses",
      },
      empty: {
        noMatchingAnalyses: "No matching analyses",
        noRiskScoreAnalysesYet: "No risk score analyses yet",
        noAnalysesFoundFor: "No analyses found for \"{{query}}\"",
        createFirst:
          "Create your first analysis to stratify patients by clinical risk scores.",
      },
      errors: {
        failedToLoadAnalyses: "Failed to load analyses. Please try again.",
      },
      catalogue: {
        checkingEligibility: "Checking eligibility...",
        showingEligibilityFor: "Showing eligibility for {{source}}",
        eligibleSummary: "{{eligible}} of {{total}} scores eligible",
        completedResults: "{{count}} completed results",
        selectSourcePrompt:
          "Select a data source from the header to check eligibility for each score.",
        sourceLevelCompletedScores: "Source-Level Completed Scores",
        sourceLevelCompletedScoresDetail:
          "{{count}} completed score exists for the active source but is not attached to any v2 analysis execution.",
        sourceLevelCompletedScoresDetail_other:
          "{{count}} completed scores exist for the active source but are not attached to any v2 analysis execution.",
        eligibleCount: "{{count}} eligible",
        completedCount: "{{count}} completed",
      },
    },
    create: {
      title: "New Risk Score Analysis",
      subtitle:
        "Configure a risk scoring analysis and select scores to compute",
      steps: {
        configure: "Configure",
        reviewAndRun: "Review & Run",
      },
      basics: "Basics",
      name: "Name *",
      description: "Description",
      targetCohort: "Target Cohort *",
      selectCohort: "Select a cohort...",
      scoreSelection: "Score Selection",
      cohortPatients: "{{count}} patients",
      autoNameSuffix: "Risk Stratification",
      placeholders: {
        name: "e.g., Heart Failure Cohort - Risk Stratification",
        description: "Optional description of this risk scoring analysis...",
      },
      completeness: "Completeness:",
      createAsDraft: "Create as Draft",
      createAndRun: "Create & Run",
      errors: {
        executionFailed:
          "Analysis created but execution failed. You can re-run from the detail page.",
        createFailed: "Failed to create analysis. Please try again.",
      },
      recommendations: {
        recommended: "Recommended",
        available: "Available",
        notApplicable: "Not Applicable",
      },
    },
    detail: {
      notFound: "Analysis not found",
      backToRiskScores: "Back to Risk Scores",
      selectSourcePrompt:
        "Select a data source to run or view execution results.",
      deleteConfirm:
        "Are you sure you want to delete this analysis? This action cannot be undone.",
    },
    overview: {
      about: "About",
      author: "Author: {{value}}",
      created: "Created: {{value}}",
      updated: "Updated: {{value}}",
      resultsSummary: "Results Summary",
      scoresComputed: "Scores Computed",
      uniqueScores: "unique scores",
      patientsScored: "Patients Scored",
      maxPerScore: "max per score",
      avgCompleteness: "Avg Completeness",
      avgConfidence: "Avg Confidence",
      acrossSummaries: "across summaries",
      thisAnalysisHasNotBeenExecutedYet: "This analysis hasn't been executed yet.",
      executionInProgress: "Execution in progress...",
      lastExecutionFailed: "Last execution failed.",
      recentExecution: "Recent Execution",
      started: "Started",
      completed: "Completed",
      duration: "Duration",
    },
    configuration: {
      analysisDesign: "Analysis Design",
      targetCohorts: "Target Cohorts",
      selectedScores: "Selected Scores",
      parameters: "Parameters",
      minCompleteness: "Min Completeness:",
      storePatientLevel: "Store Patient Level:",
      executionHistory: "Execution History",
      noExecutionsYet: "No executions yet",
    },
    results: {
      noResultsAvailable:
        "No results available. Run the analysis to compute risk scores.",
      allScores: "All Scores",
      percentOfTotal: "% of Total",
      action: "Action",
      averageCompleteness: "Average completeness:",
    },
    patients: {
      noExecutionSelected: "No execution selected",
      runExecutionToViewPatientLevel:
        "Run an execution to view patient-level results.",
      all: "All",
      showingPatients: "Showing {{count}} patients",
      patientsOnPage: "{{count}} patients on this page",
      noPatientResultsAvailable: "No patient results available",
      adjustFilters: "Try adjusting your filters to see results.",
      executeToGenerate:
        "Execute the analysis to generate patient-level scores.",
      personId: "Person ID",
    },
    scoreDetail: {
      selectSourcePrompt:
        "Select a data source from the header to check eligibility.",
      eligiblePatients:
        "Eligible - {{count}} patients have sufficient data",
      insufficientData: "Insufficient data in the active source",
      missing: "Missing:",
      checkingEligibility: "Checking eligibility for the active source...",
      eligiblePopulation: "Eligible Population",
      requiredComponents: "Required Components",
      cdmTablesUsed: "CDM Tables Used",
      riskTierDefinitions: "Risk Tier Definitions",
      scoreRange: "Score Range",
    },
    createCohort: {
      title: "Create Cohort from Risk Tier",
      cohortName: "Cohort Name",
      description: "Description",
      patientsIncluded: "{{count}} patients will be included",
      showDetails: "Show details",
      hideDetails: "Hide details",
      analysisId: "Analysis ID:",
      executionId: "Execution ID:",
      score: "Score:",
      tier: "Tier:",
      createFailed: "Failed to create cohort. Please try again.",
      derivedDescription:
        "Patients from cohort '{{cohort}}' with {{score}} risk tier = {{tier}}",
      defaultName: "{{score}} - {{tier}} Risk - {{cohort}}",
    },
    recommendations: {
      selectSourceToView: "Select a source to view recommendations",
      recommended: "Recommended",
      available: "Available",
      notApplicable: "Not Applicable",
    },
    runModal: {
      title: "Population Risk Scores",
      computingScores: "Computing scores...",
      completedScoresIn:
        "Completed {{count}} score in {{duration}}",
      completedScoresIn_other:
        "Completed {{count}} scores in {{duration}}",
      runFailed: "Run failed",
      passed: "{{count}} passed",
      failed: "{{count}} failed",
      skipped: "{{count}} skipped",
      seconds: "seconds",
      tiers: "{{count}} tiers",
    },
    tierBreakdown: {
      tierDistribution: "Tier Distribution",
      patientsPerTier: "Patients per Tier",
      patients: "Patients",
    },
    cohortProfile: {
      demographics: "Demographics",
      patients: "patients",
      age: "Age",
      female: "{{count}}% female",
      topConditions: "Top Conditions",
      measurementCoverage: "Measurement Coverage",
    },
  },
  careGaps: {
    common: {
      status: {
        pending: "Pending",
        running: "Running",
        completed: "Completed",
        failed: "Failed",
      },
      actions: {
        newBundle: "New Bundle",
        delete: "Delete",
        evaluate: "Evaluate",
        backToList: "Back to list",
        saveChanges: "Save Changes",
        createBundle: "Create Bundle",
      },
      category: {
        all: "All",
        endocrine: "Endocrine",
        cardiovascular: "Cardiovascular",
        respiratory: "Respiratory",
        mentalHealth: "Mental Health",
        rheumatologic: "Rheumatologic",
        neurological: "Neurological",
        oncology: "Oncology",
      },
      bundle: {
        active: "Active",
        inactive: "Inactive",
        measure_one: "{{count}} measure",
        measure_other: "{{count}} measures",
      },
    },
    page: {
      title: "Care Gaps",
      subtitle:
        "Condition bundles, quality measures, and population compliance tracking",
      untitledBundle: "Untitled Bundle",
      tabs: {
        bundles: "Disease Bundles",
        population: "Population Overview",
      },
    },
    bundleList: {
      searchPlaceholder: "Search bundles...",
      allCategories: "All Categories",
      sortName: "Name",
      sortCompliance: "Compliance",
      noBundlesFound: "No bundles found",
      adjustFilters: "Try adjusting your filters",
      createToGetStarted: "Create a bundle to get started",
    },
    bundleDetail: {
      failedToLoad: "Failed to load bundle",
      backToCareGaps: "Care Gaps",
      overallCompliance: "Overall Compliance",
      tabs: {
        design: "Design",
        compliance: "Compliance Results",
        overlap: "Overlap Rules",
      },
      executeEvaluation: "Execute Evaluation",
      overall: "Overall",
      totalPatients: "Total Patients",
      gapsMet: "Gaps Met",
      openGaps: "Open Gaps",
      excluded: "Excluded",
      evaluationHistory: "Evaluation History",
      sourceLabel: "Source #{{value}}",
      evaluationInProgress: "Evaluation in progress...",
      noEvaluationResults:
        "No evaluation results yet. Execute an evaluation to see compliance data.",
      deleteConfirm:
        "Are you sure you want to delete this condition bundle?",
    },
    bundleDesigner: {
      bundleDetails: "Bundle Details",
      bundleCode: "Bundle Code",
      conditionName: "Condition Name",
      description: "Description",
      diseaseCategory: "Disease Category",
      selectCategory: "Select category...",
      icd10Patterns: "ICD-10 Patterns",
      omopConceptIds: "OMOP Concept IDs",
      ecqmReferences: "eCQM References",
      attachedMeasures: "Attached Measures",
      noMeasuresAttached: "No measures attached to this bundle.",
      saveBundle: "Save Bundle",
      saving: "Saving...",
      add: "Add",
      remove: "Remove",
      placeholders: {
        bundleCode: "e.g., DM2-BUNDLE",
        conditionName: "e.g., Type 2 Diabetes Mellitus",
        description: "Describe the bundle...",
        icd10: "e.g., E11%",
        conceptId: "Enter concept ID",
        ecqm: "e.g., CMS122v11",
      },
    },
    measureCompliance: {
      noResultsAvailable: "No measure results available yet.",
      code: "Code",
      measure: "Measure",
      domain: "Domain",
      eligible: "Eligible",
      met: "Met",
      notMet: "Not Met",
      compliance: "Compliance",
      deduplicated: "Deduplicated",
      deduplicatedFrom: "Deduplicated from: {{value}}",
    },
    population: {
      selectSourcePrompt:
        "Select a data source to view population compliance.",
      failedToLoad: "Failed to load population summary.",
      totalBundles: "Total Bundles",
      totalPatients: "Total Patients",
      avgCompliance: "Avg Compliance",
      totalOpenGaps: "Total Open Gaps",
      filterByCategory: "Filter by category:",
      bundleComplianceComparison: "Bundle Compliance Comparison",
      noBundlesMatchFilter: "No bundles match the selected filter.",
      patientsShort: "{{count}} pts",
    },
    overlapRules: {
      failedToLoad: "Failed to load overlap rules.",
      noneConfigured: "No overlap rules configured.",
      subtitle:
        "Overlap rules prevent double-counting measures across bundles.",
    },
  },
  publish: {
    steps: {
      selectAnalyses: "Select Analyses",
      configure: "Configure",
      preview: "Preview",
      export: "Export",
    },
    common: {
      actions: {
        back: "Back",
        next: "Next",
        previewDocument: "Preview Document ->",
        configureDocument: "Configure Document ->",
        close: "Close",
      },
      sectionType: {
        title: "Title",
        methods: "Methods",
        results: "Results",
        diagram: "Diagram",
        discussion: "Discussion",
        diagnostics: "Diagnostics",
      },
      analysisType: {
        characterizations: "Characterization",
        characterization: "Characterization",
        estimations: "Estimation",
        estimation: "Estimation",
        predictions: "Prediction",
        prediction: "Prediction",
        incidence_rates: "Incidence Rate",
        incidence_rate: "Incidence Rate",
        sccs: "SCCS",
        evidence_synthesis: "Evidence Synthesis",
        pathways: "Pathway",
        pathway: "Pathway",
      },
      resultSection: {
        populationCharacteristics: "Population Characteristics",
        incidenceRates: "Incidence Rates",
        comparativeEffectiveness: "Comparative Effectiveness",
        treatmentPatterns: "Treatment Patterns",
        safetyAnalysis: "Safety Analysis",
        predictiveModeling: "Predictive Modeling",
        evidenceSynthesis: "Evidence Synthesis",
      },
    },
    page: {
      title: "Publish",
      subtitle:
        "Create pre-publication manuscripts from studies and analyses",
      startNewDocument: "Start new document",
      untitledDocument: "Untitled Document",
    },
    cart: {
      selected: "Selected ({{count}})",
      empty: "No analyses selected yet",
      removeAnalysis: "Remove {{name}}",
    },
    configurator: {
      documentTitle: "Document Title",
      documentTitlePlaceholder: "Enter document title...",
      authors: "Authors (comma-separated)",
      authorsPlaceholder: "Author One, Author Two...",
      template: "Template",
    },
    preview: {
      diagramDataNotAvailable: "Diagram data not available",
      unknownDiagramType: "Unknown diagram type",
      reviewWarning:
        "Some AI-generated sections have not been reviewed. Please accept or edit all AI content before exporting.",
      generatedLabel: "Generated {{date}}",
      noSectionContent: "No content available for this section.",
      noSectionsIncluded:
        "No sections included. Go back to configure your document.",
      backToConfigure: "Back to Configure",
      export: "Export",
    },
    exportControls: {
      exportFormat: "Export Format",
      comingSoon: "Coming soon",
      exporting: "Exporting...",
      exportAs: "Export as {{format}}",
      formats: {
        pdf: {
          description: "Full formatted report via print dialog",
        },
        docx: {
          description: "Structured Word document",
        },
        xlsx: {
          description: "Tables and statistics as spreadsheet",
        },
        png: {
          description: "Charts as raster image files",
        },
        svg: {
          description: "Charts as vector image files",
        },
      },
    },
    exportPanel: {
      draftWarning:
        "Some AI-generated sections are still in draft state. Please go back and accept or edit all AI content before exporting.",
      chooseExportFormat: "Choose Export Format",
      exporting: "Exporting...",
      exportAs: "Export as {{format}}",
      backToPreview: "Back to Preview",
      formatLabels: {
        docx: "DOCX",
        pdf: "PDF",
        figuresZip: "Figures ZIP",
      },
      formats: {
        docx: {
          label: "Microsoft Word",
          description: "Journal-ready manuscript with embedded figures",
        },
        pdf: {
          label: "PDF Document",
          description: "Print-ready document for review and sharing",
        },
        figuresZip: {
          label: "Individual Figures",
          description: "SVG files for separate journal upload",
        },
      },
    },
    methods: {
      studyDesign: "Study Design",
      primaryObjective: "Primary Objective",
      hypothesis: "Hypothesis",
      scientificRationale: "Scientific Rationale",
      cohortDefinitions: "Cohort Definitions",
      target: "Target",
      comparator: "Comparator",
      outcome: "Outcome",
      timeAtRisk: "Time-at-Risk",
      start: "Start",
      end: "End",
      matchingStrategy: "Matching Strategy",
      modelSettings: "Model Settings",
      empty:
        "No methods data available. Methods will be auto-generated when analysis parameters are provided.",
      defaults: {
        observational: "Observational",
        cohortStart: "cohort start",
        cohortEnd: "cohort end",
      },
    },
    reportPreview: {
      title: "Study Report Preview",
      subtitle:
        "Toggle sections on/off and reorder using the controls. Only included sections will appear in the export.",
      empty: "No sections to preview. Go back and select analysis executions.",
    },
    reportSection: {
      moveUp: "Move up",
      moveDown: "Move down",
      diagnosticsPlaceholder:
        "Diagnostics data will be rendered in the exported report.",
      includeSection: "Include section",
      excludeSection: "Exclude section",
      included: "Included",
      excluded: "Excluded",
    },
    resultsSummary: {
      empty: "No results data available for this execution.",
    },
    resultsTable: {
      empty: "No structured data available for this table.",
      caption: "Table {{number}}. {{title}}",
    },
    sectionEditor: {
      tableLabel: "Table",
      aiNarrative: "AI Narrative",
      structuredData: "Structured Data",
      hideTable: "Hide table",
      showTable: "Show table",
      hideNarrative: "Hide narrative",
      showNarrative: "Show narrative",
      hideDiagram: "Hide diagram",
      showDiagram: "Show diagram",
      noDiagram: "No diagram generated yet",
    },
    studySelector: {
      loadingStudies: "Loading studies...",
      failedToLoad: "Failed to load studies. Please try again.",
      selectStudy: "Select a Study",
      noStudiesFound: "No studies found. Create a study first.",
      completedExecutions: "Completed Executions",
      loadingExecutions: "Loading executions...",
      noCompletedExecutions: "No completed executions found for this study.",
      executionLabel: "Execution #{{value}}",
    },
    analysisPicker: {
      filter: {
        allTypes: "All Types",
      },
      searchAnalyses: "Search analyses...",
      searchStudies: "Search studies...",
      tabs: {
        allAnalyses: "All Analyses",
        fromStudies: "From Studies",
      },
      loadingAnalyses: "Loading analyses...",
      noCompletedAnalyses: "No completed analyses found",
      loadingStudies: "Loading studies...",
      noStudiesMatchFilters: "No studies match your filters",
      noStudiesFound: "No studies found",
      completedAnalyses_one: "{{count}} completed analysis",
      completedAnalyses_other: "{{count}} completed analyses",
      actions: {
        selectAll: "Select All",
        deselectAll: "Deselect All",
      },
    },
    aiNarrative: {
      generate: "Generate AI Draft",
      generating: "Generating narrative...",
      draft: "AI Draft",
      accept: "Accept",
      regenerate: "Regenerate",
      accepted: "Accepted",
      edit: "Edit",
    },
    structuredData: {
      empty: "No structured data available",
    },
    diagram: {
      exportSvg: "Export as SVG",
      exportPng: "Export as PNG",
    },
    tables: {
      captions: {
        incidenceRatesByCohort: "Incidence rates by cohort",
        comparativeEffectivenessEstimates:
          "Comparative effectiveness estimates",
        sccsEstimates:
          "Self-controlled case series: incidence rate ratios by exposure window",
        treatmentPathways: "Treatment pathways (top 10)",
        populationCharacteristics: "Population characteristics",
        predictionModelPerformance: "Prediction model performance",
        evidenceSynthesisPooled: "Evidence synthesis: pooled estimates",
      },
      headers: {
        cohort: "Cohort",
        outcome: "Outcome",
        events: "Events",
        personYears: "Person-Years",
        ratePer1000Py: "Rate/1000PY",
        confidence95: "95% CI",
        hazardRatioShort: "HR",
        pValue: "p-value",
        exposureWindow: "Exposure Window",
        irr: "IRR",
        pathway: "Pathway",
        patients: "Patients",
        percent: "%",
        n: "N",
        percentFemale: "% Female",
        percentMale: "% Male",
        ageGroup: "Age Group",
        model: "Model",
        auc: "AUC",
        brierScore: "Brier Score",
        auprc: "AUPRC",
        targetN: "Target N",
        outcomeN: "Outcome N",
        analysis: "Analysis",
        pooledEstimate: "Pooled Estimate",
        iSquaredShort: "I²",
      },
      values: {
        cohort: "Cohort",
      },
    },
    templates: {
      "generic-ohdsi": {
        name: "Generic OHDSI Publication",
        description:
          "Standard IMRaD structure for observational health data studies",
        sections: {
          introduction: "Introduction",
          methods: "Methods",
          discussion: "Discussion",
        },
      },
      "comparative-effectiveness": {
        name: "Comparative Effectiveness Report",
        description: "CLE/CER structure with propensity score analysis",
        sections: {
          background: "Background",
          "study-design": "Study Design",
          "ps-matching": "Propensity Score Matching",
          covariates: "Covariate Balance",
          "sensitivity-analyses": "Sensitivity Analyses",
          discussion: "Discussion",
        },
      },
      "incidence-report": {
        name: "Incidence Rate Report",
        description: "Population-based incidence analysis",
        sections: {
          background: "Background",
          methods: "Methods",
          discussion: "Discussion",
        },
      },
      "study-protocol": {
        name: "Study Protocol / SAP",
        description: "Pre-study statistical analysis plan -- no results needed",
        sections: {
          objectives: "Objectives",
          hypotheses: "Hypotheses",
          "study-design": "Study Design",
          "data-sources": "Data Sources",
          "cohort-definitions": "Cohort Definitions",
          "analysis-plan": "Analysis Plan",
          timeline: "Timeline",
        },
      },
      "jamia-style": {
        name: "JAMIA Style",
        description:
          "Journal of the American Medical Informatics Association -- informatics methodology focus with reproducibility emphasis",
        sections: {
          "background-significance": "Background and Significance",
          objective: "Objective",
          "materials-methods": "Materials and Methods",
          "data-sources": "Data Sources and Study Population",
          "phenotype-definitions": "Phenotype Definitions",
          "statistical-analysis": "Statistical Analysis",
          discussion: "Discussion",
          limitations: "Limitations",
          conclusion: "Conclusion",
        },
      },
      "lancet-style": {
        name: "Lancet Style",
        description:
          "The Lancet -- global health focus with structured methods, evidence-based interpretation, and policy implications",
        sections: {
          introduction: "Introduction",
          methods: "Methods",
          "study-design-participants": "Study Design and Participants",
          procedures: "Procedures",
          outcomes: "Outcomes",
          "statistical-analysis": "Statistical Analysis",
          "role-of-funding": "Role of the Funding Source",
          discussion: "Discussion",
        },
      },
      "nejm-style": {
        name: "NEJM Style",
        description:
          "New England Journal of Medicine -- concise clinical impact structure with strict word economy",
        sections: {
          introduction: "Introduction",
          methods: "Methods",
          "study-design": "Study Design and Oversight",
          patients: "Patients",
          endpoints: "End Points",
          "statistical-analysis": "Statistical Analysis",
          discussion: "Discussion",
        },
      },
      "himss-poster": {
        name: "HIMSS Poster",
        description:
          "HIMSS conference poster -- concise panels for background, methods, key findings, and impact statement",
        sections: {
          background: "Background",
          "problem-statement": "Problem Statement",
          objectives: "Objectives",
          methods: "Methods",
          "key-findings": "Key Findings",
          "clinical-impact": "Clinical and Operational Impact",
          "next-steps": "Next Steps",
        },
      },
    },
  },
};

export const publishCareGapRiskResources: Record<string, MessageTree> = {
  "en-US": enPublishCareGapRisk,
  "es-ES": mergeMessageTrees(enPublishCareGapRisk, {}),
  "fr-FR": mergeMessageTrees(enPublishCareGapRisk, {}),
  "de-DE": mergeMessageTrees(enPublishCareGapRisk, {}),
  "pt-BR": mergeMessageTrees(enPublishCareGapRisk, {}),
  "fi-FI": mergeMessageTrees(enPublishCareGapRisk, {}),
  "ja-JP": mergeMessageTrees(enPublishCareGapRisk, {}),
  "zh-Hans": mergeMessageTrees(enPublishCareGapRisk, {}),
  "ko-KR": mergeMessageTrees(enPublishCareGapRisk, {}),
  "hi-IN": mergeMessageTrees(enPublishCareGapRisk, {}),
  ar: mergeMessageTrees(enPublishCareGapRisk, {}),
  "en-XA": mergeMessageTrees(enPublishCareGapRisk, {}),
};
