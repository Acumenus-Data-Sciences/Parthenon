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

const frPublishCareGapRisk: MessageTree = mergeMessageTrees(
  enPublishCareGapRisk,
  {
    riskScores: {
      common: {
        status: {
          draft: "Brouillon",
          pending: "En attente",
          running: "En cours",
          completed: "Termine",
          failed: "Echec",
        },
        tier: {
          low: "Faible",
          intermediate: "Intermediaire",
          high: "Eleve",
          veryHigh: "Tres eleve",
          uncomputable: "Incalculable",
          filtered: "Filtre",
          customFilter: "Filtre personnalise",
        },
        category: {
          cardiovascular: "Cardiovasculaire",
          comorbidityBurden: "Charge de comorbidites",
          hepatic: "Hepatique",
          pulmonary: "Pulmonaire",
          respiratory: "Respiratoire",
          metabolic: "Metabolique",
          endocrine: "Endocrinien",
          musculoskeletal: "Musculosquelettique",
        },
        tabs: {
          overview: "Apercu",
          results: "Resultats",
          patients: "Patients",
          recommendations: "Recommandations",
          configuration: "Configuration",
        },
        actions: {
          back: "Retour",
          close: "Fermer",
          cancel: "Annuler",
          clear: "Effacer",
          refresh: "Actualiser",
          reRun: "Relancer",
          reRunAnalysis: "Relancer l'analyse",
          runAnalysis: "Executer l'analyse",
          quickRun: "Execution rapide",
          createAnalysis: "Creer une analyse",
          createCohort: "Creer une cohorte",
          createCohortFromFilter: "Creer une cohorte depuis le filtre",
          newAnalysis: "Nouvelle analyse",
          duplicateAnalysis: "Dupliquer l'analyse",
          deleteAnalysis: "Supprimer l'analyse",
          openCatalogue: "Ouvrir le catalogue",
          viewFullResults: "Voir les resultats complets",
        },
        values: {
          noneSelected: "Aucune selection",
          noDescription: "Aucune description",
          unknown: "Inconnu",
          yes: "Oui",
          no: "Non",
        },
        view: {
          table: "Vue tableau",
          card: "Vue cartes",
        },
        search: {
          analysesPlaceholder: "Rechercher des analyses...",
          noMatch: "Aucune analyse ne correspond a \"{{query}}\"",
          typeToFilter: "Saisissez pour filtrer {{count}} analyses",
        },
        count: {
          cohort_one: "{{count}} cohorte",
          cohort_other: "{{count}} cohortes",
          score_one: "{{count}} score",
          score_other: "{{count}} scores",
          analysis_one: "{{count}} analyse",
          analysis_other: "{{count}} analyses",
          patient_one: "{{count}} patient",
          patient_other: "{{count}} patients",
        },
        duration: {
          seconds: "{{value}} s",
          minutesSeconds: "{{minutes}} min {{seconds}} s",
          total: "{{value}} au total",
        },
        headers: {
          name: "Nom",
          cohort: "Cohorte",
          scores: "Scores",
          status: "Statut",
          lastRun: "Derniere execution",
          author: "Auteur",
          created: "Cree",
          tier: "Niveau",
          count: "Nombre",
          meanScore: "Score moyen",
          confidence: "Confiance",
          score: "Score",
          value: "Valeur",
          riskTier: "Niveau de risque",
          completeness: "Completude",
          missing: "Manquant",
          started: "Debut",
          duration: "Duree",
          actions: "Actions",
        },
        pagination: {
          showingRange: "Affichage de {{from}} a {{to}} sur {{total}}",
        },
      },
      hub: {
        title: "Analyses de scores de risque",
        subtitle:
          "Stratifier les populations de patients a l'aide de scores cliniques valides",
        metrics: {
          total: "Total",
          running: "En cours",
          completed: "Terminees",
          scoresAvailable: "Scores disponibles",
          patientsScored: "Patients notes",
        },
        filters: {
          status: "Statut",
          category: "Categorie",
          allCategories: "Toutes les categories",
        },
        tabs: {
          analyses: "Analyses",
          scoreCatalogue: "Catalogue des scores",
        },
        empty: {
          noMatchingAnalyses: "Aucune analyse correspondante",
          noRiskScoreAnalysesYet: "Aucune analyse de score de risque pour l'instant",
          noAnalysesFoundFor: "Aucune analyse trouvee pour \"{{query}}\"",
          createFirst:
            "Creez votre premiere analyse pour stratifier les patients par scores cliniques de risque.",
        },
        errors: {
          failedToLoadAnalyses:
            "Echec du chargement des analyses. Veuillez reessayer.",
        },
        catalogue: {
          checkingEligibility: "Verification de l'eligibilite...",
          showingEligibilityFor: "Affichage de l'eligibilite pour {{source}}",
          eligibleSummary: "{{eligible}} scores eligibles sur {{total}}",
          completedResults: "{{count}} resultats termines",
          selectSourcePrompt:
            "Selectionnez une source de donnees dans l'en-tete pour verifier l'eligibilite de chaque score.",
          sourceLevelCompletedScores:
            "Scores termines au niveau de la source",
          sourceLevelCompletedScoresDetail:
            "{{count}} score termine existe pour la source active mais n'est rattache a aucune execution d'analyse v2.",
          sourceLevelCompletedScoresDetail_other:
            "{{count}} scores termines existent pour la source active mais ne sont rattaches a aucune execution d'analyse v2.",
          eligibleCount: "{{count}} eligibles",
          completedCount: "{{count}} termines",
        },
      },
      create: {
        title: "Nouvelle analyse de score de risque",
        subtitle:
          "Configurer une analyse de notation du risque et selectionner les scores a calculer",
        steps: {
          configure: "Configurer",
          reviewAndRun: "Verifier et executer",
        },
        basics: "Bases",
        name: "Nom *",
        description: "Description",
        targetCohort: "Cohorte cible *",
        selectCohort: "Selectionner une cohorte...",
        scoreSelection: "Selection des scores",
        cohortPatients: "{{count}} patients",
        autoNameSuffix: "Stratification du risque",
        placeholders: {
          name: "par ex. Cohorte insuffisance cardiaque - Stratification du risque",
          description:
            "Description facultative de cette analyse de score de risque...",
        },
        completeness: "Completude :",
        createAsDraft: "Creer comme brouillon",
        createAndRun: "Creer et executer",
        errors: {
          executionFailed:
            "Analyse creee mais execution echouee. Vous pouvez la relancer depuis la page de detail.",
          createFailed:
            "Echec de la creation de l'analyse. Veuillez reessayer.",
        },
        recommendations: {
          recommended: "Recommande",
          available: "Disponible",
          notApplicable: "Non applicable",
        },
      },
      detail: {
        notFound: "Analyse introuvable",
        backToRiskScores: "Retour aux scores de risque",
        selectSourcePrompt:
          "Selectionnez une source de donnees pour executer ou consulter les resultats.",
        deleteConfirm:
          "Voulez-vous vraiment supprimer cette analyse ? Cette action est irreversible.",
      },
      overview: {
        about: "A propos",
        author: "Auteur : {{value}}",
        created: "Cree : {{value}}",
        updated: "Mis a jour : {{value}}",
        resultsSummary: "Resume des resultats",
        scoresComputed: "Scores calcules",
        uniqueScores: "scores uniques",
        patientsScored: "Patients notes",
        maxPerScore: "max par score",
        avgCompleteness: "Completude moy.",
        avgConfidence: "Confiance moy.",
        acrossSummaries: "sur l'ensemble des resumes",
        thisAnalysisHasNotBeenExecutedYet:
          "Cette analyse n'a pas encore ete executee.",
        executionInProgress: "Execution en cours...",
        lastExecutionFailed: "La derniere execution a echoue.",
        recentExecution: "Execution recente",
        started: "Debut",
        completed: "Terminee",
        duration: "Duree",
      },
      configuration: {
        analysisDesign: "Conception de l'analyse",
        targetCohorts: "Cohortes cibles",
        selectedScores: "Scores selectionnes",
        parameters: "Parametres",
        minCompleteness: "Completude min. :",
        storePatientLevel: "Conserver le niveau patient :",
        executionHistory: "Historique d'execution",
        noExecutionsYet: "Aucune execution pour l'instant",
      },
      results: {
        noResultsAvailable:
          "Aucun resultat disponible. Executez l'analyse pour calculer les scores de risque.",
        allScores: "Tous les scores",
        percentOfTotal: "% du total",
        action: "Action",
        averageCompleteness: "Completude moyenne :",
      },
      patients: {
        noExecutionSelected: "Aucune execution selectionnee",
        runExecutionToViewPatientLevel:
          "Lancez une execution pour afficher les resultats au niveau patient.",
        all: "Tous",
        showingPatients: "{{count}} patients affiches",
        patientsOnPage: "{{count}} patients sur cette page",
        noPatientResultsAvailable: "Aucun resultat patient disponible",
        adjustFilters: "Essayez d'ajuster vos filtres pour voir les resultats.",
        executeToGenerate:
          "Executez l'analyse pour generer les scores au niveau patient.",
        personId: "ID personne",
      },
      scoreDetail: {
        selectSourcePrompt:
          "Selectionnez une source de donnees dans l'en-tete pour verifier l'eligibilite.",
        eligiblePatients:
          "Eligible - {{count}} patients disposent de donnees suffisantes",
        insufficientData: "Donnees insuffisantes dans la source active",
        missing: "Manquant :",
        checkingEligibility:
          "Verification de l'eligibilite pour la source active...",
        eligiblePopulation: "Population eligible",
        requiredComponents: "Composants requis",
        cdmTablesUsed: "Tables CDM utilisees",
        riskTierDefinitions: "Definitions des niveaux de risque",
        scoreRange: "Plage de score",
      },
      createCohort: {
        title: "Creer une cohorte a partir du niveau de risque",
        cohortName: "Nom de la cohorte",
        description: "Description",
        patientsIncluded: "{{count}} patients seront inclus",
        showDetails: "Afficher les details",
        hideDetails: "Masquer les details",
        analysisId: "ID analyse :",
        executionId: "ID execution :",
        score: "Score :",
        tier: "Niveau :",
        createFailed:
          "Echec de la creation de la cohorte. Veuillez reessayer.",
        derivedDescription:
          "Patients de la cohorte '{{cohort}}' avec le niveau de risque {{score}} = {{tier}}",
        defaultName: "{{score}} - Risque {{tier}} - {{cohort}}",
      },
      recommendations: {
        selectSourceToView:
          "Selectionnez une source pour voir les recommandations",
        recommended: "Recommande",
        available: "Disponible",
        notApplicable: "Non applicable",
      },
      runModal: {
        title: "Scores de risque populationnels",
        computingScores: "Calcul des scores...",
        completedScoresIn: "{{count}} score termine en {{duration}}",
        completedScoresIn_other:
          "{{count}} scores termines en {{duration}}",
        runFailed: "Execution echouee",
        passed: "{{count}} reussis",
        failed: "{{count}} echecs",
        skipped: "{{count}} ignores",
        seconds: "secondes",
        tiers: "{{count}} niveaux",
      },
      tierBreakdown: {
        tierDistribution: "Distribution des niveaux",
        patientsPerTier: "Patients par niveau",
        patients: "Patients",
      },
      cohortProfile: {
        demographics: "Demographie",
        patients: "patients",
        age: "Age",
        female: "{{count}} % de femmes",
        topConditions: "Principales affections",
        measurementCoverage: "Couverture des mesures",
      },
    },
    careGaps: {
      common: {
        status: {
          pending: "En attente",
          running: "En cours",
          completed: "Termine",
          failed: "Echec",
        },
        actions: {
          newBundle: "Nouveau lot",
          delete: "Supprimer",
          evaluate: "Evaluer",
          backToList: "Retour a la liste",
          saveChanges: "Enregistrer les modifications",
          createBundle: "Creer le lot",
        },
        category: {
          all: "Toutes",
          endocrine: "Endocrinien",
          cardiovascular: "Cardiovasculaire",
          respiratory: "Respiratoire",
          mentalHealth: "Sante mentale",
          rheumatologic: "Rhumatologique",
          neurological: "Neurologique",
          oncology: "Oncologie",
        },
        bundle: {
          active: "Actif",
          inactive: "Inactif",
          measure_one: "{{count}} mesure",
          measure_other: "{{count}} mesures",
        },
      },
      page: {
        title: "Lacunes de soins",
        subtitle:
          "Lots de pathologies, mesures de qualite et suivi de conformite populationnelle",
        untitledBundle: "Lot sans titre",
        tabs: {
          bundles: "Lots de maladies",
          population: "Apercu populationnel",
        },
      },
      bundleList: {
        searchPlaceholder: "Rechercher des lots...",
        allCategories: "Toutes les categories",
        sortName: "Nom",
        sortCompliance: "Conformite",
        noBundlesFound: "Aucun lot trouve",
        adjustFilters: "Essayez d'ajuster vos filtres",
        createToGetStarted: "Creez un lot pour commencer",
      },
      bundleDetail: {
        failedToLoad: "Echec du chargement du lot",
        backToCareGaps: "Lacunes de soins",
        overallCompliance: "Conformite globale",
        tabs: {
          design: "Conception",
          compliance: "Resultats de conformite",
          overlap: "Regles de chevauchement",
        },
        executeEvaluation: "Executer l'evaluation",
        overall: "Global",
        totalPatients: "Patients totaux",
        gapsMet: "Lacunes comblees",
        openGaps: "Lacunes ouvertes",
        excluded: "Exclus",
        evaluationHistory: "Historique des evaluations",
        sourceLabel: "Source n{{value}}",
        evaluationInProgress: "Evaluation en cours...",
        noEvaluationResults:
          "Aucun resultat d'evaluation pour l'instant. Executez une evaluation pour voir les donnees de conformite.",
        deleteConfirm:
          "Voulez-vous vraiment supprimer ce lot de pathologies ?",
      },
      bundleDesigner: {
        bundleDetails: "Details du lot",
        bundleCode: "Code du lot",
        conditionName: "Nom de la pathologie",
        description: "Description",
        diseaseCategory: "Categorie de maladie",
        selectCategory: "Selectionner une categorie...",
        icd10Patterns: "Motifs ICD-10",
        omopConceptIds: "IDs de concepts OMOP",
        ecqmReferences: "References eCQM",
        attachedMeasures: "Mesures rattachees",
        noMeasuresAttached: "Aucune mesure rattachee a ce lot.",
        saveBundle: "Enregistrer le lot",
        saving: "Enregistrement...",
        add: "Ajouter",
        remove: "Retirer",
        placeholders: {
          bundleCode: "par ex. DM2-BUNDLE",
          conditionName: "par ex. Diabete de type 2",
          description: "Decrire le lot...",
          icd10: "par ex. E11%",
          conceptId: "Saisir l'ID concept",
          ecqm: "par ex. CMS122v11",
        },
      },
      measureCompliance: {
        noResultsAvailable: "Aucun resultat de mesure disponible pour l'instant.",
        code: "Code",
        measure: "Mesure",
        domain: "Domaine",
        eligible: "Eligible",
        met: "Respectee",
        notMet: "Non respectee",
        compliance: "Conformite",
        deduplicated: "Dedupliquee",
        deduplicatedFrom: "Dedupliquee depuis : {{value}}",
      },
      population: {
        selectSourcePrompt:
          "Selectionnez une source de donnees pour afficher la conformite populationnelle.",
        failedToLoad:
          "Echec du chargement du resume populationnel.",
        totalBundles: "Nombre total de lots",
        totalPatients: "Patients totaux",
        avgCompliance: "Conformite moy.",
        totalOpenGaps: "Total des lacunes ouvertes",
        filterByCategory: "Filtrer par categorie :",
        bundleComplianceComparison: "Comparaison de conformite des lots",
        noBundlesMatchFilter:
          "Aucun lot ne correspond au filtre selectionne.",
        patientsShort: "{{count}} pts",
      },
      overlapRules: {
        failedToLoad:
          "Echec du chargement des regles de chevauchement.",
        noneConfigured: "Aucune regle de chevauchement configuree.",
        subtitle:
          "Les regles de chevauchement evitent le double comptage des mesures entre les lots.",
      },
    },
    publish: {
      steps: {
        selectAnalyses: "Selectionner les analyses",
        configure: "Configurer",
        preview: "Apercu",
        export: "Exporter",
      },
      common: {
        actions: {
          back: "Retour",
          next: "Suivant",
          previewDocument: "Apercu du document ->",
          configureDocument: "Configurer le document ->",
          close: "Fermer",
        },
        sectionType: {
          title: "Titre",
          methods: "Methodes",
          results: "Resultats",
          diagram: "Diagramme",
          discussion: "Discussion",
          diagnostics: "Diagnostics",
        },
        analysisType: {
          characterizations: "Caracterisation",
          characterization: "Caracterisation",
          estimations: "Estimation",
          estimation: "Estimation",
          predictions: "Prediction",
          prediction: "Prediction",
          incidence_rates: "Taux d'incidence",
          incidence_rate: "Taux d'incidence",
          evidence_synthesis: "Synthese des preuves",
          pathways: "Parcours",
          pathway: "Parcours",
        },
        resultSection: {
          populationCharacteristics: "Caracteristiques de la population",
          incidenceRates: "Taux d'incidence",
          comparativeEffectiveness: "Efficacite comparative",
          treatmentPatterns: "Schemas therapeutiques",
          safetyAnalysis: "Analyse de securite",
          predictiveModeling: "Modelisation predictive",
          evidenceSynthesis: "Synthese des preuves",
        },
      },
      page: {
        title: "Publier",
        subtitle:
          "Creer des manuscrits de prepublication a partir d'etudes et d'analyses",
        startNewDocument: "Commencer un nouveau document",
        untitledDocument: "Document sans titre",
      },
      cart: {
        selected: "Selectionnes ({{count}})",
        empty: "Aucune analyse selectionnee pour l'instant",
        removeAnalysis: "Retirer {{name}}",
      },
      configurator: {
        documentTitle: "Titre du document",
        documentTitlePlaceholder: "Saisir le titre du document...",
        authors: "Auteurs (separes par des virgules)",
        authorsPlaceholder: "Auteur Un, Auteur Deux...",
        template: "Modele",
      },
      preview: {
        diagramDataNotAvailable:
          "Donnees de diagramme indisponibles",
        unknownDiagramType: "Type de diagramme inconnu",
        reviewWarning:
          "Certaines sections generees par IA n'ont pas encore ete revues. Veuillez accepter ou modifier tout le contenu IA avant l'export.",
        generatedLabel: "Genere le {{date}}",
        noSectionContent:
          "Aucun contenu disponible pour cette section.",
        noSectionsIncluded:
          "Aucune section incluse. Revenez en arriere pour configurer votre document.",
        backToConfigure: "Retour a la configuration",
        export: "Exporter",
      },
      exportControls: {
        exportFormat: "Format d'export",
        comingSoon: "Bientot disponible",
        exporting: "Export en cours...",
        exportAs: "Exporter en {{format}}",
        formats: {
          pdf: {
            description: "Rapport complet formate via la boite d'impression",
          },
          docx: {
            description: "Document Word structure",
          },
          xlsx: {
            description: "Tableaux et statistiques sous forme de feuille de calcul",
          },
          png: {
            description: "Graphiques sous forme d'images raster",
          },
          svg: {
            description: "Graphiques sous forme de fichiers vectoriels",
          },
        },
      },
      exportPanel: {
        draftWarning:
          "Certaines sections generees par IA sont encore a l'etat de brouillon. Revenez en arriere et acceptez ou modifiez tout le contenu IA avant l'export.",
        chooseExportFormat: "Choisir le format d'export",
        exporting: "Export en cours...",
        exportAs: "Exporter en {{format}}",
        backToPreview: "Retour a l'apercu",
        formats: {
          docx: {
            label: "Microsoft Word",
            description:
              "Manuscrit pret pour revue avec figures integrees",
          },
          pdf: {
            label: "Document PDF",
            description:
              "Document pret a imprimer pour relecture et partage",
          },
          figuresZip: {
            label: "Figures individuelles",
            description:
              "Fichiers SVG pour televersement separe dans une revue",
          },
        },
      },
      methods: {
        studyDesign: "Plan d'etude",
        primaryObjective: "Objectif principal",
        hypothesis: "Hypothese",
        scientificRationale: "Justification scientifique",
        cohortDefinitions: "Definitions de cohortes",
        target: "Cible",
        comparator: "Comparateur",
        outcome: "Resultat",
        timeAtRisk: "Temps a risque",
        start: "Debut",
        end: "Fin",
        matchingStrategy: "Strategie d'appariement",
        modelSettings: "Parametres du modele",
        empty:
          "Aucune donnee de methodes disponible. Les methodes seront generees automatiquement lorsque les parametres d'analyse seront fournis.",
        defaults: {
          observational: "Observationnelle",
          cohortStart: "debut de cohorte",
          cohortEnd: "fin de cohorte",
        },
      },
      reportPreview: {
        title: "Apercu du rapport d'etude",
        subtitle:
          "Activez ou desactivez les sections et reordonnez-les avec les controles. Seules les sections incluses apparaitront dans l'export.",
        empty:
          "Aucune section a previsualiser. Revenez en arriere et selectionnez les executions d'analyse.",
      },
      reportSection: {
        moveUp: "Monter",
        moveDown: "Descendre",
        diagnosticsPlaceholder:
          "Les donnees de diagnostic seront restituees dans le rapport exporte.",
        includeSection: "Inclure la section",
        excludeSection: "Exclure la section",
        included: "Incluse",
        excluded: "Exclue",
      },
      resultsSummary: {
        empty: "Aucune donnee de resultat disponible pour cette execution.",
      },
      resultsTable: {
        empty: "Aucune donnee structuree disponible pour ce tableau.",
        caption: "Tableau {{number}}. {{title}}",
      },
      sectionEditor: {
        tableLabel: "Tableau",
        aiNarrative: "Narratif IA",
        structuredData: "Donnees structurees",
        hideTable: "Masquer le tableau",
        showTable: "Afficher le tableau",
        hideNarrative: "Masquer le narratif",
        showNarrative: "Afficher le narratif",
        hideDiagram: "Masquer le diagramme",
        showDiagram: "Afficher le diagramme",
        noDiagram: "Aucun diagramme genere pour l'instant",
      },
      studySelector: {
        loadingStudies: "Chargement des etudes...",
        failedToLoad:
          "Echec du chargement des etudes. Veuillez reessayer.",
        selectStudy: "Selectionner une etude",
        noStudiesFound: "Aucune etude trouvee. Creez d'abord une etude.",
        completedExecutions: "Executions terminees",
        loadingExecutions: "Chargement des executions...",
        noCompletedExecutions:
          "Aucune execution terminee trouvee pour cette etude.",
        executionLabel: "Execution n{{value}}",
      },
      analysisPicker: {
        filter: {
          allTypes: "Tous les types",
        },
        searchAnalyses: "Rechercher des analyses...",
        searchStudies: "Rechercher des etudes...",
        tabs: {
          allAnalyses: "Toutes les analyses",
          fromStudies: "Depuis les etudes",
        },
        loadingAnalyses: "Chargement des analyses...",
        noCompletedAnalyses: "Aucune analyse terminee trouvee",
        loadingStudies: "Chargement des etudes...",
        noStudiesMatchFilters:
          "Aucune etude ne correspond a vos filtres",
        noStudiesFound: "Aucune etude trouvee",
        completedAnalyses_one: "{{count}} analyse terminee",
        completedAnalyses_other: "{{count}} analyses terminees",
        actions: {
          selectAll: "Tout selectionner",
          deselectAll: "Tout deselectionner",
        },
      },
      aiNarrative: {
        generate: "Generer un brouillon IA",
        generating: "Generation du narratif...",
        draft: "Brouillon IA",
        accept: "Accepter",
        regenerate: "Regenerer",
        accepted: "Accepte",
        edit: "Modifier",
      },
      structuredData: {
        empty: "Aucune donnee structuree disponible",
      },
      diagram: {
        exportSvg: "Exporter en SVG",
        exportPng: "Exporter en PNG",
      },
      tables: {
        captions: {
          incidenceRatesByCohort: "Taux d'incidence par cohorte",
          comparativeEffectivenessEstimates:
            "Estimations d'efficacite comparative",
          sccsEstimates:
            "Serie de cas auto-controlee : rapports de taux d'incidence par fenetre d'exposition",
          treatmentPathways: "Parcours therapeutiques (top 10)",
          populationCharacteristics: "Caracteristiques de la population",
          predictionModelPerformance:
            "Performance du modele de prediction",
          evidenceSynthesisPooled:
            "Synthese des preuves : estimations combinees",
        },
        headers: {
          cohort: "Cohorte",
          outcome: "Resultat",
          events: "Evenements",
          personYears: "Personnes-annees",
          exposureWindow: "Fenetre d'exposition",
          pathway: "Parcours",
          patients: "Patients",
          percentFemale: "% femmes",
          percentMale: "% hommes",
          ageGroup: "Tranche d'age",
          model: "Modele",
          targetN: "N cible",
          outcomeN: "N resultat",
          analysis: "Analyse",
          pooledEstimate: "Estimation combinee",
        },
      },
      templates: {
        "generic-ohdsi": {
          name: "Publication OHDSI generique",
          description:
            "Structure IMRaD standard pour les etudes observationnelles en donnees de sante",
          sections: {
            introduction: "Introduction",
            methods: "Methodes",
            discussion: "Discussion",
          },
        },
        "comparative-effectiveness": {
          name: "Rapport d'efficacite comparative",
          description:
            "Structure CLE/CER avec analyse par score de propension",
          sections: {
            background: "Contexte",
            "study-design": "Plan d'etude",
            "ps-matching": "Appariement par score de propension",
            covariates: "Equilibre des covariables",
            "sensitivity-analyses": "Analyses de sensibilite",
            discussion: "Discussion",
          },
        },
        "incidence-report": {
          name: "Rapport de taux d'incidence",
          description: "Analyse d'incidence basee sur la population",
          sections: {
            background: "Contexte",
            methods: "Methodes",
            discussion: "Discussion",
          },
        },
        "study-protocol": {
          name: "Protocole d'etude / SAP",
          description:
            "Plan d'analyse statistique avant etude - aucun resultat requis",
          sections: {
            objectives: "Objectifs",
            hypotheses: "Hypotheses",
            "study-design": "Plan d'etude",
            "data-sources": "Sources de donnees",
            "cohort-definitions": "Definitions de cohortes",
            "analysis-plan": "Plan d'analyse",
            timeline: "Chronologie",
          },
        },
        "jamia-style": {
          name: "Style JAMIA",
          description:
            "Journal of the American Medical Informatics Association - focus methodologique en informatique avec exigence de reproductibilite",
          sections: {
            "background-significance": "Contexte et importance",
            objective: "Objectif",
            "materials-methods": "Materiels et methodes",
            "data-sources": "Sources de donnees et population d'etude",
            "phenotype-definitions": "Definitions des phenotypes",
            "statistical-analysis": "Analyse statistique",
            discussion: "Discussion",
            limitations: "Limites",
            conclusion: "Conclusion",
          },
        },
        "lancet-style": {
          name: "Style Lancet",
          description:
            "The Lancet - accent sante mondiale avec methodes structurees, interpretation fondee sur les preuves et implications politiques",
          sections: {
            introduction: "Introduction",
            methods: "Methodes",
            "study-design-participants": "Plan d'etude et participants",
            procedures: "Procedures",
            outcomes: "Resultats",
            "statistical-analysis": "Analyse statistique",
            "role-of-funding": "Role de la source de financement",
            discussion: "Discussion",
          },
        },
        "nejm-style": {
          name: "Style NEJM",
          description:
            "New England Journal of Medicine - structure a fort impact clinique avec exigence de concision",
          sections: {
            introduction: "Introduction",
            methods: "Methodes",
            "study-design": "Plan d'etude et supervision",
            patients: "Patients",
            endpoints: "Criteres de jugement",
            "statistical-analysis": "Analyse statistique",
            discussion: "Discussion",
          },
        },
        "himss-poster": {
          name: "Poster HIMSS",
          description:
            "Poster de conference HIMSS - panneaux concis pour le contexte, les methodes, les resultats cles et l'impact",
          sections: {
            background: "Contexte",
            "problem-statement": "Problematique",
            objectives: "Objectifs",
            methods: "Methodes",
            "key-findings": "Resultats cles",
            "clinical-impact": "Impact clinique et operationnel",
            "next-steps": "Prochaines etapes",
          },
        },
      },
    },
  },
);

const dePublishCareGapRisk: MessageTree = mergeMessageTrees(
  enPublishCareGapRisk,
  {
    riskScores: {
      common: {
        status: {
          draft: "Entwurf",
          pending: "Ausstehend",
          running: "Laufend",
          completed: "Abgeschlossen",
          failed: "Fehlgeschlagen",
        },
        tier: {
          low: "Niedrig",
          intermediate: "Mittel",
          high: "Hoch",
          veryHigh: "Sehr hoch",
          uncomputable: "Nicht berechenbar",
          filtered: "Gefiltert",
          customFilter: "Benutzerdefinierter Filter",
        },
        category: {
          cardiovascular: "Kardiovaskular",
          comorbidityBurden: "Komorbiditatslast",
          hepatic: "Hepatisch",
          pulmonary: "Pulmonal",
          respiratory: "Respiratorisch",
          metabolic: "Metabolisch",
          endocrine: "Endokrin",
          musculoskeletal: "Muskuloskelettal",
        },
        tabs: {
          overview: "Uberblick",
          results: "Ergebnisse",
          patients: "Patienten",
          recommendations: "Empfehlungen",
          configuration: "Konfiguration",
        },
        actions: {
          back: "Zuruck",
          close: "Schlieen",
          cancel: "Abbrechen",
          clear: "Loschen",
          refresh: "Aktualisieren",
          reRun: "Erneut ausfuhren",
          reRunAnalysis: "Analyse erneut ausfuhren",
          runAnalysis: "Analyse ausfuhren",
          quickRun: "Schnelllauf",
          createAnalysis: "Analyse erstellen",
          createCohort: "Kohorte erstellen",
          createCohortFromFilter: "Kohorte aus Filter erstellen",
          newAnalysis: "Neue Analyse",
          duplicateAnalysis: "Analyse duplizieren",
          deleteAnalysis: "Analyse loschen",
          openCatalogue: "Katalog offnen",
          viewFullResults: "Vollstandige Ergebnisse anzeigen",
        },
        values: {
          noneSelected: "Nichts ausgewahlt",
          noDescription: "Keine Beschreibung",
          unknown: "Unbekannt",
          yes: "Ja",
          no: "Nein",
        },
        view: {
          table: "Tabellenansicht",
          card: "Kartenansicht",
        },
        search: {
          analysesPlaceholder: "Analysen suchen...",
          noMatch: "Keine Analysen entsprechen \"{{query}}\"",
          typeToFilter: "{{count}} Analysen durch Eingabe filtern",
        },
        count: {
          cohort_one: "{{count}} Kohorte",
          cohort_other: "{{count}} Kohorten",
          score_one: "{{count}} Score",
          score_other: "{{count}} Scores",
          analysis_one: "{{count}} Analyse",
          analysis_other: "{{count}} Analysen",
          patient_one: "{{count}} Patient",
          patient_other: "{{count}} Patienten",
        },
        duration: {
          seconds: "{{value}} Sek.",
          minutesSeconds: "{{minutes}} Min. {{seconds}} Sek.",
          total: "{{value}} gesamt",
        },
        headers: {
          name: "Name",
          cohort: "Kohorte",
          scores: "Scores",
          status: "Status",
          lastRun: "Letzter Lauf",
          author: "Autor",
          created: "Erstellt",
          tier: "Stufe",
          count: "Anzahl",
          meanScore: "Mittlerer Score",
          confidence: "Konfidenz",
          value: "Wert",
          riskTier: "Risikostufe",
          completeness: "Vollstandigkeit",
          missing: "Fehlend",
          started: "Gestartet",
          duration: "Dauer",
          actions: "Aktionen",
        },
        pagination: {
          showingRange: "Zeige {{from}}-{{to}} von {{total}}",
        },
      },
      hub: {
        title: "Risiko-Score-Analysen",
        subtitle:
          "Patientenpopulationen mit validierten klinischen Risikoscores stratifizieren",
        metrics: {
          total: "Gesamt",
          running: "Laufend",
          completed: "Abgeschlossen",
          scoresAvailable: "Verfugbare Scores",
          patientsScored: "Bewertete Patienten",
        },
        filters: {
          status: "Status",
          category: "Kategorie",
          allCategories: "Alle Kategorien",
        },
        tabs: {
          analyses: "Analysen",
          scoreCatalogue: "Score-Katalog",
        },
        empty: {
          noMatchingAnalyses: "Keine passenden Analysen",
          noRiskScoreAnalysesYet: "Noch keine Risiko-Score-Analysen",
          noAnalysesFoundFor: "Keine Analysen fur \"{{query}}\" gefunden",
          createFirst:
            "Erstellen Sie Ihre erste Analyse, um Patienten nach klinischen Risikoscores zu stratifizieren.",
        },
        errors: {
          failedToLoadAnalyses:
            "Analysen konnten nicht geladen werden. Bitte erneut versuchen.",
        },
        catalogue: {
          checkingEligibility: "Eignung wird gepruft...",
          showingEligibilityFor: "Eignung fur {{source}} wird angezeigt",
          eligibleSummary: "{{eligible}} von {{total}} Scores geeignet",
          completedResults: "{{count}} abgeschlossene Ergebnisse",
          selectSourcePrompt:
            "Wahlen Sie im Kopfbereich eine Datenquelle aus, um die Eignung jedes Scores zu prufen.",
          sourceLevelCompletedScores:
            "Abgeschlossene Scores auf Quellenebene",
          sourceLevelCompletedScoresDetail:
            "{{count}} abgeschlossener Score existiert fur die aktive Quelle, ist aber keiner v2-Analyseausfuhrung zugeordnet.",
          sourceLevelCompletedScoresDetail_other:
            "{{count}} abgeschlossene Scores existieren fur die aktive Quelle, sind aber keiner v2-Analyseausfuhrung zugeordnet.",
          eligibleCount: "{{count}} geeignet",
          completedCount: "{{count}} abgeschlossen",
        },
      },
      create: {
        title: "Neue Risiko-Score-Analyse",
        subtitle:
          "Eine Risikoanalyse konfigurieren und die zu berechnenden Scores auswahlen",
        steps: {
          configure: "Konfigurieren",
          reviewAndRun: "Prufen und ausfuhren",
        },
        basics: "Grundlagen",
        description: "Beschreibung",
        targetCohort: "Zielkohorte *",
        selectCohort: "Kohorte auswahlen...",
        scoreSelection: "Score-Auswahl",
        cohortPatients: "{{count}} Patienten",
        autoNameSuffix: "Risikostratifizierung",
        placeholders: {
          name:
            "z. B. Herzinsuffizienz-Kohorte - Risikostratifizierung",
          description:
            "Optionale Beschreibung dieser Risiko-Score-Analyse...",
        },
        completeness: "Vollstandigkeit:",
        createAsDraft: "Als Entwurf erstellen",
        createAndRun: "Erstellen und ausfuhren",
        errors: {
          executionFailed:
            "Analyse wurde erstellt, aber die Ausfuhrung ist fehlgeschlagen. Sie konnen sie auf der Detailseite erneut starten.",
          createFailed:
            "Analyse konnte nicht erstellt werden. Bitte erneut versuchen.",
        },
        recommendations: {
          recommended: "Empfohlen",
          available: "Verfugbar",
          notApplicable: "Nicht anwendbar",
        },
      },
      detail: {
        notFound: "Analyse nicht gefunden",
        backToRiskScores: "Zuruck zu Risiko-Scores",
        selectSourcePrompt:
          "Wahlen Sie eine Datenquelle aus, um die Ausfuhrung zu starten oder Ergebnisse anzuzeigen.",
        deleteConfirm:
          "Mochten Sie diese Analyse wirklich loschen? Diese Aktion kann nicht ruckgangig gemacht werden.",
      },
      overview: {
        about: "Info",
        author: "Autor: {{value}}",
        created: "Erstellt: {{value}}",
        updated: "Aktualisiert: {{value}}",
        resultsSummary: "Ergebnisubersicht",
        scoresComputed: "Berechnete Scores",
        uniqueScores: "einzigartige Scores",
        patientsScored: "Bewertete Patienten",
        maxPerScore: "max pro Score",
        avgCompleteness: "Durchschn. Vollstandigkeit",
        avgConfidence: "Durchschn. Konfidenz",
        acrossSummaries: "uber alle Zusammenfassungen",
        thisAnalysisHasNotBeenExecutedYet:
          "Diese Analyse wurde noch nicht ausgefuhrt.",
        executionInProgress: "Ausfuhrung lauft...",
        lastExecutionFailed: "Die letzte Ausfuhrung ist fehlgeschlagen.",
        recentExecution: "Letzte Ausfuhrung",
        started: "Gestartet",
        completed: "Abgeschlossen",
        duration: "Dauer",
      },
      configuration: {
        analysisDesign: "Analysedesign",
        targetCohorts: "Zielkohorten",
        selectedScores: "Ausgewahlte Scores",
        parameters: "Parameter",
        minCompleteness: "Min. Vollstandigkeit:",
        storePatientLevel: "Patientenebene speichern:",
        executionHistory: "Ausfuhrungshistorie",
        noExecutionsYet: "Noch keine Ausfuhrungen",
      },
      results: {
        noResultsAvailable:
          "Keine Ergebnisse verfugbar. Fuhren Sie die Analyse aus, um Risikoscores zu berechnen.",
        allScores: "Alle Scores",
        percentOfTotal: "% des Gesamtwerts",
        action: "Aktion",
        averageCompleteness: "Durchschnittliche Vollstandigkeit:",
      },
      patients: {
        noExecutionSelected: "Keine Ausfuhrung ausgewahlt",
        runExecutionToViewPatientLevel:
          "Fuhren Sie eine Ausfuhrung aus, um Ergebnisse auf Patientenebene anzuzeigen.",
        all: "Alle",
        showingPatients: "{{count}} Patienten angezeigt",
        patientsOnPage: "{{count}} Patienten auf dieser Seite",
        noPatientResultsAvailable: "Keine Patientenergebnisse verfugbar",
        adjustFilters:
          "Passen Sie Ihre Filter an, um Ergebnisse anzuzeigen.",
        executeToGenerate:
          "Fuhren Sie die Analyse aus, um Scores auf Patientenebene zu erzeugen.",
        personId: "Personen-ID",
      },
      scoreDetail: {
        selectSourcePrompt:
          "Wahlen Sie im Kopfbereich eine Datenquelle aus, um die Eignung zu prufen.",
        eligiblePatients:
          "Geeignet - {{count}} Patienten verfugen uber ausreichende Daten",
        insufficientData:
          "Unzureichende Daten in der aktiven Quelle",
        missing: "Fehlend:",
        checkingEligibility:
          "Eignung fur die aktive Quelle wird gepruft...",
        eligiblePopulation: "Geeignete Population",
        requiredComponents: "Erforderliche Komponenten",
        cdmTablesUsed: "Verwendete CDM-Tabellen",
        riskTierDefinitions: "Definitionen der Risikostufen",
        scoreRange: "Score-Bereich",
      },
      createCohort: {
        title: "Kohorte aus Risikostufe erstellen",
        cohortName: "Kohortenname",
        description: "Beschreibung",
        patientsIncluded: "{{count}} Patienten werden eingeschlossen",
        showDetails: "Details anzeigen",
        hideDetails: "Details ausblenden",
        analysisId: "Analyse-ID:",
        executionId: "Ausfuhrungs-ID:",
        score: "Score:",
        tier: "Stufe:",
        createFailed:
          "Kohorte konnte nicht erstellt werden. Bitte erneut versuchen.",
        derivedDescription:
          "Patienten aus Kohorte '{{cohort}}' mit {{score}}-Risikostufe = {{tier}}",
        defaultName: "{{score}} - {{tier}}-Risiko - {{cohort}}",
      },
      recommendations: {
        selectSourceToView:
          "Wahlen Sie eine Quelle aus, um Empfehlungen anzuzeigen",
        recommended: "Empfohlen",
        available: "Verfugbar",
        notApplicable: "Nicht anwendbar",
      },
      runModal: {
        title: "Populations-Risikoscores",
        computingScores: "Scores werden berechnet...",
        completedScoresIn: "{{count}} Score in {{duration}} abgeschlossen",
        completedScoresIn_other:
          "{{count}} Scores in {{duration}} abgeschlossen",
        runFailed: "Ausfuhrung fehlgeschlagen",
        passed: "{{count}} erfolgreich",
        failed: "{{count}} fehlgeschlagen",
        skipped: "{{count}} ubersprungen",
        seconds: "Sekunden",
        tiers: "{{count}} Stufen",
      },
      tierBreakdown: {
        tierDistribution: "Verteilung der Stufen",
        patientsPerTier: "Patienten pro Stufe",
        patients: "Patienten",
      },
      cohortProfile: {
        demographics: "Demografie",
        patients: "Patienten",
        age: "Alter",
        female: "{{count}} % weiblich",
        topConditions: "Haufigste Erkrankungen",
        measurementCoverage: "Messabdeckung",
      },
    },
    careGaps: {
      common: {
        status: {
          pending: "Ausstehend",
          running: "Laufend",
          completed: "Abgeschlossen",
          failed: "Fehlgeschlagen",
        },
        actions: {
          newBundle: "Neues Bundle",
          delete: "Loschen",
          evaluate: "Bewerten",
          backToList: "Zuruck zur Liste",
          saveChanges: "Anderungen speichern",
          createBundle: "Bundle erstellen",
        },
        category: {
          all: "Alle",
          endocrine: "Endokrin",
          cardiovascular: "Kardiovaskular",
          respiratory: "Respiratorisch",
          mentalHealth: "Psychische Gesundheit",
          rheumatologic: "Rheumatologisch",
          neurological: "Neurologisch",
          oncology: "Onkologie",
        },
        bundle: {
          active: "Aktiv",
          inactive: "Inaktiv",
          measure_one: "{{count}} Metrik",
          measure_other: "{{count}} Metriken",
        },
      },
      page: {
        title: "Versorgungslucken",
        subtitle:
          "Krankheits-Bundles, Qualitatsmetriken und populationsbezogenes Compliance-Tracking",
        untitledBundle: "Unbenanntes Bundle",
        tabs: {
          bundles: "Krankheits-Bundles",
          population: "Populationsubersicht",
        },
      },
      bundleList: {
        searchPlaceholder: "Bundles suchen...",
        allCategories: "Alle Kategorien",
        sortName: "Name",
        sortCompliance: "Konformitat",
        noBundlesFound: "Keine Bundles gefunden",
        adjustFilters: "Passen Sie Ihre Filter an",
        createToGetStarted:
          "Erstellen Sie ein Bundle, um zu beginnen",
      },
      bundleDetail: {
        failedToLoad: "Bundle konnte nicht geladen werden",
        backToCareGaps: "Versorgungslucken",
        overallCompliance: "Gesamt-Compliance",
        tabs: {
          design: "Gestaltung",
          compliance: "Compliance-Ergebnisse",
          overlap: "Uberlappungsregeln",
        },
        executeEvaluation: "Bewertung ausfuhren",
        overall: "Gesamt",
        totalPatients: "Patienten insgesamt",
        gapsMet: "Geschlossene Lucken",
        openGaps: "Offene Lucken",
        excluded: "Ausgeschlossen",
        evaluationHistory: "Bewertungsverlauf",
        sourceLabel: "Quelle #{{value}}",
        evaluationInProgress: "Bewertung lauft...",
        noEvaluationResults:
          "Noch keine Bewertungsergebnisse. Fuhren Sie eine Bewertung aus, um Compliance-Daten anzuzeigen.",
        deleteConfirm:
          "Mochten Sie dieses Krankheits-Bundle wirklich loschen?",
      },
      bundleDesigner: {
        bundleDetails: "Bundle-Details",
        bundleCode: "Bundle-Code",
        conditionName: "Erkrankungsname",
        description: "Beschreibung",
        diseaseCategory: "Krankheitskategorie",
        selectCategory: "Kategorie auswahlen...",
        icd10Patterns: "ICD-10-Muster",
        omopConceptIds: "OMOP-Konzept-IDs",
        ecqmReferences: "eCQM-Referenzen",
        attachedMeasures: "Verknupfte Metriken",
        noMeasuresAttached:
          "Diesem Bundle sind keine Metriken zugeordnet.",
        saveBundle: "Bundle speichern",
        saving: "Speichern...",
        add: "Hinzufugen",
        remove: "Entfernen",
        placeholders: {
          bundleCode: "z. B. DM2-BUNDLE",
          conditionName: "z. B. Diabetes mellitus Typ 2",
          description: "Bundle beschreiben...",
          conceptId: "Konzept-ID eingeben",
        },
      },
      measureCompliance: {
        noResultsAvailable:
          "Noch keine Metrikergebnisse verfugbar.",
        measure: "Metrik",
        domain: "Domane",
        eligible: "Geeignet",
        met: "Erfullt",
        notMet: "Nicht erfullt",
        compliance: "Compliance",
        deduplicated: "Dedupliziert",
        deduplicatedFrom: "Dedupliziert aus: {{value}}",
      },
      population: {
        selectSourcePrompt:
          "Wahlen Sie eine Datenquelle aus, um die Populations-Compliance anzuzeigen.",
        failedToLoad:
          "Populationszusammenfassung konnte nicht geladen werden.",
        totalBundles: "Bundles gesamt",
        totalPatients: "Patienten gesamt",
        avgCompliance: "Durchschn. Compliance",
        totalOpenGaps: "Offene Lucken gesamt",
        filterByCategory: "Nach Kategorie filtern:",
        bundleComplianceComparison: "Bundle-Compliance-Vergleich",
        noBundlesMatchFilter:
          "Keine Bundles entsprechen dem ausgewahlten Filter.",
      },
      overlapRules: {
        failedToLoad:
          "Uberlappungsregeln konnten nicht geladen werden.",
        noneConfigured:
          "Keine Uberlappungsregeln konfiguriert.",
        subtitle:
          "Uberlappungsregeln verhindern Doppelzahlungen von Metriken uber Bundles hinweg.",
      },
    },
    publish: {
      steps: {
        selectAnalyses: "Analysen auswahlen",
        configure: "Konfigurieren",
        preview: "Vorschau",
        export: "Exportieren",
      },
      common: {
        actions: {
          back: "Zuruck",
          next: "Weiter",
          previewDocument: "Dokumentvorschau ->",
          configureDocument: "Dokument konfigurieren ->",
          close: "Schlieen",
        },
        sectionType: {
          title: "Titel",
          methods: "Methoden",
          results: "Ergebnisse",
          diagram: "Diagramm",
          discussion: "Diskussion",
          diagnostics: "Diagnostik",
        },
        analysisType: {
          characterizations: "Charakterisierung",
          characterization: "Charakterisierung",
          estimations: "Schatzung",
          estimation: "Schatzung",
          predictions: "Vorhersage",
          prediction: "Vorhersage",
          incidence_rates: "Inzidenzrate",
          incidence_rate: "Inzidenzrate",
          evidence_synthesis: "Evidenzsynthese",
          pathways: "Pfad",
          pathway: "Pfad",
        },
        resultSection: {
          populationCharacteristics: "Populationsmerkmale",
          incidenceRates: "Inzidenzraten",
          comparativeEffectiveness: "Vergleichende Wirksamkeit",
          treatmentPatterns: "Behandlungsmuster",
          safetyAnalysis: "Sicherheitsanalyse",
          predictiveModeling: "Pradiktive Modellierung",
          evidenceSynthesis: "Evidenzsynthese",
        },
      },
      page: {
        title: "Publizieren",
        subtitle:
          "Vorveroffentlichungs-Manuskripte aus Studien und Analysen erstellen",
        startNewDocument: "Neues Dokument starten",
        untitledDocument: "Unbenanntes Dokument",
      },
      cart: {
        selected: "Ausgewahlt ({{count}})",
        empty: "Noch keine Analysen ausgewahlt",
        removeAnalysis: "{{name}} entfernen",
      },
      configurator: {
        documentTitle: "Dokumenttitel",
        documentTitlePlaceholder: "Dokumenttitel eingeben...",
        authors: "Autoren (durch Kommas getrennt)",
        authorsPlaceholder: "Autor Eins, Autor Zwei...",
        template: "Vorlage",
      },
      preview: {
        diagramDataNotAvailable:
          "Diagrammdaten nicht verfugbar",
        unknownDiagramType: "Unbekannter Diagrammtyp",
        reviewWarning:
          "Einige KI-generierte Abschnitte wurden noch nicht gepruft. Bitte akzeptieren oder bearbeiten Sie alle KI-Inhalte vor dem Export.",
        generatedLabel: "Erzeugt am {{date}}",
        noSectionContent:
          "Fur diesen Abschnitt ist kein Inhalt verfugbar.",
        noSectionsIncluded:
          "Keine Abschnitte enthalten. Gehen Sie zuruck und konfigurieren Sie Ihr Dokument.",
        backToConfigure: "Zuruck zur Konfiguration",
        export: "Exportieren",
      },
      exportControls: {
        exportFormat: "Exportformat",
        comingSoon: "Demnachst verfugbar",
        exporting: "Export wird erstellt...",
        exportAs: "Als {{format}} exportieren",
        formats: {
          pdf: {
            description: "Vollstandig formatierten Bericht uber den Druckdialog",
          },
          docx: {
            description: "Strukturiertes Word-Dokument",
          },
          xlsx: {
            description: "Tabellen und Statistiken als Tabellenkalkulation",
          },
          png: {
            description: "Diagramme als Rasterbilddateien",
          },
          svg: {
            description: "Diagramme als Vektordateien",
          },
        },
      },
      exportPanel: {
        draftWarning:
          "Einige KI-generierte Abschnitte sind noch im Entwurfsstatus. Gehen Sie zuruck und akzeptieren oder bearbeiten Sie alle KI-Inhalte vor dem Export.",
        chooseExportFormat: "Exportformat auswahlen",
        exporting: "Export wird erstellt...",
        exportAs: "Als {{format}} exportieren",
        backToPreview: "Zuruck zur Vorschau",
        formats: {
          docx: {
            label: "Microsoft Word",
            description:
              "Journalfertiges Manuskript mit eingebetteten Abbildungen",
          },
          pdf: {
            label: "PDF-Dokument",
            description:
              "Druckfertiges Dokument fur Review und Weitergabe",
          },
          figuresZip: {
            label: "Einzelne Abbildungen",
            description:
              "SVG-Dateien fur separaten Journal-Upload",
          },
        },
      },
      methods: {
        studyDesign: "Studiendesign",
        primaryObjective: "Primare Zielsetzung",
        hypothesis: "Hypothese",
        scientificRationale: "Wissenschaftliche Begrundung",
        cohortDefinitions: "Kohortendefinitionen",
        target: "Ziel",
        comparator: "Vergleich",
        outcome: "Endpunkt",
        timeAtRisk: "Risikozeit",
        start: "Beginn",
        end: "Ende",
        matchingStrategy: "Matching-Strategie",
        modelSettings: "Modelleinstellungen",
        empty:
          "Keine Methodendaten verfugbar. Methoden werden automatisch generiert, sobald Analyseparameter vorliegen.",
        defaults: {
          observational: "Beobachtend",
          cohortStart: "Kohortenstart",
          cohortEnd: "Kohortenende",
        },
      },
      reportPreview: {
        title: "Studienbericht-Vorschau",
        subtitle:
          "Schalten Sie Abschnitte ein oder aus und ordnen Sie sie mit den Steuerelementen neu. Nur eingeschlossene Abschnitte erscheinen im Export.",
        empty:
          "Keine Abschnitte fur die Vorschau. Gehen Sie zuruck und wahlen Sie Analyseausfuhrungen aus.",
      },
      reportSection: {
        moveUp: "Nach oben",
        moveDown: "Nach unten",
        diagnosticsPlaceholder:
          "Diagnostikdaten werden im exportierten Bericht dargestellt.",
        includeSection: "Abschnitt einschlieen",
        excludeSection: "Abschnitt ausschlieen",
        included: "Eingeschlossen",
        excluded: "Ausgeschlossen",
      },
      resultsSummary: {
        empty:
          "Fur diese Ausfuhrung sind keine Ergebnisdaten verfugbar.",
      },
      resultsTable: {
        empty:
          "Fur diese Tabelle sind keine strukturierten Daten verfugbar.",
        caption: "Tabelle {{number}}. {{title}}",
      },
      sectionEditor: {
        tableLabel: "Tabelle",
        aiNarrative: "KI-Narrativ",
        structuredData: "Strukturierte Daten",
        hideTable: "Tabelle ausblenden",
        showTable: "Tabelle anzeigen",
        hideNarrative: "Narrativ ausblenden",
        showNarrative: "Narrativ anzeigen",
        hideDiagram: "Diagramm ausblenden",
        showDiagram: "Diagramm anzeigen",
        noDiagram: "Noch kein Diagramm erzeugt",
      },
      studySelector: {
        loadingStudies: "Studien werden geladen...",
        failedToLoad:
          "Studien konnten nicht geladen werden. Bitte erneut versuchen.",
        selectStudy: "Studie auswahlen",
        noStudiesFound:
          "Keine Studien gefunden. Erstellen Sie zuerst eine Studie.",
        completedExecutions: "Abgeschlossene Ausfuhrungen",
        loadingExecutions: "Ausfuhrungen werden geladen...",
        noCompletedExecutions:
          "Fur diese Studie wurden keine abgeschlossenen Ausfuhrungen gefunden.",
        executionLabel: "Ausfuhrung #{{value}}",
      },
      analysisPicker: {
        filter: {
          allTypes: "Alle Typen",
        },
        searchAnalyses: "Analysen suchen...",
        searchStudies: "Studien suchen...",
        tabs: {
          allAnalyses: "Alle Analysen",
          fromStudies: "Aus Studien",
        },
        loadingAnalyses: "Analysen werden geladen...",
        noCompletedAnalyses:
          "Keine abgeschlossenen Analysen gefunden",
        loadingStudies: "Studien werden geladen...",
        noStudiesMatchFilters:
          "Keine Studien entsprechen Ihren Filtern",
        noStudiesFound: "Keine Studien gefunden",
        completedAnalyses_one: "{{count}} abgeschlossene Analyse",
        completedAnalyses_other:
          "{{count}} abgeschlossene Analysen",
        actions: {
          selectAll: "Alle auswahlen",
          deselectAll: "Auswahl aufheben",
        },
      },
      aiNarrative: {
        generate: "KI-Entwurf generieren",
        generating: "Narrativ wird generiert...",
        draft: "KI-Entwurf",
        accept: "Akzeptieren",
        regenerate: "Neu generieren",
        accepted: "Akzeptiert",
        edit: "Bearbeiten",
      },
      structuredData: {
        empty: "Keine strukturierten Daten verfugbar",
      },
      diagram: {
        exportSvg: "Als SVG exportieren",
        exportPng: "Als PNG exportieren",
      },
      tables: {
        captions: {
          incidenceRatesByCohort: "Inzidenzraten nach Kohorte",
          comparativeEffectivenessEstimates:
            "Schatzungen zur vergleichenden Wirksamkeit",
          sccsEstimates:
            "Selbstkontrollierte Fallserie: Inzidenzratenverhaltnisse nach Expositionsfenster",
          treatmentPathways: "Behandlungspfade (Top 10)",
          populationCharacteristics: "Populationsmerkmale",
          predictionModelPerformance:
            "Leistung des Vorhersagemodells",
          evidenceSynthesisPooled:
            "Evidenzsynthese: gepoolte Schatzungen",
        },
        headers: {
          outcome: "Endpunkt",
          events: "Ereignisse",
          personYears: "Personenjahre",
          exposureWindow: "Expositionsfenster",
          pathway: "Pfad",
          ageGroup: "Altersgruppe",
          model: "Modell",
          targetN: "Ziel-N",
          outcomeN: "Outcome-N",
          analysis: "Analyse",
          pooledEstimate: "Gepoolte Schatzung",
        },
      },
      templates: {
        "generic-ohdsi": {
          name: "Generische OHDSI-Publikation",
          description:
            "Standard-IMRaD-Struktur fur Beobachtungsstudien mit Gesundheitsdaten",
          sections: {
            introduction: "Einleitung",
            methods: "Methoden",
            discussion: "Diskussion",
          },
        },
        "comparative-effectiveness": {
          name: "Bericht zur vergleichenden Wirksamkeit",
          description:
            "CLE/CER-Struktur mit Propensity-Score-Analyse",
          sections: {
            background: "Hintergrund",
            "study-design": "Studiendesign",
            "ps-matching": "Propensity-Score-Matching",
            covariates: "Kovariatenbalance",
            "sensitivity-analyses": "Sensitivitatsanalysen",
            discussion: "Diskussion",
          },
        },
        "incidence-report": {
          name: "Inzidenzratenbericht",
          description: "Bevolkerungsbasierte Inzidenzanalyse",
          sections: {
            background: "Hintergrund",
            methods: "Methoden",
            discussion: "Diskussion",
          },
        },
        "study-protocol": {
          name: "Studienprotokoll / SAP",
          description:
            "Statistischer Analyseplan vor Studienbeginn - keine Ergebnisse erforderlich",
          sections: {
            objectives: "Ziele",
            hypotheses: "Hypothesen",
            "study-design": "Studiendesign",
            "data-sources": "Datenquellen",
            "cohort-definitions": "Kohortendefinitionen",
            "analysis-plan": "Analyseplan",
            timeline: "Zeitplan",
          },
        },
        "jamia-style": {
          name: "JAMIA-Stil",
          description:
            "Journal of the American Medical Informatics Association - informatikmethodischer Fokus mit Betonung der Reproduzierbarkeit",
          sections: {
            "background-significance": "Hintergrund und Bedeutung",
            objective: "Zielsetzung",
            "materials-methods": "Materialien und Methoden",
            "data-sources": "Datenquellen und Studienpopulation",
            "phenotype-definitions": "Phanotypdefinitionen",
            "statistical-analysis": "Statistische Analyse",
            discussion: "Diskussion",
            limitations: "Einschrankungen",
            conclusion: "Fazit",
          },
        },
        "lancet-style": {
          name: "Lancet-Stil",
          description:
            "The Lancet - Fokus auf globale Gesundheit mit strukturierten Methoden, evidenzbasierter Interpretation und politischen Implikationen",
          sections: {
            introduction: "Einleitung",
            methods: "Methoden",
            "study-design-participants": "Studiendesign und Teilnehmende",
            procedures: "Verfahren",
            outcomes: "Endpunkte",
            "statistical-analysis": "Statistische Analyse",
            "role-of-funding": "Rolle der Finanzierungsquelle",
            discussion: "Diskussion",
          },
        },
        "nejm-style": {
          name: "NEJM-Stil",
          description:
            "New England Journal of Medicine - knappe Struktur mit starkem klinischem Fokus",
          sections: {
            introduction: "Einleitung",
            methods: "Methoden",
            "study-design": "Studiendesign und Aufsicht",
            patients: "Patienten",
            endpoints: "Endpunkte",
            "statistical-analysis": "Statistische Analyse",
            discussion: "Diskussion",
          },
        },
        "himss-poster": {
          name: "HIMSS-Poster",
          description:
            "HIMSS-Konferenzposter - kompakte Felder fur Hintergrund, Methoden, Schlussergebnisse und Impact-Statement",
          sections: {
            background: "Hintergrund",
            "problem-statement": "Problemstellung",
            objectives: "Ziele",
            methods: "Methoden",
            "key-findings": "Schlussergebnisse",
            "clinical-impact": "Klinischer und operativer Nutzen",
            "next-steps": "Nachste Schritte",
          },
        },
      },
    },
  },
);

const ptPublishCareGapRisk: MessageTree = mergeMessageTrees(
  enPublishCareGapRisk,
  {
    riskScores: {
      common: {
        status: {
          draft: "Rascunho",
          pending: "Pendente",
          running: "Em execucao",
          completed: "Concluido",
          failed: "Falhou",
        },
        tier: {
          low: "Baixo",
          intermediate: "Intermediario",
          high: "Alto",
          veryHigh: "Muito alto",
          uncomputable: "Nao calculavel",
          filtered: "Filtrado",
          customFilter: "Filtro personalizado",
        },
        category: {
          cardiovascular: "Cardiovascular",
          comorbidityBurden: "Carga de comorbidades",
          hepatic: "Hepatico",
          pulmonary: "Pulmonar",
          respiratory: "Respiratorio",
          metabolic: "Metabolico",
          endocrine: "Endocrino",
          musculoskeletal: "Musculoesqueletico",
        },
        tabs: {
          overview: "Visao geral",
          results: "Resultados",
          patients: "Pacientes",
          recommendations: "Recomendacoes",
          configuration: "Configuracao",
        },
        actions: {
          back: "Voltar",
          close: "Fechar",
          cancel: "Cancelar",
          clear: "Limpar",
          refresh: "Atualizar",
          reRun: "Executar novamente",
          reRunAnalysis: "Executar a analise novamente",
          runAnalysis: "Executar analise",
          quickRun: "Execucao rapida",
          createAnalysis: "Criar analise",
          createCohort: "Criar coorte",
          createCohortFromFilter: "Criar coorte a partir do filtro",
          newAnalysis: "Nova analise",
          duplicateAnalysis: "Duplicar analise",
          deleteAnalysis: "Excluir analise",
          openCatalogue: "Abrir catalogo",
          viewFullResults: "Ver resultados completos",
        },
        values: {
          noneSelected: "Nenhum selecionado",
          noDescription: "Sem descricao",
          unknown: "Desconhecido",
          yes: "Sim",
          no: "Nao",
        },
        view: {
          table: "Visualizacao em tabela",
          card: "Visualizacao em cartoes",
        },
        search: {
          analysesPlaceholder: "Pesquisar analises...",
          noMatch: "Nenhuma analise corresponde a \"{{query}}\"",
          typeToFilter: "Digite para filtrar {{count}} analises",
        },
        count: {
          cohort_one: "{{count}} coorte",
          cohort_other: "{{count}} coortes",
          score_one: "{{count}} pontuacao",
          score_other: "{{count}} pontuacoes",
          analysis_one: "{{count}} analise",
          analysis_other: "{{count}} analises",
          patient_one: "{{count}} paciente",
          patient_other: "{{count}} pacientes",
        },
        duration: {
          seconds: "{{value}} s",
          minutesSeconds: "{{minutes}} min {{seconds}} s",
          total: "{{value}} no total",
        },
        headers: {
          name: "Nome",
          cohort: "Coorte",
          scores: "Scores",
          status: "Status",
          lastRun: "Ultima execucao",
          author: "Autor",
          created: "Criado",
          tier: "Faixa",
          count: "Contagem",
          meanScore: "Score medio",
          confidence: "Confianca",
          value: "Valor",
          riskTier: "Faixa de risco",
          completeness: "Completude",
          missing: "Ausente",
          started: "Iniciado",
          duration: "Duracao",
          actions: "Acoes",
        },
        pagination: {
          showingRange: "Mostrando {{from}}-{{to}} de {{total}}",
        },
      },
      hub: {
        title: "Analises de score de risco",
        subtitle:
          "Estratifique populacoes de pacientes por scores clinicos validados",
        metrics: {
          total: "Total",
          running: "Em execucao",
          completed: "Concluidas",
          scoresAvailable: "Scores disponiveis",
          patientsScored: "Pacientes pontuados",
        },
        filters: {
          status: "Status",
          category: "Categoria",
          allCategories: "Todas as categorias",
        },
        tabs: {
          analyses: "Analises",
          scoreCatalogue: "Catalogo de scores",
        },
        empty: {
          noMatchingAnalyses: "Nenhuma analise correspondente",
          noRiskScoreAnalysesYet: "Ainda nao ha analises de score de risco",
          noAnalysesFoundFor:
            "Nenhuma analise encontrada para \"{{query}}\"",
          createFirst:
            "Crie sua primeira analise para estratificar pacientes por scores clinicos de risco.",
        },
        errors: {
          failedToLoadAnalyses:
            "Falha ao carregar as analises. Tente novamente.",
        },
        catalogue: {
          checkingEligibility: "Verificando elegibilidade...",
          showingEligibilityFor:
            "Mostrando elegibilidade para {{source}}",
          eligibleSummary: "{{eligible}} de {{total}} scores elegiveis",
          completedResults: "{{count}} resultados concluidos",
          selectSourcePrompt:
            "Selecione uma fonte de dados no cabecalho para verificar a elegibilidade de cada score.",
          sourceLevelCompletedScores:
            "Scores concluidos no nivel da fonte",
          sourceLevelCompletedScoresDetail:
            "{{count}} score concluido existe para a fonte ativa, mas nao esta vinculado a nenhuma execucao de analise v2.",
          sourceLevelCompletedScoresDetail_other:
            "{{count}} scores concluidos existem para a fonte ativa, mas nao estao vinculados a nenhuma execucao de analise v2.",
          eligibleCount: "{{count}} elegiveis",
          completedCount: "{{count}} concluidos",
        },
      },
      create: {
        title: "Nova analise de score de risco",
        subtitle:
          "Configure uma analise de pontuacao de risco e selecione os scores a calcular",
        steps: {
          configure: "Configurar",
          reviewAndRun: "Revisar e executar",
        },
        basics: "Basico",
        name: "Nome *",
        description: "Descricao",
        targetCohort: "Coorte alvo *",
        selectCohort: "Selecionar uma coorte...",
        scoreSelection: "Selecao de scores",
        cohortPatients: "{{count}} pacientes",
        autoNameSuffix: "Estratificacao de risco",
        placeholders: {
          name:
            "ex.: Coorte de insuficiencia cardiaca - Estratificacao de risco",
          description:
            "Descricao opcional desta analise de score de risco...",
        },
        completeness: "Completude:",
        createAsDraft: "Criar como rascunho",
        createAndRun: "Criar e executar",
        errors: {
          executionFailed:
            "A analise foi criada, mas a execucao falhou. Voce pode executa-la novamente na pagina de detalhes.",
          createFailed: "Falha ao criar a analise. Tente novamente.",
        },
        recommendations: {
          recommended: "Recomendado",
          available: "Disponivel",
          notApplicable: "Nao aplicavel",
        },
      },
      detail: {
        notFound: "Analise nao encontrada",
        backToRiskScores: "Voltar para scores de risco",
        selectSourcePrompt:
          "Selecione uma fonte de dados para executar ou ver os resultados.",
        deleteConfirm:
          "Tem certeza de que deseja excluir esta analise? Essa acao nao pode ser desfeita.",
      },
      overview: {
        about: "Sobre",
        author: "Autor: {{value}}",
        created: "Criado: {{value}}",
        updated: "Atualizado: {{value}}",
        resultsSummary: "Resumo dos resultados",
        scoresComputed: "Scores calculados",
        uniqueScores: "scores unicos",
        patientsScored: "Pacientes pontuados",
        maxPerScore: "max por score",
        avgCompleteness: "Completude media",
        avgConfidence: "Confianca media",
        acrossSummaries: "entre os resumos",
        thisAnalysisHasNotBeenExecutedYet:
          "Esta analise ainda nao foi executada.",
        executionInProgress: "Execucao em andamento...",
        lastExecutionFailed: "A ultima execucao falhou.",
        recentExecution: "Execucao recente",
        started: "Iniciado",
        completed: "Concluido",
        duration: "Duracao",
      },
      configuration: {
        analysisDesign: "Desenho da analise",
        targetCohorts: "Coortes alvo",
        selectedScores: "Scores selecionados",
        parameters: "Parametros",
        minCompleteness: "Completude min.:",
        storePatientLevel: "Armazenar nivel do paciente:",
        executionHistory: "Historico de execucao",
        noExecutionsYet: "Ainda nao ha execucoes",
      },
      results: {
        noResultsAvailable:
          "Nenhum resultado disponivel. Execute a analise para calcular scores de risco.",
        allScores: "Todos os scores",
        percentOfTotal: "% do total",
        action: "Acao",
        averageCompleteness: "Completude media:",
      },
      patients: {
        noExecutionSelected: "Nenhuma execucao selecionada",
        runExecutionToViewPatientLevel:
          "Execute uma analise para ver os resultados no nivel do paciente.",
        all: "Todos",
        showingPatients: "Mostrando {{count}} pacientes",
        patientsOnPage: "{{count}} pacientes nesta pagina",
        noPatientResultsAvailable:
          "Nenhum resultado de paciente disponivel",
        adjustFilters:
          "Tente ajustar seus filtros para ver os resultados.",
        executeToGenerate:
          "Execute a analise para gerar scores no nivel do paciente.",
        personId: "ID da pessoa",
      },
      scoreDetail: {
        selectSourcePrompt:
          "Selecione uma fonte de dados no cabecalho para verificar a elegibilidade.",
        eligiblePatients:
          "Elegivel - {{count}} pacientes possuem dados suficientes",
        insufficientData: "Dados insuficientes na fonte ativa",
        missing: "Ausente:",
        checkingEligibility:
          "Verificando elegibilidade para a fonte ativa...",
        eligiblePopulation: "Populacao elegivel",
        requiredComponents: "Componentes obrigatorios",
        cdmTablesUsed: "Tabelas CDM utilizadas",
        riskTierDefinitions: "Definicoes de faixas de risco",
        scoreRange: "Faixa de score",
      },
      createCohort: {
        title: "Criar coorte a partir da faixa de risco",
        cohortName: "Nome da coorte",
        description: "Descricao",
        patientsIncluded: "{{count}} pacientes serao incluidos",
        showDetails: "Mostrar detalhes",
        hideDetails: "Ocultar detalhes",
        analysisId: "ID da analise:",
        executionId: "ID da execucao:",
        score: "Pontuacao:",
        tier: "Faixa:",
        createFailed: "Falha ao criar a coorte. Tente novamente.",
        derivedDescription:
          "Pacientes da coorte '{{cohort}}' com faixa de risco {{score}} = {{tier}}",
        defaultName: "{{score}} - Risco {{tier}} - {{cohort}}",
      },
      recommendations: {
        selectSourceToView:
          "Selecione uma fonte para ver as recomendacoes",
        recommended: "Recomendado",
        available: "Disponivel",
        notApplicable: "Nao aplicavel",
      },
      runModal: {
        title: "Scores de risco populacionais",
        computingScores: "Calculando scores...",
        completedScoresIn:
          "{{count}} score concluido em {{duration}}",
        completedScoresIn_other:
          "{{count}} scores concluidos em {{duration}}",
        runFailed: "Execucao falhou",
        passed: "{{count}} aprovados",
        failed: "{{count}} falharam",
        skipped: "{{count}} ignorados",
        seconds: "segundos",
        tiers: "{{count}} faixas",
      },
      tierBreakdown: {
        tierDistribution: "Distribuicao das faixas",
        patientsPerTier: "Pacientes por faixa",
        patients: "Pacientes",
      },
      cohortProfile: {
        demographics: "Demografia",
        patients: "pacientes",
        age: "Idade",
        female: "{{count}}% feminino",
        topConditions: "Principais condicoes",
        measurementCoverage: "Cobertura de medicoes",
      },
    },
    careGaps: {
      common: {
        status: {
          pending: "Pendente",
          running: "Em execucao",
          completed: "Concluido",
          failed: "Falhou",
        },
        actions: {
          newBundle: "Novo bundle",
          delete: "Excluir",
          evaluate: "Avaliar",
          backToList: "Voltar para a lista",
          saveChanges: "Salvar alteracoes",
          createBundle: "Criar bundle",
        },
        category: {
          all: "Todas",
          endocrine: "Endocrino",
          cardiovascular: "Cardiovascular",
          respiratory: "Respiratorio",
          mentalHealth: "Saude mental",
          rheumatologic: "Reumatologico",
          neurological: "Neurologico",
          oncology: "Oncologia",
        },
        bundle: {
          active: "Ativo",
          inactive: "Inativo",
          measure_one: "{{count}} medida",
          measure_other: "{{count}} medidas",
        },
      },
      page: {
        title: "Lacunas de cuidado",
        subtitle:
          "Bundles de condicoes, medidas de qualidade e acompanhamento de conformidade populacional",
        untitledBundle: "Bundle sem titulo",
        tabs: {
          bundles: "Bundles de doencas",
          population: "Visao geral da populacao",
        },
      },
      bundleList: {
        searchPlaceholder: "Pesquisar bundles...",
        allCategories: "Todas as categorias",
        sortName: "Nome",
        sortCompliance: "Conformidade",
        noBundlesFound: "Nenhum bundle encontrado",
        adjustFilters: "Tente ajustar seus filtros",
        createToGetStarted: "Crie um bundle para comecar",
      },
      bundleDetail: {
        failedToLoad: "Falha ao carregar o bundle",
        backToCareGaps: "Lacunas de cuidado",
        overallCompliance: "Conformidade geral",
        tabs: {
          design: "Desenho",
          compliance: "Resultados de conformidade",
          overlap: "Regras de sobreposicao",
        },
        executeEvaluation: "Executar avaliacao",
        overall: "Geral",
        totalPatients: "Total de pacientes",
        gapsMet: "Lacunas atendidas",
        openGaps: "Lacunas abertas",
        excluded: "Excluidos",
        evaluationHistory: "Historico de avaliacao",
        sourceLabel: "Fonte #{{value}}",
        evaluationInProgress: "Avaliacao em andamento...",
        noEvaluationResults:
          "Ainda nao ha resultados de avaliacao. Execute uma avaliacao para ver os dados de conformidade.",
        deleteConfirm:
          "Tem certeza de que deseja excluir este bundle de condicao?",
      },
      bundleDesigner: {
        bundleDetails: "Detalhes do bundle",
        bundleCode: "Codigo do bundle",
        conditionName: "Nome da condicao",
        description: "Descricao",
        diseaseCategory: "Categoria da doenca",
        selectCategory: "Selecionar categoria...",
        icd10Patterns: "Padroes ICD-10",
        omopConceptIds: "IDs de conceito OMOP",
        ecqmReferences: "Referencias eCQM",
        attachedMeasures: "Medidas associadas",
        noMeasuresAttached:
          "Nenhuma medida associada a este bundle.",
        saveBundle: "Salvar bundle",
        saving: "Salvando...",
        add: "Adicionar",
        remove: "Remover",
        placeholders: {
          bundleCode: "ex.: DM2-BUNDLE",
          conditionName: "ex.: Diabetes mellitus tipo 2",
          description: "Descreva o bundle...",
          conceptId: "Digite o ID do conceito",
        },
      },
      measureCompliance: {
        noResultsAvailable:
          "Ainda nao ha resultados de medidas disponiveis.",
        measure: "Medida",
        domain: "Dominio",
        eligible: "Elegivel",
        met: "Atingido",
        notMet: "Nao atingido",
        compliance: "Conformidade",
        deduplicated: "Deduplicado",
        deduplicatedFrom: "Deduplicado de: {{value}}",
      },
      population: {
        selectSourcePrompt:
          "Selecione uma fonte de dados para ver a conformidade populacional.",
        failedToLoad:
          "Falha ao carregar o resumo da populacao.",
        totalBundles: "Total de bundles",
        totalPatients: "Total de pacientes",
        avgCompliance: "Conformidade media",
        totalOpenGaps: "Total de lacunas abertas",
        filterByCategory: "Filtrar por categoria:",
        bundleComplianceComparison:
          "Comparacao de conformidade dos bundles",
        noBundlesMatchFilter:
          "Nenhum bundle corresponde ao filtro selecionado.",
      },
      overlapRules: {
        failedToLoad:
          "Falha ao carregar as regras de sobreposicao.",
        noneConfigured:
          "Nenhuma regra de sobreposicao configurada.",
        subtitle:
          "As regras de sobreposicao evitam contagem duplicada de medidas entre bundles.",
      },
    },
    publish: {
      steps: {
        selectAnalyses: "Selecionar analises",
        configure: "Configurar",
        preview: "Pre-visualizar",
        export: "Exportar",
      },
      common: {
        actions: {
          back: "Voltar",
          next: "Proximo",
          previewDocument: "Pre-visualizar documento ->",
          configureDocument: "Configurar documento ->",
          close: "Fechar",
        },
        sectionType: {
          title: "Titulo",
          methods: "Metodos",
          results: "Resultados",
          diagram: "Diagrama",
          discussion: "Discussao",
          diagnostics: "Diagnosticos",
        },
        analysisType: {
          characterizations: "Caracterizacao",
          characterization: "Caracterizacao",
          estimations: "Estimacao",
          estimation: "Estimacao",
          predictions: "Predicao",
          prediction: "Predicao",
          incidence_rates: "Taxa de incidencia",
          incidence_rate: "Taxa de incidencia",
          evidence_synthesis: "Sintese de evidencias",
          pathways: "Percurso",
          pathway: "Percurso",
        },
        resultSection: {
          populationCharacteristics:
            "Caracteristicas da populacao",
          incidenceRates: "Taxas de incidencia",
          comparativeEffectiveness: "Efetividade comparativa",
          treatmentPatterns: "Padroes de tratamento",
          safetyAnalysis: "Analise de seguranca",
          predictiveModeling: "Modelagem preditiva",
          evidenceSynthesis: "Sintese de evidencias",
        },
      },
      page: {
        title: "Publicar",
        subtitle:
          "Crie manuscritos de pre-publicacao a partir de estudos e analises",
        startNewDocument: "Iniciar novo documento",
        untitledDocument: "Documento sem titulo",
      },
      cart: {
        selected: "Selecionados ({{count}})",
        empty: "Ainda nao ha analises selecionadas",
        removeAnalysis: "Remover {{name}}",
      },
      configurator: {
        documentTitle: "Titulo do documento",
        documentTitlePlaceholder: "Digite o titulo do documento...",
        authors: "Autores (separados por virgula)",
        authorsPlaceholder: "Autor Um, Autor Dois...",
        template: "Modelo",
      },
      preview: {
        diagramDataNotAvailable:
          "Dados do diagrama nao disponiveis",
        unknownDiagramType: "Tipo de diagrama desconhecido",
        reviewWarning:
          "Algumas secoes geradas por IA ainda nao foram revisadas. Aceite ou edite todo o conteudo de IA antes de exportar.",
        generatedLabel: "Gerado em {{date}}",
        noSectionContent:
          "Nenhum conteudo disponivel para esta secao.",
        noSectionsIncluded:
          "Nenhuma secao incluida. Volte para configurar seu documento.",
        backToConfigure: "Voltar para configurar",
        export: "Exportar",
      },
      exportControls: {
        exportFormat: "Formato de exportacao",
        comingSoon: "Em breve",
        exporting: "Exportando...",
        exportAs: "Exportar como {{format}}",
        formats: {
          pdf: {
            description:
              "Relatorio completo formatado via caixa de impressao",
          },
          docx: {
            description: "Documento Word estruturado",
          },
          xlsx: {
            description:
              "Tabelas e estatisticas como planilha",
          },
          png: {
            description: "Graficos como arquivos de imagem raster",
          },
          svg: {
            description: "Graficos como arquivos vetoriais",
          },
        },
      },
      exportPanel: {
        draftWarning:
          "Algumas secoes geradas por IA ainda estao em rascunho. Volte e aceite ou edite todo o conteudo de IA antes de exportar.",
        chooseExportFormat: "Escolher formato de exportacao",
        exporting: "Exportando...",
        exportAs: "Exportar como {{format}}",
        backToPreview: "Voltar para a pre-visualizacao",
        formats: {
          docx: {
            label: "Microsoft Word",
            description:
              "Manuscrito pronto para periodico com figuras incorporadas",
          },
          pdf: {
            label: "Documento PDF",
            description:
              "Documento pronto para impressao, revisao e compartilhamento",
          },
          figuresZip: {
            label: "Figuras individuais",
            description:
              "Arquivos SVG para envio separado ao periodico",
          },
        },
      },
      methods: {
        studyDesign: "Desenho do estudo",
        primaryObjective: "Objetivo principal",
        hypothesis: "Hipotese",
        scientificRationale: "Justificativa cientifica",
        cohortDefinitions: "Definicoes de coorte",
        target: "Alvo",
        comparator: "Comparador",
        outcome: "Desfecho",
        timeAtRisk: "Tempo em risco",
        start: "Inicio",
        end: "Fim",
        matchingStrategy: "Estrategia de pareamento",
        modelSettings: "Configuracoes do modelo",
        empty:
          "Nenhum dado de metodos disponivel. Os metodos serao gerados automaticamente quando os parametros de analise forem fornecidos.",
        defaults: {
          observational: "Observacional",
          cohortStart: "inicio da coorte",
          cohortEnd: "fim da coorte",
        },
      },
      reportPreview: {
        title: "Pre-visualizacao do relatorio do estudo",
        subtitle:
          "Ative ou desative secoes e reordene-as usando os controles. Apenas as secoes incluidas aparecerao na exportacao.",
        empty:
          "Nenhuma secao para pre-visualizar. Volte e selecione as execucoes de analise.",
      },
      reportSection: {
        moveUp: "Mover para cima",
        moveDown: "Mover para baixo",
        diagnosticsPlaceholder:
          "Os dados de diagnostico serao renderizados no relatorio exportado.",
        includeSection: "Incluir secao",
        excludeSection: "Excluir secao",
        included: "Incluida",
        excluded: "Excluida",
      },
      resultsSummary: {
        empty:
          "Nenhum dado de resultado disponivel para esta execucao.",
      },
      resultsTable: {
        empty:
          "Nenhum dado estruturado disponivel para esta tabela.",
        caption: "Tabela {{number}}. {{title}}",
      },
      sectionEditor: {
        tableLabel: "Tabela",
        aiNarrative: "Narrativa de IA",
        structuredData: "Dados estruturados",
        hideTable: "Ocultar tabela",
        showTable: "Mostrar tabela",
        hideNarrative: "Ocultar narrativa",
        showNarrative: "Mostrar narrativa",
        hideDiagram: "Ocultar diagrama",
        showDiagram: "Mostrar diagrama",
        noDiagram: "Nenhum diagrama gerado ainda",
      },
      studySelector: {
        loadingStudies: "Carregando estudos...",
        failedToLoad:
          "Falha ao carregar os estudos. Tente novamente.",
        selectStudy: "Selecionar um estudo",
        noStudiesFound:
          "Nenhum estudo encontrado. Crie um estudo primeiro.",
        completedExecutions: "Execucoes concluidas",
        loadingExecutions: "Carregando execucoes...",
        noCompletedExecutions:
          "Nenhuma execucao concluida encontrada para este estudo.",
        executionLabel: "Execucao #{{value}}",
      },
      analysisPicker: {
        filter: {
          allTypes: "Todos os tipos",
        },
        searchAnalyses: "Pesquisar analises...",
        searchStudies: "Pesquisar estudos...",
        tabs: {
          allAnalyses: "Todas as analises",
          fromStudies: "Dos estudos",
        },
        loadingAnalyses: "Carregando analises...",
        noCompletedAnalyses:
          "Nenhuma analise concluida encontrada",
        loadingStudies: "Carregando estudos...",
        noStudiesMatchFilters:
          "Nenhum estudo corresponde aos seus filtros",
        noStudiesFound: "Nenhum estudo encontrado",
        completedAnalyses_one: "{{count}} analise concluida",
        completedAnalyses_other:
          "{{count}} analises concluidas",
        actions: {
          selectAll: "Selecionar tudo",
          deselectAll: "Desmarcar tudo",
        },
      },
      aiNarrative: {
        generate: "Gerar rascunho com IA",
        generating: "Gerando narrativa...",
        draft: "Rascunho de IA",
        accept: "Aceitar",
        regenerate: "Gerar novamente",
        accepted: "Aceito",
        edit: "Editar",
      },
      structuredData: {
        empty: "Nenhum dado estruturado disponivel",
      },
      diagram: {
        exportSvg: "Exportar como SVG",
        exportPng: "Exportar como PNG",
      },
      tables: {
        captions: {
          incidenceRatesByCohort: "Taxas de incidencia por coorte",
          comparativeEffectivenessEstimates:
            "Estimativas de efetividade comparativa",
          sccsEstimates:
            "Serie de casos autocontrolada: razoes de taxa de incidencia por janela de exposicao",
          treatmentPathways: "Percursos terapeuticos (top 10)",
          populationCharacteristics:
            "Caracteristicas da populacao",
          predictionModelPerformance:
            "Desempenho do modelo de predicao",
          evidenceSynthesisPooled:
            "Sintese de evidencias: estimativas combinadas",
        },
        headers: {
          cohort: "Coorte",
          outcome: "Desfecho",
          events: "Eventos",
          personYears: "Pessoa-anos",
          exposureWindow: "Janela de exposicao",
          pathway: "Percurso",
          patients: "Pacientes",
          ageGroup: "Faixa etaria",
          model: "Modelo",
          targetN: "N alvo",
          outcomeN: "N desfecho",
          analysis: "Analise",
          pooledEstimate: "Estimativa combinada",
        },
      },
      templates: {
        "generic-ohdsi": {
          name: "Publicacao OHDSI generica",
          description:
            "Estrutura IMRaD padrao para estudos observacionais com dados de saude",
          sections: {
            introduction: "Introducao",
            methods: "Metodos",
            discussion: "Discussao",
          },
        },
        "comparative-effectiveness": {
          name: "Relatorio de efetividade comparativa",
          description:
            "Estrutura CLE/CER com analise por score de propensao",
          sections: {
            background: "Contexto",
            "study-design": "Desenho do estudo",
            "ps-matching": "Pareamento por score de propensao",
            covariates: "Balanceamento de covariaveis",
            "sensitivity-analyses": "Analises de sensibilidade",
            discussion: "Discussao",
          },
        },
        "incidence-report": {
          name: "Relatorio de taxa de incidencia",
          description: "Analise de incidencia baseada na populacao",
          sections: {
            background: "Contexto",
            methods: "Metodos",
            discussion: "Discussao",
          },
        },
        "study-protocol": {
          name: "Protocolo de estudo / SAP",
          description:
            "Plano estatistico de analise antes do estudo - sem necessidade de resultados",
          sections: {
            objectives: "Objetivos",
            hypotheses: "Hipoteses",
            "study-design": "Desenho do estudo",
            "data-sources": "Fontes de dados",
            "cohort-definitions": "Definicoes de coorte",
            "analysis-plan": "Plano de analise",
            timeline: "Cronograma",
          },
        },
        "jamia-style": {
          name: "Estilo JAMIA",
          description:
            "Journal of the American Medical Informatics Association - foco em metodologia de informatica com enfase em reprodutibilidade",
          sections: {
            "background-significance": "Contexto e relevancia",
            objective: "Objetivo",
            "materials-methods": "Materiais e metodos",
            "data-sources":
              "Fontes de dados e populacao do estudo",
            "phenotype-definitions": "Definicoes de fenotipo",
            "statistical-analysis": "Analise estatistica",
            discussion: "Discussao",
            limitations: "Limitacoes",
            conclusion: "Conclusao",
          },
        },
        "lancet-style": {
          name: "Estilo Lancet",
          description:
            "The Lancet - foco em saude global com metodos estruturados, interpretacao baseada em evidencias e implicacoes de politica",
          sections: {
            introduction: "Introducao",
            methods: "Metodos",
            "study-design-participants":
              "Desenho do estudo e participantes",
            procedures: "Procedimentos",
            outcomes: "Desfechos",
            "statistical-analysis": "Analise estatistica",
            "role-of-funding": "Papel da fonte de financiamento",
            discussion: "Discussao",
          },
        },
        "nejm-style": {
          name: "Estilo NEJM",
          description:
            "New England Journal of Medicine - estrutura concisa com forte impacto clinico",
          sections: {
            introduction: "Introducao",
            methods: "Metodos",
            "study-design": "Desenho e supervisao do estudo",
            patients: "Pacientes",
            endpoints: "Desfechos",
            "statistical-analysis": "Analise estatistica",
            discussion: "Discussao",
          },
        },
        "himss-poster": {
          name: "Poster HIMSS",
          description:
            "Poster de conferencia HIMSS - paineis concisos para contexto, metodos, principais achados e impacto",
          sections: {
            background: "Contexto",
            "problem-statement": "Declaracao do problema",
            objectives: "Objetivos",
            methods: "Metodos",
            "key-findings": "Principais achados",
            "clinical-impact": "Impacto clinico e operacional",
            "next-steps": "Proximos passos",
          },
        },
      },
    },
  },
);

export const publishCareGapRiskResources: Record<string, MessageTree> = {
  "en-US": enPublishCareGapRisk,
  "es-ES": mergeMessageTrees(enPublishCareGapRisk, {}),
  "fr-FR": frPublishCareGapRisk,
  "de-DE": dePublishCareGapRisk,
  "pt-BR": ptPublishCareGapRisk,
  "fi-FI": mergeMessageTrees(enPublishCareGapRisk, {}),
  "ja-JP": mergeMessageTrees(enPublishCareGapRisk, {}),
  "zh-Hans": mergeMessageTrees(enPublishCareGapRisk, {}),
  "ko-KR": mergeMessageTrees(enPublishCareGapRisk, {}),
  "hi-IN": mergeMessageTrees(enPublishCareGapRisk, {}),
  ar: mergeMessageTrees(enPublishCareGapRisk, {}),
  "en-XA": mergeMessageTrees(enPublishCareGapRisk, {}),
};
