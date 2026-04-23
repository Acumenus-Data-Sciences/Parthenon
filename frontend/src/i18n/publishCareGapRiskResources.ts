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

const dePublishCareGapRiskPass100: MessageTree = mergeMessageTrees(
  dePublishCareGapRisk,
  {
    publish: {
      tables: {
        headers: {
          percentFemale: "% weiblich",
          percentMale: "% männlich",
        },
      },
    },
  },
);

const ptPublishCareGapRiskPass100: MessageTree = mergeMessageTrees(
  ptPublishCareGapRisk,
  {
    publish: {
      tables: {
        headers: {
          percentFemale: "% feminino",
          percentMale: "% masculino",
        },
      },
    },
  },
);

const esPublishCareGapRisk: MessageTree = mergeMessageTrees(
  enPublishCareGapRisk,
  {
    riskScores: {
      common: {
        status: {
          draft: "Borrador",
          pending: "Pendiente",
          running: "En ejecución",
          completed: "Completado",
          failed: "Fallido",
        },
        tier: {
          low: "Bajo",
          intermediate: "Intermedio",
          high: "Alto",
          veryHigh: "Muy alto",
          uncomputable: "No calculable",
          filtered: "Filtrado",
          customFilter: "Filtro personalizado",
        },
        category: {
          cardiovascular: "Cardiovascular",
          comorbidityBurden: "Carga de comorbilidad",
          hepatic: "Hepático",
          pulmonary: "Pulmonar",
          respiratory: "Respiratorio",
          metabolic: "Metabólico",
          endocrine: "Endocrino",
          musculoskeletal: "Musculoesquelético",
        },
        tabs: {
          overview: "Resumen",
          results: "Resultados",
          patients: "Pacientes",
          recommendations: "Recomendaciones",
          configuration: "Configuración",
        },
        actions: {
          back: "Atrás",
          close: "Cerrar",
          cancel: "Cancelar",
          clear: "Limpiar",
          refresh: "Actualizar",
          reRun: "Volver a ejecutar",
          reRunAnalysis: "Volver a ejecutar análisis",
          runAnalysis: "Ejecutar análisis",
          quickRun: "Ejecución rápida",
          createAnalysis: "Crear análisis",
          createCohort: "Crear cohorte",
          createCohortFromFilter: "Crear cohorte desde el filtro",
          newAnalysis: "Nuevo análisis",
          duplicateAnalysis: "Duplicar análisis",
          deleteAnalysis: "Eliminar análisis",
          openCatalogue: "Abrir catálogo",
          viewFullResults: "Ver resultados completos",
        },
        values: {
          noneSelected: "Ninguno seleccionado",
          noDescription: "Sin descripción",
          unknown: "Desconocido",
          notAvailable: "N/D",
          yes: "Sí",
          no: "No",
        },
        view: {
          table: "Vista de tabla",
          card: "Vista de tarjetas",
        },
        search: {
          analysesPlaceholder: "Buscar análisis...",
          noMatch: "Ningún análisis coincide con \"{{query}}\"",
          typeToFilter: "Escribe para filtrar {{count}} análisis",
        },
        count: {
          cohort_one: "{{count}} cohorte",
          cohort_other: "{{count}} cohortes",
          score_one: "{{count}} puntuación",
          score_other: "{{count}} puntuaciones",
          analysis_one: "{{count}} análisis",
          analysis_other: "{{count}} análisis",
          patient_one: "{{count}} paciente",
          patient_other: "{{count}} pacientes",
        },
        duration: {
          seconds: "{{value}} s",
          minutesSeconds: "{{minutes}} m {{seconds}} s",
          total: "{{value}} total",
        },
        headers: {
          name: "Nombre",
          cohort: "Cohorte",
          scores: "Puntuaciones",
          status: "Estado",
          lastRun: "Última ejecución",
          author: "Autor",
          created: "Creado",
          tier: "Nivel",
          count: "Recuento",
          meanScore: "Puntuación media",
          confidence: "Confianza",
          score: "Puntuación",
          value: "Valor",
          riskTier: "Nivel de riesgo",
          completeness: "Completitud",
          missing: "Faltante",
          started: "Iniciado",
          duration: "Duración",
          actions: "Acciones",
        },
        pagination: {
          showingRange: "Mostrando {{from}}-{{to}} de {{total}}",
        },
      },
      hub: {
        title: "Análisis de puntuaciones de riesgo",
        subtitle:
          "Estratifica poblaciones de pacientes con puntuaciones clínicas de riesgo validadas",
        metrics: {
          total: "Total",
          running: "En ejecución",
          completed: "Completados",
          scoresAvailable: "Puntuaciones disponibles",
          patientsScored: "Pacientes evaluados",
        },
        filters: {
          status: "Estado",
          category: "Categoría",
          allCategories: "Todas las categorías",
        },
        tabs: {
          analyses: "Análisis",
          scoreCatalogue: "Catálogo de puntuaciones",
        },
        drilldown: {
          analyses: "Análisis {{status}}",
        },
        empty: {
          noMatchingAnalyses: "No hay análisis coincidentes",
          noRiskScoreAnalysesYet: "Aún no hay análisis de riesgo",
          noAnalysesFoundFor: "No se encontraron análisis para \"{{query}}\"",
          createFirst:
            "Crea tu primer análisis para estratificar pacientes por puntuaciones clínicas de riesgo.",
        },
        errors: {
          failedToLoadAnalyses:
            "No se pudieron cargar los análisis. Inténtalo de nuevo.",
        },
        catalogue: {
          checkingEligibility: "Comprobando elegibilidad...",
          showingEligibilityFor: "Mostrando elegibilidad para {{source}}",
          eligibleSummary: "{{eligible}} de {{total}} puntuaciones elegibles",
          completedResults: "{{count}} resultados completados",
          selectSourcePrompt:
            "Selecciona una fuente de datos en el encabezado para comprobar la elegibilidad de cada puntuación.",
          sourceLevelCompletedScores:
            "Puntuaciones completadas a nivel de fuente",
          sourceLevelCompletedScoresDetail:
            "{{count}} puntuación completada existe para la fuente activa, pero no está asociada a ninguna ejecución de análisis v2.",
          sourceLevelCompletedScoresDetail_other:
            "{{count}} puntuaciones completadas existen para la fuente activa, pero no están asociadas a ninguna ejecución de análisis v2.",
          eligibleCount: "{{count}} elegibles",
          completedCount: "{{count}} completadas",
        },
      },
      create: {
        title: "Nuevo análisis de puntuación de riesgo",
        subtitle:
          "Configura un análisis de puntuación de riesgo y selecciona las puntuaciones que se calcularán",
        steps: {
          configure: "Configurar",
          reviewAndRun: "Revisar y ejecutar",
        },
        basics: "Aspectos básicos",
        name: "Nombre *",
        description: "Descripción",
        targetCohort: "Cohorte objetivo *",
        selectCohort: "Selecciona una cohorte...",
        scoreSelection: "Selección de puntuaciones",
        cohortPatients: "{{count}} pacientes",
        autoNameSuffix: "Estratificación de riesgo",
        placeholders: {
          name:
            "p. ej., cohorte de insuficiencia cardíaca - estratificación de riesgo",
          description:
            "Descripción opcional de este análisis de puntuación de riesgo...",
        },
        completeness: "Completitud:",
        createAsDraft: "Crear como borrador",
        createAndRun: "Crear y ejecutar",
        errors: {
          executionFailed:
            "El análisis se creó, pero la ejecución falló. Puedes volver a ejecutarlo desde la página de detalle.",
          createFailed: "No se pudo crear el análisis. Inténtalo de nuevo.",
        },
        recommendations: {
          recommended: "Recomendado",
          available: "Disponible",
          notApplicable: "No aplicable",
        },
      },
      detail: {
        notFound: "Análisis no encontrado",
        backToRiskScores: "Volver a puntuaciones de riesgo",
        selectSourcePrompt:
          "Selecciona una fuente de datos para ejecutar o ver los resultados.",
        deleteConfirm:
          "¿Seguro que quieres eliminar este análisis? Esta acción no se puede deshacer.",
      },
      overview: {
        about: "Acerca de",
        author: "Autor: {{value}}",
        created: "Creado: {{value}}",
        updated: "Actualizado: {{value}}",
        resultsSummary: "Resumen de resultados",
        scoresComputed: "Puntuaciones calculadas",
        uniqueScores: "puntuaciones únicas",
        patientsScored: "Pacientes evaluados",
        maxPerScore: "máx. por puntuación",
        avgCompleteness: "Completitud media",
        avgConfidence: "Confianza media",
        acrossSummaries: "entre los resúmenes",
        thisAnalysisHasNotBeenExecutedYet:
          "Este análisis aún no se ha ejecutado.",
        executionInProgress: "Ejecución en curso...",
        lastExecutionFailed: "La última ejecución falló.",
        recentExecution: "Ejecución reciente",
        started: "Iniciado",
        completed: "Completado",
        duration: "Duración",
      },
      configuration: {
        analysisDesign: "Diseño del análisis",
        targetCohorts: "Cohortes objetivo",
        selectedScores: "Puntuaciones seleccionadas",
        parameters: "Parámetros",
        minCompleteness: "Completitud mín.:",
        storePatientLevel: "Guardar a nivel de paciente:",
        executionHistory: "Historial de ejecución",
        noExecutionsYet: "Aún no hay ejecuciones",
      },
      results: {
        noResultsAvailable:
          "No hay resultados disponibles. Ejecuta el análisis para calcular puntuaciones de riesgo.",
        allScores: "Todas las puntuaciones",
        percentOfTotal: "% del total",
        action: "Acción",
        averageCompleteness: "Completitud media:",
      },
      patients: {
        noExecutionSelected: "No se seleccionó ninguna ejecución",
        runExecutionToViewPatientLevel:
          "Ejecuta una ejecución para ver resultados a nivel de paciente.",
        all: "Todos",
        showingPatients: "Mostrando {{count}} pacientes",
        patientsOnPage: "{{count}} pacientes en esta página",
        noPatientResultsAvailable:
          "No hay resultados de pacientes disponibles",
        adjustFilters: "Prueba ajustando los filtros para ver resultados.",
        executeToGenerate:
          "Ejecuta el análisis para generar puntuaciones a nivel de paciente.",
        personId: "ID de persona",
      },
      scoreDetail: {
        selectSourcePrompt:
          "Selecciona una fuente de datos en el encabezado para comprobar la elegibilidad.",
        eligiblePatients:
          "Elegible - {{count}} pacientes tienen datos suficientes",
        insufficientData: "Datos insuficientes en la fuente activa",
        missing: "Faltante:",
        checkingEligibility:
          "Comprobando elegibilidad para la fuente activa...",
        eligiblePopulation: "Población elegible",
        requiredComponents: "Componentes requeridos",
        cdmTablesUsed: "Tablas CDM utilizadas",
        riskTierDefinitions: "Definiciones de niveles de riesgo",
        scoreRange: "Rango de puntuación",
      },
      createCohort: {
        title: "Crear cohorte a partir del nivel de riesgo",
        cohortName: "Nombre de la cohorte",
        description: "Descripción",
        patientsIncluded: "{{count}} pacientes serán incluidos",
        showDetails: "Mostrar detalles",
        hideDetails: "Ocultar detalles",
        analysisId: "ID del análisis:",
        executionId: "ID de la ejecución:",
        score: "Puntuación:",
        tier: "Nivel:",
        createFailed: "No se pudo crear la cohorte. Inténtalo de nuevo.",
        derivedDescription:
          "Pacientes de la cohorte '{{cohort}}' con {{score}} = nivel de riesgo {{tier}}",
        defaultName: "{{score}} - riesgo {{tier}} - {{cohort}}",
      },
      recommendations: {
        selectSourceToView:
          "Selecciona una fuente para ver las recomendaciones",
        recommended: "Recomendado",
        available: "Disponible",
        notApplicable: "No aplicable",
      },
      runModal: {
        title: "Puntuaciones de riesgo poblacional",
        computingScores: "Calculando puntuaciones...",
        completedScoresIn:
          "{{count}} puntuación completada en {{duration}}",
        completedScoresIn_other:
          "{{count}} puntuaciones completadas en {{duration}}",
        runFailed: "La ejecución falló",
        passed: "{{count}} aprobadas",
        failed: "{{count}} fallidas",
        skipped: "{{count}} omitidas",
        seconds: "segundos",
        tiers: "{{count}} niveles",
      },
      tierBreakdown: {
        tierDistribution: "Distribución por nivel",
        patientsPerTier: "Pacientes por nivel",
        patients: "Pacientes",
      },
      cohortProfile: {
        demographics: "Demografía",
        patients: "pacientes",
        age: "Edad",
        female: "{{count}}% mujeres",
        topConditions: "Principales afecciones",
        measurementCoverage: "Cobertura de mediciones",
      },
    },
    careGaps: {
      common: {
        status: {
          pending: "Pendiente",
          running: "En ejecución",
          completed: "Completado",
          failed: "Fallido",
        },
        actions: {
          newBundle: "Nuevo bundle",
          delete: "Eliminar",
          evaluate: "Evaluar",
          backToList: "Volver a la lista",
          saveChanges: "Guardar cambios",
          createBundle: "Crear bundle",
        },
        category: {
          all: "Todas",
          endocrine: "Endocrino",
          cardiovascular: "Cardiovascular",
          respiratory: "Respiratorio",
          mentalHealth: "Salud mental",
          rheumatologic: "Reumatológico",
          neurological: "Neurológico",
          oncology: "Oncología",
        },
        bundle: {
          active: "Activo",
          inactive: "Inactivo",
          measure_one: "{{count}} medida",
          measure_other: "{{count}} medidas",
        },
      },
      page: {
        title: "Brechas de atención",
        subtitle:
          "Bundles de condiciones, medidas de calidad y seguimiento del cumplimiento poblacional",
        untitledBundle: "Bundle sin título",
        tabs: {
          bundles: "Bundles de enfermedades",
          population: "Resumen poblacional",
        },
      },
      bundleList: {
        searchPlaceholder: "Buscar bundles...",
        allCategories: "Todas las categorías",
        sortName: "Nombre",
        sortCompliance: "Cumplimiento",
        noBundlesFound: "No se encontraron bundles",
        adjustFilters: "Prueba ajustando los filtros",
        createToGetStarted: "Crea un bundle para empezar",
      },
      bundleDetail: {
        failedToLoad: "No se pudo cargar el bundle",
        backToCareGaps: "Brechas de atención",
        overallCompliance: "Cumplimiento general",
        tabs: {
          design: "Diseño",
          compliance: "Resultados de cumplimiento",
          overlap: "Reglas de solapamiento",
        },
        executeEvaluation: "Ejecutar evaluación",
        overall: "General",
        totalPatients: "Total de pacientes",
        gapsMet: "Brechas cubiertas",
        openGaps: "Brechas abiertas",
        excluded: "Excluidos",
        evaluationHistory: "Historial de evaluación",
        sourceLabel: "Fuente #{{value}}",
        evaluationInProgress: "Evaluación en curso...",
        noEvaluationResults:
          "Aún no hay resultados de evaluación. Ejecuta una evaluación para ver los datos de cumplimiento.",
        deleteConfirm:
          "¿Seguro que quieres eliminar este bundle de condición?",
      },
      bundleDesigner: {
        bundleDetails: "Detalles del bundle",
        bundleCode: "Código del bundle",
        conditionName: "Nombre de la condición",
        description: "Descripción",
        diseaseCategory: "Categoría de enfermedad",
        selectCategory: "Selecciona una categoría...",
        icd10Patterns: "Patrones ICD-10",
        omopConceptIds: "IDs de concepto OMOP",
        ecqmReferences: "Referencias eCQM",
        attachedMeasures: "Medidas asociadas",
        noMeasuresAttached: "No hay medidas asociadas a este bundle.",
        saveBundle: "Guardar bundle",
        saving: "Guardando...",
        add: "Añadir",
        remove: "Eliminar",
        placeholders: {
          bundleCode: "p. ej., DM2-BUNDLE",
          conditionName: "p. ej., diabetes mellitus tipo 2",
          description: "Describe el bundle...",
          icd10: "p. ej., E11%",
          conceptId: "Introduce el ID del concepto",
          ecqm: "p. ej., CMS122v11",
        },
      },
      measureCompliance: {
        noResultsAvailable: "Aún no hay resultados de medidas disponibles.",
        code: "Código",
        measure: "Medida",
        domain: "Dominio",
        eligible: "Elegible",
        met: "Cumplida",
        notMet: "No cumplida",
        compliance: "Cumplimiento",
        deduplicated: "Deduplicada",
        deduplicatedFrom: "Deduplicada de: {{value}}",
      },
      population: {
        selectSourcePrompt:
          "Selecciona una fuente de datos para ver el cumplimiento poblacional.",
        failedToLoad: "No se pudo cargar el resumen poblacional.",
        totalBundles: "Total de bundles",
        totalPatients: "Total de pacientes",
        avgCompliance: "Cumplimiento medio",
        totalOpenGaps: "Total de brechas abiertas",
        filterByCategory: "Filtrar por categoría:",
        bundleComplianceComparison: "Comparación de cumplimiento por bundle",
        noBundlesMatchFilter:
          "Ningún bundle coincide con el filtro seleccionado.",
        patientsShort: "{{count}} pts",
      },
      overlapRules: {
        failedToLoad: "No se pudieron cargar las reglas de solapamiento.",
        noneConfigured: "No hay reglas de solapamiento configuradas.",
        subtitle:
          "Las reglas de solapamiento evitan el doble conteo de medidas entre bundles.",
      },
    },
    publish: {
      steps: {
        selectAnalyses: "Seleccionar análisis",
        configure: "Configurar",
        preview: "Vista previa",
        export: "Exportar",
      },
      common: {
        actions: {
          back: "Atrás",
          next: "Siguiente",
          previewDocument: "Vista previa del documento ->",
          configureDocument: "Configurar documento ->",
          close: "Cerrar",
        },
        sectionType: {
          title: "Título",
          methods: "Métodos",
          results: "Resultados",
          diagram: "Diagrama",
          discussion: "Discusión",
          diagnostics: "Diagnósticos",
        },
        analysisType: {
          characterizations: "Caracterización",
          characterization: "Caracterización",
          estimations: "Estimación",
          estimation: "Estimación",
          predictions: "Predicción",
          prediction: "Predicción",
          incidence_rates: "Tasa de incidencia",
          incidence_rate: "Tasa de incidencia",
          evidence_synthesis: "Síntesis de evidencia",
          pathways: "Trayectoria",
          pathway: "Trayectoria",
        },
        resultSection: {
          populationCharacteristics: "Características poblacionales",
          incidenceRates: "Tasas de incidencia",
          comparativeEffectiveness: "Efectividad comparativa",
          treatmentPatterns: "Patrones de tratamiento",
          safetyAnalysis: "Análisis de seguridad",
          predictiveModeling: "Modelado predictivo",
          evidenceSynthesis: "Síntesis de evidencia",
        },
      },
      page: {
        title: "Publicar",
        subtitle:
          "Crea manuscritos de prepublicación a partir de estudios y análisis",
        startNewDocument: "Iniciar nuevo documento",
        untitledDocument: "Documento sin título",
      },
      cart: {
        selected: "Seleccionados ({{count}})",
        empty: "Aún no hay análisis seleccionados",
        removeAnalysis: "Eliminar {{name}}",
      },
      configurator: {
        documentTitle: "Título del documento",
        documentTitlePlaceholder: "Introduce el título del documento...",
        authors: "Autores (separados por comas)",
        authorsPlaceholder: "Autor Uno, Autor Dos...",
        template: "Plantilla",
      },
      preview: {
        diagramDataNotAvailable: "Datos del diagrama no disponibles",
        unknownDiagramType: "Tipo de diagrama desconocido",
        reviewWarning:
          "Algunas secciones generadas por IA no han sido revisadas. Acepta o edita todo el contenido de IA antes de exportar.",
        generatedLabel: "Generado {{date}}",
        noSectionContent: "No hay contenido disponible para esta sección.",
        noSectionsIncluded:
          "No se incluyó ninguna sección. Vuelve para configurar tu documento.",
        backToConfigure: "Volver a configurar",
        export: "Exportar",
      },
      exportControls: {
        exportFormat: "Formato de exportación",
        comingSoon: "Próximamente",
        exporting: "Exportando...",
        exportAs: "Exportar como {{format}}",
        formats: {
          pdf: {
            description:
              "Informe completo y formateado a través del cuadro de impresión",
          },
          docx: {
            description: "Documento de Word estructurado",
          },
          xlsx: {
            description: "Tablas y estadísticas como hoja de cálculo",
          },
          png: {
            description: "Gráficos como archivos de imagen ráster",
          },
          svg: {
            description: "Gráficos como archivos de imagen vectorial",
          },
        },
      },
      exportPanel: {
        draftWarning:
          "Algunas secciones generadas por IA todavía están en borrador. Vuelve y acepta o edita todo el contenido de IA antes de exportar.",
        chooseExportFormat: "Elegir formato de exportación",
        exporting: "Exportando...",
        exportAs: "Exportar como {{format}}",
        backToPreview: "Volver a la vista previa",
        formatLabels: {
          figuresZip: "ZIP de figuras",
        },
        formats: {
          docx: {
            label: "Documento de Microsoft Word",
            description:
              "Manuscrito listo para revista con figuras incrustadas",
          },
          pdf: {
            label: "Documento PDF",
            description:
              "Documento listo para impresión, revisión y distribución",
          },
          figuresZip: {
            label: "Figuras individuales",
            description:
              "Archivos SVG para carga independiente en la revista",
          },
        },
      },
      methods: {
        studyDesign: "Diseño del estudio",
        primaryObjective: "Objetivo principal",
        hypothesis: "Hipótesis",
        scientificRationale: "Justificación científica",
        cohortDefinitions: "Definiciones de cohorte",
        target: "Objetivo",
        comparator: "Comparador",
        outcome: "Resultado",
        timeAtRisk: "Tiempo en riesgo",
        start: "Inicio",
        end: "Fin",
        matchingStrategy: "Estrategia de emparejamiento",
        modelSettings: "Configuración del modelo",
        empty:
          "No hay datos de métodos disponibles. Los métodos se generarán automáticamente cuando se proporcionen los parámetros del análisis.",
        defaults: {
          observational: "Observacional",
          cohortStart: "inicio de cohorte",
          cohortEnd: "fin de cohorte",
        },
      },
      reportPreview: {
        title: "Vista previa del informe del estudio",
        subtitle:
          "Activa o desactiva secciones y reordénalas con los controles. Solo las secciones incluidas aparecerán en la exportación.",
        empty:
          "No hay secciones para previsualizar. Vuelve y selecciona las ejecuciones del análisis.",
      },
      reportSection: {
        moveUp: "Mover arriba",
        moveDown: "Mover abajo",
        diagnosticsPlaceholder:
          "Los datos de diagnóstico se representarán en el informe exportado.",
        includeSection: "Incluir sección",
        excludeSection: "Excluir sección",
        included: "Incluida",
        excluded: "Excluida",
      },
      resultsSummary: {
        empty: "No hay datos de resultados disponibles para esta ejecución.",
      },
      resultsTable: {
        empty: "No hay datos estructurados disponibles para esta tabla.",
        caption: "Tabla {{number}}. {{title}}",
      },
      sectionEditor: {
        tableLabel: "Tabla",
        aiNarrative: "Narrativa de IA",
        structuredData: "Datos estructurados",
        hideTable: "Ocultar tabla",
        showTable: "Mostrar tabla",
        hideNarrative: "Ocultar narrativa",
        showNarrative: "Mostrar narrativa",
        hideDiagram: "Ocultar diagrama",
        showDiagram: "Mostrar diagrama",
        noDiagram: "Aún no se ha generado ningún diagrama",
      },
      studySelector: {
        loadingStudies: "Cargando estudios...",
        failedToLoad: "No se pudieron cargar los estudios. Inténtalo de nuevo.",
        selectStudy: "Seleccionar un estudio",
        noStudiesFound: "No se encontraron estudios. Crea uno primero.",
        completedExecutions: "Ejecuciones completadas",
        loadingExecutions: "Cargando ejecuciones...",
        noCompletedExecutions:
          "No se encontraron ejecuciones completadas para este estudio.",
        executionLabel: "Ejecución #{{value}}",
      },
      analysisPicker: {
        filter: {
          allTypes: "Todos los tipos",
        },
        searchAnalyses: "Buscar análisis...",
        searchStudies: "Buscar estudios...",
        tabs: {
          allAnalyses: "Todos los análisis",
          fromStudies: "Desde estudios",
        },
        loadingAnalyses: "Cargando análisis...",
        noCompletedAnalyses:
          "No se encontraron análisis completados",
        loadingStudies: "Cargando estudios...",
        noStudiesMatchFilters:
          "Ningún estudio coincide con tus filtros",
        noStudiesFound: "No se encontraron estudios",
        completedAnalyses_one: "{{count}} análisis completado",
        completedAnalyses_other: "{{count}} análisis completados",
        actions: {
          selectAll: "Seleccionar todo",
          deselectAll: "Deseleccionar todo",
        },
      },
      aiNarrative: {
        generate: "Generar borrador con IA",
        generating: "Generando narrativa...",
        draft: "Borrador de IA",
        accept: "Aceptar",
        regenerate: "Regenerar",
        accepted: "Aceptado",
        edit: "Editar",
      },
      structuredData: {
        empty: "No hay datos estructurados disponibles",
      },
      diagram: {
        exportSvg: "Exportar como SVG",
        exportPng: "Exportar como PNG",
      },
      tables: {
        captions: {
          incidenceRatesByCohort: "Tasas de incidencia por cohorte",
          comparativeEffectivenessEstimates:
            "Estimaciones de efectividad comparativa",
          sccsEstimates:
            "Serie de casos autocontrolada: razones de tasas de incidencia por ventana de exposición",
          treatmentPathways: "Trayectorias de tratamiento (top 10)",
          populationCharacteristics: "Características poblacionales",
          predictionModelPerformance:
            "Desempeño del modelo de predicción",
          evidenceSynthesisPooled:
            "Síntesis de evidencia: estimaciones combinadas",
        },
        headers: {
          cohort: "Cohorte",
          outcome: "Resultado",
          events: "Eventos",
          personYears: "Persona-años",
          ratePer1000Py: "Tasa/1000PY",
          exposureWindow: "Ventana de exposición",
          pathway: "Trayectoria",
          patients: "Pacientes",
          percentFemale: "% mujeres",
          percentMale: "% hombres",
          ageGroup: "Grupo de edad",
          model: "Modelo",
          brierScore: "Puntaje de Brier",
          targetN: "N objetivo",
          outcomeN: "N de resultado",
          analysis: "Análisis",
          pooledEstimate: "Estimación combinada",
        },
      },
      templates: {
        "generic-ohdsi": {
          name: "Publicación OHDSI genérica",
          description:
            "Estructura IMRaD estándar para estudios observacionales con datos de salud",
          sections: {
            introduction: "Introducción",
            methods: "Métodos",
            discussion: "Discusión",
          },
        },
        "comparative-effectiveness": {
          name: "Informe de efectividad comparativa",
          description:
            "Estructura CLE/CER con análisis de puntuación de propensión",
          sections: {
            background: "Antecedentes",
            "study-design": "Diseño del estudio",
            "ps-matching": "Emparejamiento por puntuación de propensión",
            covariates: "Balance de covariables",
            "sensitivity-analyses": "Análisis de sensibilidad",
            discussion: "Discusión",
          },
        },
        "incidence-report": {
          name: "Informe de tasa de incidencia",
          description: "Análisis de incidencia basado en la población",
          sections: {
            background: "Antecedentes",
            methods: "Métodos",
            discussion: "Discusión",
          },
        },
        "study-protocol": {
          name: "Protocolo de estudio / SAP",
          description:
            "Plan de análisis estadístico previo al estudio - no se requieren resultados",
          sections: {
            objectives: "Objetivos",
            hypotheses: "Hipótesis",
            "study-design": "Diseño del estudio",
            "data-sources": "Fuentes de datos",
            "cohort-definitions": "Definiciones de cohorte",
            "analysis-plan": "Plan de análisis",
            timeline: "Cronograma",
          },
        },
        "jamia-style": {
          name: "Estilo JAMIA",
          description:
            "Journal of the American Medical Informatics Association - enfoque en metodología de informática con énfasis en reproducibilidad",
          sections: {
            "background-significance": "Antecedentes y relevancia",
            objective: "Objetivo",
            "materials-methods": "Materiales y métodos",
            "data-sources": "Fuentes de datos y población del estudio",
            "phenotype-definitions": "Definiciones de fenotipo",
            "statistical-analysis": "Análisis estadístico",
            discussion: "Discusión",
            limitations: "Limitaciones",
            conclusion: "Conclusión",
          },
        },
        "lancet-style": {
          name: "Estilo Lancet",
          description:
            "The Lancet - enfoque en salud global con métodos estructurados, interpretación basada en evidencia e implicaciones de política",
          sections: {
            introduction: "Introducción",
            methods: "Métodos",
            "study-design-participants": "Diseño del estudio y participantes",
            procedures: "Procedimientos",
            outcomes: "Resultados",
            "statistical-analysis": "Análisis estadístico",
            "role-of-funding": "Papel de la fuente de financiación",
            discussion: "Discusión",
          },
        },
        "nejm-style": {
          name: "Estilo NEJM",
          description:
            "New England Journal of Medicine - estructura clínica concisa con gran economía de palabras",
          sections: {
            introduction: "Introducción",
            methods: "Métodos",
            "study-design": "Diseño del estudio y supervisión",
            patients: "Pacientes",
            endpoints: "Criterios de valoración",
            "statistical-analysis": "Análisis estadístico",
            discussion: "Discusión",
          },
        },
        "himss-poster": {
          name: "Póster HIMSS",
          description:
            "Póster de conferencia HIMSS - paneles concisos para antecedentes, métodos, hallazgos clave e impacto",
          sections: {
            background: "Antecedentes",
            "problem-statement": "Planteamiento del problema",
            objectives: "Objetivos",
            methods: "Métodos",
            "key-findings": "Hallazgos clave",
            "clinical-impact": "Impacto clínico y operativo",
            "next-steps": "Próximos pasos",
          },
        },
      },
    },
  },
);

const koPublishCareGapRisk: MessageTree = mergeMessageTrees(
  enPublishCareGapRisk,
  {
    riskScores: {
      common: {
        status: {
          draft: "초안",
          pending: "대기 중",
          running: "실행 중",
          completed: "완료",
          failed: "실패",
        },
        tier: {
          low: "낮음",
          intermediate: "중간",
          high: "높음",
          veryHigh: "매우 높음",
          uncomputable: "계산 불가",
          filtered: "필터됨",
          customFilter: "사용자 지정 필터",
        },
        category: {
          cardiovascular: "심혈관",
          comorbidityBurden: "동반질환 부담",
          hepatic: "간",
          pulmonary: "폐",
          respiratory: "호흡기",
          metabolic: "대사",
          endocrine: "내분비",
          musculoskeletal: "근골격",
        },
        tabs: {
          overview: "개요",
          results: "결과",
          patients: "환자",
          recommendations: "권장사항",
          configuration: "구성",
        },
        actions: {
          back: "뒤로",
          close: "닫기",
          cancel: "취소",
          clear: "지우기",
          refresh: "새로고침",
          reRun: "다시 실행",
          reRunAnalysis: "분석 다시 실행",
          runAnalysis: "분석 실행",
          quickRun: "빠른 실행",
          createAnalysis: "분석 생성",
          createCohort: "코호트 생성",
          createCohortFromFilter: "필터에서 코호트 생성",
          newAnalysis: "새 분석",
          duplicateAnalysis: "분석 복제",
          deleteAnalysis: "분석 삭제",
          openCatalogue: "카탈로그 열기",
          viewFullResults: "전체 결과 보기",
        },
        values: {
          noneSelected: "선택 없음",
          noDescription: "설명 없음",
          unknown: "알 수 없음",
          yes: "예",
          no: "아니요",
        },
        view: {
          table: "표 보기",
          card: "카드 보기",
        },
        search: {
          analysesPlaceholder: "분석 검색...",
          noMatch: "\"{{query}}\"와 일치하는 분석이 없습니다",
          typeToFilter: "{{count}}개 분석을 필터링하려면 입력하세요",
        },
        count: {
          cohort_one: "코호트 {{count}}개",
          cohort_other: "코호트 {{count}}개",
          score_one: "점수 {{count}}개",
          score_other: "점수 {{count}}개",
          analysis_one: "분석 {{count}}개",
          analysis_other: "분석 {{count}}개",
          patient_one: "환자 {{count}}명",
          patient_other: "환자 {{count}}명",
        },
        duration: {
          seconds: "{{value}}초",
          minutesSeconds: "{{minutes}}분 {{seconds}}초",
          total: "총 {{value}}",
        },
        headers: {
          name: "이름",
          cohort: "코호트",
          scores: "점수",
          status: "상태",
          lastRun: "마지막 실행",
          author: "작성자",
          created: "생성일",
          tier: "등급",
          count: "개수",
          meanScore: "평균 점수",
          confidence: "신뢰도",
          score: "점수",
          value: "값",
          riskTier: "위험 등급",
          completeness: "완전성",
          missing: "누락",
          started: "시작됨",
          duration: "소요 시간",
          actions: "작업",
        },
        pagination: {
          showingRange: "{{total}}개 중 {{from}}-{{to}} 표시",
        },
      },
      hub: {
        title: "위험 점수 분석",
        subtitle:
          "검증된 임상 위험 점수로 환자 집단을 층화합니다",
        metrics: {
          total: "전체",
          running: "실행 중",
          completed: "완료",
          scoresAvailable: "사용 가능한 점수",
          patientsScored: "점수가 산출된 환자",
        },
        filters: {
          status: "상태",
          category: "범주",
          allCategories: "모든 범주",
        },
        tabs: {
          analyses: "분석",
          scoreCatalogue: "점수 카탈로그",
        },
        drilldown: {
          analyses: "{{status}} 분석",
        },
        empty: {
          noMatchingAnalyses: "일치하는 분석이 없습니다",
          noRiskScoreAnalysesYet: "아직 위험 점수 분석이 없습니다",
          noAnalysesFoundFor:
            "\"{{query}}\"에 대한 분석을 찾을 수 없습니다",
          createFirst:
            "첫 번째 분석을 생성하여 임상 위험 점수로 환자를 층화하세요.",
        },
        errors: {
          failedToLoadAnalyses:
            "분석을 불러오지 못했습니다. 다시 시도하세요.",
        },
        catalogue: {
          checkingEligibility: "적격성 확인 중...",
          showingEligibilityFor: "{{source}}의 적격성 표시 중",
          eligibleSummary: "{{total}}개 중 {{eligible}}개 점수 사용 가능",
          completedResults: "완료된 결과 {{count}}개",
          selectSourcePrompt:
            "각 점수의 적격성을 확인하려면 헤더에서 데이터 소스를 선택하세요.",
          sourceLevelCompletedScores: "소스 수준 완료 점수",
          sourceLevelCompletedScoresDetail:
            "활성 소스에 완료된 점수 {{count}}개가 있지만 어떤 v2 분석 실행에도 연결되어 있지 않습니다.",
          sourceLevelCompletedScoresDetail_other:
            "활성 소스에 완료된 점수 {{count}}개가 있지만 어떤 v2 분석 실행에도 연결되어 있지 않습니다.",
          eligibleCount: "{{count}}개 사용 가능",
          completedCount: "{{count}}개 완료",
        },
      },
      create: {
        title: "새 위험 점수 분석",
        subtitle:
          "위험 점수 분석을 구성하고 계산할 점수를 선택합니다",
        steps: {
          configure: "구성",
          reviewAndRun: "검토 및 실행",
        },
        basics: "기본 정보",
        name: "이름 *",
        description: "설명",
        targetCohort: "대상 코호트 *",
        selectCohort: "코호트 선택...",
        scoreSelection: "점수 선택",
        cohortPatients: "환자 {{count}}명",
        autoNameSuffix: "위험 층화",
        placeholders: {
          name: "예: 심부전 코호트 - 위험 층화",
          description: "이 위험 점수 분석에 대한 선택적 설명...",
        },
        completeness: "완전성:",
        createAsDraft: "초안으로 생성",
        createAndRun: "생성 후 실행",
        errors: {
          executionFailed:
            "분석은 생성되었지만 실행에 실패했습니다. 상세 페이지에서 다시 실행할 수 있습니다.",
          createFailed: "분석을 생성하지 못했습니다. 다시 시도하세요.",
        },
        recommendations: {
          recommended: "권장",
          available: "사용 가능",
          notApplicable: "해당 없음",
        },
      },
      detail: {
        notFound: "분석을 찾을 수 없습니다",
        backToRiskScores: "위험 점수로 돌아가기",
        selectSourcePrompt:
          "실행하거나 결과를 보려면 데이터 소스를 선택하세요.",
        deleteConfirm:
          "이 분석을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      },
      overview: {
        about: "정보",
        author: "작성자: {{value}}",
        created: "생성일: {{value}}",
        updated: "업데이트: {{value}}",
        resultsSummary: "결과 요약",
        scoresComputed: "계산된 점수",
        uniqueScores: "고유 점수",
        patientsScored: "점수가 산출된 환자",
        maxPerScore: "점수별 최대값",
        avgCompleteness: "평균 완전성",
        avgConfidence: "평균 신뢰도",
        acrossSummaries: "요약 전체 기준",
        thisAnalysisHasNotBeenExecutedYet:
          "이 분석은 아직 실행되지 않았습니다.",
        executionInProgress: "실행 진행 중...",
        lastExecutionFailed: "마지막 실행이 실패했습니다.",
        recentExecution: "최근 실행",
        started: "시작됨",
        completed: "완료됨",
        duration: "소요 시간",
      },
      configuration: {
        analysisDesign: "분석 설계",
        targetCohorts: "대상 코호트",
        selectedScores: "선택된 점수",
        parameters: "매개변수",
        minCompleteness: "최소 완전성:",
        storePatientLevel: "환자 수준 저장:",
        executionHistory: "실행 기록",
        noExecutionsYet: "아직 실행 기록이 없습니다",
      },
      results: {
        noResultsAvailable:
          "사용 가능한 결과가 없습니다. 위험 점수를 계산하려면 분석을 실행하세요.",
        allScores: "모든 점수",
        percentOfTotal: "전체 대비 %",
        action: "작업",
        averageCompleteness: "평균 완전성:",
      },
      patients: {
        noExecutionSelected: "선택된 실행이 없습니다",
        runExecutionToViewPatientLevel:
          "환자 수준 결과를 보려면 실행을 수행하세요.",
        all: "전체",
        showingPatients: "환자 {{count}}명 표시 중",
        patientsOnPage: "이 페이지의 환자 {{count}}명",
        noPatientResultsAvailable: "환자 결과가 없습니다",
        adjustFilters: "결과를 보려면 필터를 조정해 보세요.",
        executeToGenerate:
          "환자 수준 점수를 생성하려면 분석을 실행하세요.",
        personId: "환자 ID",
      },
      scoreDetail: {
        selectSourcePrompt:
          "적격성을 확인하려면 헤더에서 데이터 소스를 선택하세요.",
        eligiblePatients:
          "사용 가능 - {{count}}명의 환자에게 충분한 데이터가 있습니다",
        insufficientData: "활성 소스의 데이터가 부족합니다",
        missing: "누락:",
        checkingEligibility: "활성 소스의 적격성 확인 중...",
        eligiblePopulation: "적격 인구",
        requiredComponents: "필수 구성 요소",
        cdmTablesUsed: "사용된 CDM 테이블",
        riskTierDefinitions: "위험 등급 정의",
        scoreRange: "점수 범위",
      },
      createCohort: {
        title: "위험 등급에서 코호트 생성",
        cohortName: "코호트 이름",
        description: "설명",
        patientsIncluded: "환자 {{count}}명이 포함됩니다",
        showDetails: "세부 정보 표시",
        hideDetails: "세부 정보 숨기기",
        analysisId: "분석 ID:",
        executionId: "실행 ID:",
        score: "점수:",
        tier: "등급:",
        createFailed: "코호트를 생성하지 못했습니다. 다시 시도하세요.",
        derivedDescription:
          "'{{cohort}}' 코호트에서 {{score}} 위험 등급이 {{tier}}인 환자",
        defaultName: "{{score}} - {{tier}} 위험 - {{cohort}}",
      },
      recommendations: {
        selectSourceToView: "권장사항을 보려면 소스를 선택하세요",
        recommended: "권장",
        available: "사용 가능",
        notApplicable: "해당 없음",
      },
      runModal: {
        title: "인구 집단 위험 점수",
        computingScores: "점수 계산 중...",
        completedScoresIn:
          "{{duration}} 동안 점수 {{count}}개 완료",
        completedScoresIn_other:
          "{{duration}} 동안 점수 {{count}}개 완료",
        runFailed: "실행 실패",
        passed: "{{count}}개 통과",
        failed: "{{count}}개 실패",
        skipped: "{{count}}개 건너뜀",
        seconds: "초",
        tiers: "등급 {{count}}개",
      },
      tierBreakdown: {
        tierDistribution: "등급 분포",
        patientsPerTier: "등급별 환자 수",
        patients: "환자",
      },
      cohortProfile: {
        demographics: "인구통계",
        patients: "환자",
        age: "연령",
        female: "여성 {{count}}%",
        topConditions: "주요 질환",
        measurementCoverage: "측정값 커버리지",
      },
    },
    careGaps: {
      common: {
        status: {
          pending: "대기 중",
          running: "실행 중",
          completed: "완료",
          failed: "실패",
        },
        actions: {
          newBundle: "새 번들",
          delete: "삭제",
          evaluate: "평가",
          backToList: "목록으로 돌아가기",
          saveChanges: "변경 사항 저장",
          createBundle: "번들 생성",
        },
        category: {
          all: "전체",
          endocrine: "내분비",
          cardiovascular: "심혈관",
          respiratory: "호흡기",
          mentalHealth: "정신 건강",
          rheumatologic: "류마티스",
          neurological: "신경학",
          oncology: "종양학",
        },
        bundle: {
          active: "활성",
          inactive: "비활성",
          measure_one: "측정치 {{count}}개",
          measure_other: "측정치 {{count}}개",
        },
      },
      page: {
        title: "케어 갭",
        subtitle:
          "질환 번들, 품질 지표, 인구 집단 준수도 추적",
        untitledBundle: "제목 없는 번들",
        tabs: {
          bundles: "질환 번들",
          population: "인구 집단 개요",
        },
      },
      bundleList: {
        searchPlaceholder: "번들 검색...",
        allCategories: "모든 범주",
        sortName: "이름",
        sortCompliance: "준수도",
        noBundlesFound: "번들을 찾을 수 없습니다",
        adjustFilters: "필터를 조정해 보세요",
        createToGetStarted: "시작하려면 번들을 만드세요",
      },
      bundleDetail: {
        failedToLoad: "번들을 불러오지 못했습니다",
        backToCareGaps: "케어 갭",
        overallCompliance: "전체 준수도",
        tabs: {
          design: "설계",
          compliance: "준수 결과",
          overlap: "중복 규칙",
        },
        executeEvaluation: "평가 실행",
        overall: "전체",
        totalPatients: "전체 환자",
        gapsMet: "충족된 갭",
        openGaps: "미해결 갭",
        excluded: "제외됨",
        evaluationHistory: "평가 기록",
        sourceLabel: "소스 #{{value}}",
        evaluationInProgress: "평가 진행 중...",
        noEvaluationResults:
          "아직 평가 결과가 없습니다. 준수 데이터를 보려면 평가를 실행하세요.",
        deleteConfirm:
          "이 질환 번들을 삭제하시겠습니까?",
      },
      bundleDesigner: {
        bundleDetails: "번들 세부 정보",
        bundleCode: "번들 코드",
        conditionName: "질환 이름",
        description: "설명",
        diseaseCategory: "질환 범주",
        selectCategory: "범주 선택...",
        icd10Patterns: "ICD-10 패턴",
        omopConceptIds: "OMOP 개념 ID",
        ecqmReferences: "eCQM 참조",
        attachedMeasures: "연결된 측정치",
        noMeasuresAttached: "이 번들에 연결된 측정치가 없습니다.",
        saveBundle: "번들 저장",
        saving: "저장 중...",
        add: "추가",
        remove: "제거",
        placeholders: {
          bundleCode: "예: DM2-BUNDLE",
          conditionName: "예: 제2형 당뇨병",
          description: "번들을 설명하세요...",
          icd10: "예: E11%",
          conceptId: "개념 ID 입력",
          ecqm: "예: CMS122v11",
        },
      },
      measureCompliance: {
        noResultsAvailable: "아직 사용 가능한 측정 결과가 없습니다.",
        code: "코드",
        measure: "측정치",
        domain: "도메인",
        eligible: "적격",
        met: "충족",
        notMet: "미충족",
        compliance: "준수도",
        deduplicated: "중복 제거됨",
        deduplicatedFrom: "다음에서 중복 제거됨: {{value}}",
      },
      population: {
        selectSourcePrompt:
          "인구 집단 준수도를 보려면 데이터 소스를 선택하세요.",
        failedToLoad: "인구 집단 요약을 불러오지 못했습니다.",
        totalBundles: "전체 번들",
        totalPatients: "전체 환자",
        avgCompliance: "평균 준수도",
        totalOpenGaps: "전체 미해결 갭",
        filterByCategory: "범주별 필터:",
        bundleComplianceComparison: "번들 준수도 비교",
        noBundlesMatchFilter:
          "선택한 필터와 일치하는 번들이 없습니다.",
      },
      overlapRules: {
        failedToLoad: "중복 규칙을 불러오지 못했습니다.",
        noneConfigured: "구성된 중복 규칙이 없습니다.",
        subtitle:
          "중복 규칙은 번들 간 측정치의 이중 집계를 방지합니다.",
      },
    },
    publish: {
      steps: {
        selectAnalyses: "분석 선택",
        configure: "구성",
        preview: "미리보기",
        export: "내보내기",
      },
      common: {
        actions: {
          back: "뒤로",
          next: "다음",
          previewDocument: "문서 미리보기 ->",
          configureDocument: "문서 구성 ->",
          close: "닫기",
        },
        sectionType: {
          title: "제목",
          methods: "방법",
          results: "결과",
          diagram: "도표",
          discussion: "논의",
          diagnostics: "진단",
        },
        analysisType: {
          characterizations: "특성화",
          characterization: "특성화",
          estimations: "추정",
          estimation: "추정",
          predictions: "예측",
          prediction: "예측",
          incidence_rates: "발생률",
          incidence_rate: "발생률",
          evidence_synthesis: "근거 종합",
          pathways: "경로",
          pathway: "경로",
        },
        resultSection: {
          populationCharacteristics: "인구 집단 특성",
          incidenceRates: "발생률",
          comparativeEffectiveness: "비교 효과성",
          treatmentPatterns: "치료 패턴",
          safetyAnalysis: "안전성 분석",
          predictiveModeling: "예측 모델링",
          evidenceSynthesis: "근거 종합",
        },
      },
      page: {
        title: "출판",
        subtitle:
          "연구와 분석에서 사전 출판용 원고를 생성합니다",
        startNewDocument: "새 문서 시작",
        untitledDocument: "제목 없는 문서",
      },
      cart: {
        selected: "선택됨 ({{count}})",
        empty: "아직 선택된 분석이 없습니다",
        removeAnalysis: "{{name}} 제거",
      },
      configurator: {
        documentTitle: "문서 제목",
        documentTitlePlaceholder: "문서 제목 입력...",
        authors: "저자(쉼표로 구분)",
        authorsPlaceholder: "저자 1, 저자 2...",
        template: "템플릿",
      },
      preview: {
        diagramDataNotAvailable: "도표 데이터를 사용할 수 없습니다",
        unknownDiagramType: "알 수 없는 도표 유형",
        reviewWarning:
          "일부 AI 생성 섹션이 아직 검토되지 않았습니다. 내보내기 전에 모든 AI 콘텐츠를 수락하거나 수정하세요.",
        generatedLabel: "{{date}} 생성",
        noSectionContent: "이 섹션에 사용할 수 있는 콘텐츠가 없습니다.",
        noSectionsIncluded:
          "포함된 섹션이 없습니다. 문서 구성을 위해 뒤로 이동하세요.",
        backToConfigure: "구성으로 돌아가기",
        export: "내보내기",
      },
      exportControls: {
        exportFormat: "내보내기 형식",
        comingSoon: "곧 제공",
        exporting: "내보내는 중...",
        exportAs: "{{format}}로 내보내기",
        formats: {
          pdf: {
            description: "인쇄 대화상자를 통한 전체 형식 보고서",
          },
          docx: {
            description: "구조화된 Word 문서",
          },
          xlsx: {
            description: "표와 통계를 스프레드시트로 내보내기",
          },
          png: {
            description: "차트를 래스터 이미지 파일로 내보내기",
          },
          svg: {
            description: "차트를 벡터 이미지 파일로 내보내기",
          },
        },
      },
      exportPanel: {
        draftWarning:
          "일부 AI 생성 섹션이 아직 초안 상태입니다. 내보내기 전에 모든 AI 콘텐츠를 수락하거나 수정하세요.",
        chooseExportFormat: "내보내기 형식 선택",
        exporting: "내보내는 중...",
        exportAs: "{{format}}로 내보내기",
        backToPreview: "미리보기로 돌아가기",
        formatLabels: {
          figuresZip: "도표 ZIP",
        },
        formats: {
          docx: {
            label: "Microsoft Word 문서",
            description: "그림이 포함된 저널 제출용 원고",
          },
          pdf: {
            label: "PDF 문서",
            description: "검토와 공유를 위한 인쇄용 문서",
          },
          figuresZip: {
            label: "개별 그림",
            description: "저널 별도 업로드용 SVG 파일",
          },
        },
      },
      methods: {
        studyDesign: "연구 설계",
        primaryObjective: "주요 목적",
        hypothesis: "가설",
        scientificRationale: "과학적 근거",
        cohortDefinitions: "코호트 정의",
        target: "대상",
        comparator: "비교군",
        outcome: "결과",
        timeAtRisk: "위험 기간",
        start: "시작",
        end: "종료",
        matchingStrategy: "매칭 전략",
        modelSettings: "모델 설정",
        empty:
          "사용 가능한 방법 데이터가 없습니다. 분석 매개변수가 제공되면 자동으로 생성됩니다.",
        defaults: {
          observational: "관찰 연구",
          cohortStart: "코호트 시작",
          cohortEnd: "코호트 종료",
        },
      },
      reportPreview: {
        title: "연구 보고서 미리보기",
        subtitle:
          "섹션을 켜거나 끄고 컨트롤을 사용해 순서를 바꾸세요. 포함된 섹션만 내보내기에 나타납니다.",
        empty:
          "미리볼 섹션이 없습니다. 뒤로 돌아가 분석 실행을 선택하세요.",
      },
      reportSection: {
        moveUp: "위로 이동",
        moveDown: "아래로 이동",
        diagnosticsPlaceholder:
          "진단 데이터는 내보낸 보고서에 렌더링됩니다.",
        includeSection: "섹션 포함",
        excludeSection: "섹션 제외",
        included: "포함됨",
        excluded: "제외됨",
      },
      resultsSummary: {
        empty: "이 실행에 사용할 수 있는 결과 데이터가 없습니다.",
      },
      resultsTable: {
        empty: "이 표에 사용할 수 있는 구조화 데이터가 없습니다.",
        caption: "표 {{number}}. {{title}}",
      },
      sectionEditor: {
        tableLabel: "표",
        aiNarrative: "AI 서술",
        structuredData: "구조화 데이터",
        hideTable: "표 숨기기",
        showTable: "표 표시",
        hideNarrative: "서술 숨기기",
        showNarrative: "서술 표시",
        hideDiagram: "도표 숨기기",
        showDiagram: "도표 표시",
        noDiagram: "아직 생성된 도표가 없습니다",
      },
      studySelector: {
        loadingStudies: "연구 불러오는 중...",
        failedToLoad:
          "연구를 불러오지 못했습니다. 다시 시도하세요.",
        selectStudy: "연구 선택",
        noStudiesFound:
          "연구를 찾을 수 없습니다. 먼저 연구를 생성하세요.",
        completedExecutions: "완료된 실행",
        loadingExecutions: "실행 불러오는 중...",
        noCompletedExecutions:
          "이 연구에 대한 완료된 실행을 찾을 수 없습니다.",
        executionLabel: "실행 #{{value}}",
      },
      analysisPicker: {
        filter: {
          allTypes: "모든 유형",
        },
        searchAnalyses: "분석 검색...",
        searchStudies: "연구 검색...",
        tabs: {
          allAnalyses: "모든 분석",
          fromStudies: "연구에서",
        },
        loadingAnalyses: "분석 불러오는 중...",
        noCompletedAnalyses:
          "완료된 분석을 찾을 수 없습니다",
        loadingStudies: "연구 불러오는 중...",
        noStudiesMatchFilters:
          "필터와 일치하는 연구가 없습니다",
        noStudiesFound: "연구를 찾을 수 없습니다",
        completedAnalyses_one: "완료된 분석 {{count}}개",
        completedAnalyses_other: "완료된 분석 {{count}}개",
        actions: {
          selectAll: "모두 선택",
          deselectAll: "모두 선택 해제",
        },
      },
      aiNarrative: {
        generate: "AI 초안 생성",
        generating: "서술 생성 중...",
        draft: "AI 초안",
        accept: "수락",
        regenerate: "다시 생성",
        accepted: "수락됨",
        edit: "편집",
      },
      structuredData: {
        empty: "사용 가능한 구조화 데이터가 없습니다",
      },
      diagram: {
        exportSvg: "SVG로 내보내기",
        exportPng: "PNG로 내보내기",
      },
      tables: {
        captions: {
          incidenceRatesByCohort: "코호트별 발생률",
          comparativeEffectivenessEstimates: "비교 효과성 추정치",
          sccsEstimates:
            "자기 대조 사례군 연구: 노출 구간별 발생률비",
          treatmentPathways: "치료 경로 (상위 10개)",
          populationCharacteristics: "인구 집단 특성",
          predictionModelPerformance: "예측 모델 성능",
          evidenceSynthesisPooled: "근거 종합: 통합 추정치",
        },
        headers: {
          cohort: "코호트",
          outcome: "결과",
          events: "이벤트",
          personYears: "인년",
          ratePer1000Py: "발생률/1000PY",
          exposureWindow: "노출 구간",
          pathway: "경로",
          patients: "환자",
          percentFemale: "% 여성",
          percentMale: "% 남성",
          ageGroup: "연령대",
          model: "모델",
          brierScore: "Brier 점수",
          targetN: "대상 N",
          outcomeN: "결과 N",
          analysis: "분석",
          pooledEstimate: "통합 추정치",
        },
      },
      templates: {
        "generic-ohdsi": {
          name: "일반 OHDSI 출판 템플릿",
          description:
            "관찰 건강 데이터 연구를 위한 표준 IMRaD 구조",
          sections: {
            introduction: "서론",
            methods: "방법",
            discussion: "논의",
          },
        },
        "comparative-effectiveness": {
          name: "비교 효과성 보고서",
          description: "성향 점수 분석이 포함된 CLE/CER 구조",
          sections: {
            background: "배경",
            "study-design": "연구 설계",
            "ps-matching": "성향 점수 매칭",
            covariates: "공변량 균형",
            "sensitivity-analyses": "민감도 분석",
            discussion: "논의",
          },
        },
        "incidence-report": {
          name: "발생률 보고서",
          description: "인구 기반 발생 분석",
          sections: {
            background: "배경",
            methods: "방법",
            discussion: "논의",
          },
        },
        "study-protocol": {
          name: "연구 프로토콜 / SAP",
          description:
            "연구 전 통계 분석 계획 - 결과 불필요",
          sections: {
            objectives: "목표",
            hypotheses: "가설",
            "study-design": "연구 설계",
            "data-sources": "데이터 소스",
            "cohort-definitions": "코호트 정의",
            "analysis-plan": "분석 계획",
            timeline: "일정",
          },
        },
        "jamia-style": {
          name: "JAMIA 스타일",
          description:
            "Journal of the American Medical Informatics Association - 재현성을 강조한 의료정보학 방법론 중심",
          sections: {
            "background-significance": "배경과 의의",
            objective: "목적",
            "materials-methods": "재료 및 방법",
            "data-sources": "데이터 소스와 연구 집단",
            "phenotype-definitions": "표현형 정의",
            "statistical-analysis": "통계 분석",
            discussion: "논의",
            limitations: "제한점",
            conclusion: "결론",
          },
        },
        "lancet-style": {
          name: "Lancet 스타일",
          description:
            "The Lancet - 구조화된 방법, 근거 기반 해석, 정책적 함의를 강조한 글로벌 보건 중심",
          sections: {
            introduction: "서론",
            methods: "방법",
            "study-design-participants": "연구 설계 및 참여자",
            procedures: "절차",
            outcomes: "결과",
            "statistical-analysis": "통계 분석",
            "role-of-funding": "재원 지원 기관의 역할",
            discussion: "논의",
          },
        },
        "nejm-style": {
          name: "NEJM 스타일",
          description:
            "New England Journal of Medicine - 간결한 임상 중심 구조",
          sections: {
            introduction: "서론",
            methods: "방법",
            "study-design": "연구 설계 및 감독",
            patients: "환자",
            endpoints: "평가 변수",
            "statistical-analysis": "통계 분석",
            discussion: "논의",
          },
        },
        "himss-poster": {
          name: "HIMSS 포스터",
          description:
            "HIMSS 학회 포스터 - 배경, 방법, 주요 결과, 영향 진술을 위한 간결한 패널 구성",
          sections: {
            background: "배경",
            "problem-statement": "문제 정의",
            objectives: "목표",
            methods: "방법",
            "key-findings": "주요 결과",
            "clinical-impact": "임상 및 운영 영향",
            "next-steps": "다음 단계",
          },
        },
      },
    },
  },
);

const hiPublishCareGapRisk: MessageTree = mergeMessageTrees(
  enPublishCareGapRisk,
  {
    riskScores: {
      common: {
        status: {
          draft: "मसौदा",
          pending: "लंबित",
          running: "चल रहा है",
          completed: "पूर्ण",
          failed: "विफल",
        },
        tier: {
          low: "निम्न",
          intermediate: "मध्यम",
          high: "उच्च",
          veryHigh: "बहुत उच्च",
          uncomputable: "गणना नहीं हो सकी",
          filtered: "फ़िल्टर किया गया",
          customFilter: "कस्टम फ़िल्टर",
        },
        category: {
          cardiovascular: "हृदय संबंधी",
          comorbidityBurden: "सह-रोग भार",
          hepatic: "यकृत",
          pulmonary: "फुफ्फुसीय",
          respiratory: "श्वसन",
          metabolic: "चयापचयी",
          endocrine: "अंतःस्रावी",
          musculoskeletal: "मस्क्युलोस्केलेटल",
        },
        tabs: {
          overview: "अवलोकन",
          results: "परिणाम",
          patients: "रोगी",
          recommendations: "सिफारिशें",
          configuration: "कॉन्फ़िगरेशन",
        },
        actions: {
          back: "वापस",
          close: "बंद करें",
          cancel: "रद्द करें",
          clear: "साफ़ करें",
          refresh: "रीफ़्रेश",
          reRun: "फिर चलाएँ",
          reRunAnalysis: "विश्लेषण फिर चलाएँ",
          runAnalysis: "विश्लेषण चलाएँ",
          quickRun: "त्वरित रन",
          createAnalysis: "विश्लेषण बनाएँ",
          createCohort: "कोहोर्ट बनाएँ",
          createCohortFromFilter: "फ़िल्टर से कोहोर्ट बनाएँ",
          newAnalysis: "नया विश्लेषण",
          duplicateAnalysis: "विश्लेषण की प्रतिलिपि बनाएँ",
          deleteAnalysis: "विश्लेषण हटाएँ",
          openCatalogue: "कैटलॉग खोलें",
          viewFullResults: "पूर्ण परिणाम देखें",
        },
        values: {
          noneSelected: "कोई चयन नहीं",
          noDescription: "कोई विवरण नहीं",
          unknown: "अज्ञात",
          yes: "हाँ",
          no: "नहीं",
        },
        view: {
          table: "तालिका दृश्य",
          card: "कार्ड दृश्य",
        },
        search: {
          analysesPlaceholder: "विश्लेषण खोजें...",
          noMatch: "\"{{query}}\" से मेल खाने वाला कोई विश्लेषण नहीं मिला",
          typeToFilter: "{{count}} विश्लेषण फ़िल्टर करने के लिए लिखें",
        },
        count: {
          cohort_one: "{{count}} कोहोर्ट",
          cohort_other: "{{count}} कोहोर्ट",
          score_one: "{{count}} स्कोर",
          score_other: "{{count}} स्कोर",
          analysis_one: "{{count}} विश्लेषण",
          analysis_other: "{{count}} विश्लेषण",
          patient_one: "{{count}} रोगी",
          patient_other: "{{count}} रोगी",
        },
        duration: {
          seconds: "{{value}} सेकंड",
          minutesSeconds: "{{minutes}} मि {{seconds}} से",
          total: "कुल {{value}}",
        },
        headers: {
          name: "नाम",
          cohort: "कोहोर्ट",
          scores: "स्कोर",
          status: "स्थिति",
          lastRun: "अंतिम रन",
          author: "लेखक",
          created: "बनाया गया",
          tier: "स्तर",
          count: "गणना",
          meanScore: "औसत स्कोर",
          confidence: "विश्वास",
          score: "स्कोर",
          value: "मान",
          riskTier: "जोखिम स्तर",
          completeness: "पूर्णता",
          missing: "गायब",
          started: "शुरू हुआ",
          duration: "अवधि",
          actions: "क्रियाएँ",
        },
        pagination: {
          showingRange: "{{total}} में से {{from}}-{{to}} दिखाया जा रहा है",
        },
      },
      hub: {
        title: "जोखिम स्कोर विश्लेषण",
        subtitle:
          "मान्य नैदानिक जोखिम स्कोर के आधार पर रोगी आबादी को स्तरीकृत करें",
        metrics: {
          total: "कुल",
          running: "चल रहे हैं",
          completed: "पूर्ण",
          scoresAvailable: "उपलब्ध स्कोर",
          patientsScored: "स्कोर किए गए रोगी",
        },
        filters: {
          status: "स्थिति",
          category: "श्रेणी",
          allCategories: "सभी श्रेणियाँ",
        },
        tabs: {
          analyses: "विश्लेषण",
          scoreCatalogue: "स्कोर कैटलॉग",
        },
        drilldown: {
          analyses: "{{status}} विश्लेषण",
        },
        empty: {
          noMatchingAnalyses: "कोई मेल खाने वाला विश्लेषण नहीं",
          noRiskScoreAnalysesYet: "अभी तक कोई जोखिम स्कोर विश्लेषण नहीं है",
          noAnalysesFoundFor:
            "\"{{query}}\" के लिए कोई विश्लेषण नहीं मिला",
          createFirst:
            "नैदानिक जोखिम स्कोर के आधार पर रोगियों को स्तरीकृत करने के लिए अपना पहला विश्लेषण बनाएँ.",
        },
        errors: {
          failedToLoadAnalyses:
            "विश्लेषण लोड नहीं हो सके. कृपया फिर से प्रयास करें.",
        },
        catalogue: {
          checkingEligibility: "पात्रता जाँची जा रही है...",
          showingEligibilityFor:
            "{{source}} के लिए पात्रता दिखाई जा रही है",
          eligibleSummary: "{{total}} में से {{eligible}} स्कोर पात्र हैं",
          completedResults: "{{count}} पूर्ण परिणाम",
          selectSourcePrompt:
            "हर स्कोर की पात्रता जाँचने के लिए हेडर से डेटा स्रोत चुनें.",
          sourceLevelCompletedScores: "स्रोत-स्तर पूर्ण स्कोर",
          sourceLevelCompletedScoresDetail:
            "सक्रिय स्रोत के लिए {{count}} पूर्ण स्कोर मौजूद है, लेकिन किसी v2 विश्लेषण निष्पादन से जुड़ा नहीं है.",
          sourceLevelCompletedScoresDetail_other:
            "सक्रिय स्रोत के लिए {{count}} पूर्ण स्कोर मौजूद हैं, लेकिन किसी v2 विश्लेषण निष्पादन से जुड़े नहीं हैं.",
          eligibleCount: "{{count}} पात्र",
          completedCount: "{{count}} पूर्ण",
        },
      },
      create: {
        title: "नया जोखिम स्कोर विश्लेषण",
        subtitle:
          "जोखिम स्कोरिंग विश्लेषण कॉन्फ़िगर करें और गणना के लिए स्कोर चुनें",
        steps: {
          configure: "कॉन्फ़िगर करें",
          reviewAndRun: "समीक्षा करें और चलाएँ",
        },
        basics: "मूल बातें",
        name: "नाम *",
        description: "विवरण",
        targetCohort: "लक्ष्य कोहोर्ट *",
        selectCohort: "कोहोर्ट चुनें...",
        scoreSelection: "स्कोर चयन",
        cohortPatients: "{{count}} रोगी",
        autoNameSuffix: "जोखिम स्तरीकरण",
        placeholders: {
          name:
            "उदा. हार्ट फेल्योर कोहोर्ट - जोखिम स्तरीकरण",
          description:
            "इस जोखिम स्कोरिंग विश्लेषण का वैकल्पिक विवरण...",
        },
        completeness: "पूर्णता:",
        createAsDraft: "मसौदे के रूप में बनाएँ",
        createAndRun: "बनाएँ और चलाएँ",
        errors: {
          executionFailed:
            "विश्लेषण बना दिया गया, लेकिन निष्पादन विफल हुआ. आप इसे विवरण पृष्ठ से फिर चला सकते हैं.",
          createFailed:
            "विश्लेषण बनाया नहीं जा सका. कृपया फिर से प्रयास करें.",
        },
        recommendations: {
          recommended: "अनुशंसित",
          available: "उपलब्ध",
          notApplicable: "लागू नहीं",
        },
      },
      detail: {
        notFound: "विश्लेषण नहीं मिला",
        backToRiskScores: "जोखिम स्कोर पर वापस जाएँ",
        selectSourcePrompt:
          "निष्पादन चलाने या परिणाम देखने के लिए डेटा स्रोत चुनें.",
        deleteConfirm:
          "क्या आप इस विश्लेषण को हटाना चाहते हैं? यह क्रिया वापस नहीं ली जा सकती.",
      },
      overview: {
        about: "परिचय",
        author: "लेखक: {{value}}",
        created: "बनाया गया: {{value}}",
        updated: "अद्यतन: {{value}}",
        resultsSummary: "परिणाम सारांश",
        scoresComputed: "गणना किए गए स्कोर",
        uniqueScores: "अद्वितीय स्कोर",
        patientsScored: "स्कोर किए गए रोगी",
        maxPerScore: "प्रति स्कोर अधिकतम",
        avgCompleteness: "औसत पूर्णता",
        avgConfidence: "औसत विश्वास",
        acrossSummaries: "सारांशों में",
        thisAnalysisHasNotBeenExecutedYet:
          "यह विश्लेषण अभी तक चलाया नहीं गया है.",
        executionInProgress: "निष्पादन जारी है...",
        lastExecutionFailed: "पिछला निष्पादन विफल हुआ.",
        recentExecution: "हालिया निष्पादन",
        started: "शुरू हुआ",
        completed: "पूर्ण",
        duration: "अवधि",
      },
      configuration: {
        analysisDesign: "विश्लेषण डिज़ाइन",
        targetCohorts: "लक्ष्य कोहोर्ट",
        selectedScores: "चयनित स्कोर",
        parameters: "पैरामीटर",
        minCompleteness: "न्यूनतम पूर्णता:",
        storePatientLevel: "रोगी-स्तर संग्रहीत करें:",
        executionHistory: "निष्पादन इतिहास",
        noExecutionsYet: "अभी तक कोई निष्पादन नहीं",
      },
      results: {
        noResultsAvailable:
          "कोई परिणाम उपलब्ध नहीं हैं. जोखिम स्कोर की गणना के लिए विश्लेषण चलाएँ.",
        allScores: "सभी स्कोर",
        percentOfTotal: "कुल का %",
        action: "क्रिया",
        averageCompleteness: "औसत पूर्णता:",
      },
      patients: {
        noExecutionSelected: "कोई निष्पादन चयनित नहीं है",
        runExecutionToViewPatientLevel:
          "रोगी-स्तर परिणाम देखने के लिए निष्पादन चलाएँ.",
        all: "सभी",
        showingPatients: "{{count}} रोगी दिखाए जा रहे हैं",
        patientsOnPage: "इस पृष्ठ पर {{count}} रोगी",
        noPatientResultsAvailable: "कोई रोगी-स्तर परिणाम उपलब्ध नहीं है",
        adjustFilters:
          "परिणाम देखने के लिए अपने फ़िल्टर समायोजित करें.",
        executeToGenerate:
          "रोगी-स्तर स्कोर बनाने के लिए विश्लेषण चलाएँ.",
        personId: "व्यक्ति ID",
      },
      scoreDetail: {
        selectSourcePrompt:
          "पात्रता जाँचने के लिए हेडर से डेटा स्रोत चुनें.",
        eligiblePatients:
          "पात्र - {{count}} रोगियों के पास पर्याप्त डेटा है",
        insufficientData: "सक्रिय स्रोत में पर्याप्त डेटा नहीं है",
        missing: "गायब:",
        checkingEligibility:
          "सक्रिय स्रोत के लिए पात्रता जाँची जा रही है...",
        eligiblePopulation: "पात्र आबादी",
        requiredComponents: "आवश्यक घटक",
        cdmTablesUsed: "प्रयुक्त CDM तालिकाएँ",
        riskTierDefinitions: "जोखिम स्तर की परिभाषाएँ",
        scoreRange: "स्कोर सीमा",
      },
      createCohort: {
        title: "जोखिम स्तर से कोहोर्ट बनाएँ",
        cohortName: "कोहोर्ट नाम",
        description: "विवरण",
        patientsIncluded: "{{count}} रोगियों को शामिल किया जाएगा",
        showDetails: "विवरण दिखाएँ",
        hideDetails: "विवरण छिपाएँ",
        analysisId: "विश्लेषण ID:",
        executionId: "निष्पादन ID:",
        score: "स्कोर:",
        tier: "स्तर:",
        createFailed: "कोहोर्ट बनाई नहीं जा सकी. कृपया फिर से प्रयास करें.",
        derivedDescription:
          "कोहोर्ट '{{cohort}}' के वे रोगी जिनका {{score}} जोखिम स्तर = {{tier}} है",
        defaultName: "{{score}} - {{tier}} जोखिम - {{cohort}}",
      },
      recommendations: {
        selectSourceToView:
          "सिफारिशें देखने के लिए स्रोत चुनें",
        recommended: "अनुशंसित",
        available: "उपलब्ध",
        notApplicable: "लागू नहीं",
      },
      runModal: {
        title: "जनसंख्या जोखिम स्कोर",
        computingScores: "स्कोर की गणना हो रही है...",
        completedScoresIn:
          "{{duration}} में {{count}} स्कोर पूर्ण",
        completedScoresIn_other:
          "{{duration}} में {{count}} स्कोर पूर्ण",
        runFailed: "रन विफल हुआ",
        passed: "{{count}} सफल",
        failed: "{{count}} विफल",
        skipped: "{{count}} छोड़े गए",
        seconds: "सेकंड",
        tiers: "{{count}} स्तर",
      },
      tierBreakdown: {
        tierDistribution: "स्तर वितरण",
        patientsPerTier: "प्रति स्तर रोगी",
        patients: "रोगी",
      },
      cohortProfile: {
        demographics: "जनसांख्यिकी",
        patients: "रोगी",
        age: "आयु",
        female: "{{count}}% महिला",
        topConditions: "शीर्ष स्थितियाँ",
        measurementCoverage: "मापन कवरेज",
      },
    },
    careGaps: {
      common: {
        status: {
          pending: "लंबित",
          running: "चल रहा है",
          completed: "पूर्ण",
          failed: "विफल",
        },
        actions: {
          newBundle: "नया बंडल",
          delete: "हटाएँ",
          evaluate: "मूल्यांकन करें",
          backToList: "सूची पर वापस जाएँ",
          saveChanges: "परिवर्तन सहेजें",
          createBundle: "बंडल बनाएँ",
        },
        category: {
          all: "सभी",
          endocrine: "अंतःस्रावी",
          cardiovascular: "हृदय संबंधी",
          respiratory: "श्वसन",
          mentalHealth: "मानसिक स्वास्थ्य",
          rheumatologic: "रूमेटोलॉजिक",
          neurological: "न्यूरोलॉजिक",
          oncology: "ऑन्कोलॉजी",
        },
        bundle: {
          active: "सक्रिय",
          inactive: "निष्क्रिय",
          measure_one: "{{count}} माप",
          measure_other: "{{count}} माप",
        },
      },
      page: {
        title: "केयर गैप्स",
        subtitle:
          "स्थिति बंडल, गुणवत्ता मापदंड और आबादी अनुपालन ट्रैकिंग",
        untitledBundle: "बिना शीर्षक वाला बंडल",
        tabs: {
          bundles: "रोग बंडल",
          population: "आबादी अवलोकन",
        },
      },
      bundleList: {
        searchPlaceholder: "बंडल खोजें...",
        allCategories: "सभी श्रेणियाँ",
        sortName: "नाम",
        sortCompliance: "अनुपालन",
        noBundlesFound: "कोई बंडल नहीं मिला",
        adjustFilters: "अपने फ़िल्टर समायोजित करें",
        createToGetStarted: "शुरू करने के लिए एक बंडल बनाएँ",
      },
      bundleDetail: {
        failedToLoad: "बंडल लोड नहीं हो सका",
        backToCareGaps: "केयर गैप्स",
        overallCompliance: "कुल अनुपालन",
        tabs: {
          design: "डिज़ाइन",
          compliance: "अनुपालन परिणाम",
          overlap: "ओवरलैप नियम",
        },
        executeEvaluation: "मूल्यांकन चलाएँ",
        overall: "कुल",
        totalPatients: "कुल रोगी",
        gapsMet: "पूरे हुए गैप्स",
        openGaps: "खुले गैप्स",
        excluded: "बहिष्कृत",
        evaluationHistory: "मूल्यांकन इतिहास",
        sourceLabel: "स्रोत #{{value}}",
        evaluationInProgress: "मूल्यांकन जारी है...",
        noEvaluationResults:
          "अभी तक कोई मूल्यांकन परिणाम नहीं है. अनुपालन डेटा देखने के लिए मूल्यांकन चलाएँ.",
        deleteConfirm:
          "क्या आप इस स्थिति बंडल को हटाना चाहते हैं?",
      },
      bundleDesigner: {
        bundleDetails: "बंडल विवरण",
        bundleCode: "बंडल कोड",
        conditionName: "स्थिति का नाम",
        description: "विवरण",
        diseaseCategory: "रोग श्रेणी",
        selectCategory: "श्रेणी चुनें...",
        icd10Patterns: "ICD-10 पैटर्न",
        omopConceptIds: "OMOP कॉन्सेप्ट ID",
        ecqmReferences: "eCQM संदर्भ",
        attachedMeasures: "संलग्न मापदंड",
        noMeasuresAttached:
          "इस बंडल से कोई मापदंड संलग्न नहीं है.",
        saveBundle: "बंडल सहेजें",
        saving: "सहेजा जा रहा है...",
        add: "जोड़ें",
        remove: "हटाएँ",
        placeholders: {
          bundleCode: "उदा. DM2-BUNDLE",
          conditionName: "उदा. टाइप 2 डायबिटीज मेलिटस",
          description: "बंडल का वर्णन करें...",
          icd10: "उदा. E11%",
          conceptId: "कॉन्सेप्ट ID दर्ज करें",
          ecqm: "उदा. CMS122v11",
        },
      },
      measureCompliance: {
        noResultsAvailable: "अभी तक कोई माप परिणाम उपलब्ध नहीं है.",
        code: "कोड",
        measure: "मापदंड",
        domain: "डोमेन",
        eligible: "पात्र",
        met: "पूरा हुआ",
        notMet: "पूरा नहीं हुआ",
        compliance: "अनुपालन",
        deduplicated: "डी-डुप्लिकेट किया गया",
        deduplicatedFrom: "इससे डी-डुप्लिकेट किया गया: {{value}}",
      },
      population: {
        selectSourcePrompt:
          "आबादी अनुपालन देखने के लिए डेटा स्रोत चुनें.",
        failedToLoad: "आबादी सारांश लोड नहीं हो सका.",
        totalBundles: "कुल बंडल",
        totalPatients: "कुल रोगी",
        avgCompliance: "औसत अनुपालन",
        totalOpenGaps: "कुल खुले गैप्स",
        filterByCategory: "श्रेणी से फ़िल्टर करें:",
        bundleComplianceComparison: "बंडल अनुपालन तुलना",
        noBundlesMatchFilter:
          "चयनित फ़िल्टर से कोई बंडल मेल नहीं खाता.",
      },
      overlapRules: {
        failedToLoad: "ओवरलैप नियम लोड नहीं हो सके.",
        noneConfigured: "कोई ओवरलैप नियम कॉन्फ़िगर नहीं है.",
        subtitle:
          "ओवरलैप नियम बंडलों के बीच मापदंडों की दोहरी गणना रोकते हैं.",
      },
    },
    publish: {
      steps: {
        selectAnalyses: "विश्लेषण चुनें",
        configure: "कॉन्फ़िगर करें",
        preview: "पूर्वावलोकन",
        export: "निर्यात",
      },
      common: {
        actions: {
          back: "वापस",
          next: "अगला",
          previewDocument: "दस्तावेज़ पूर्वावलोकन ->",
          configureDocument: "दस्तावेज़ कॉन्फ़िगर करें ->",
          close: "बंद करें",
        },
        sectionType: {
          title: "शीर्षक",
          methods: "विधियाँ",
          results: "परिणाम",
          diagram: "आरेख",
          discussion: "चर्चा",
          diagnostics: "डायग्नोस्टिक्स",
        },
        analysisType: {
          characterizations: "विशेषता निर्धारण",
          characterization: "विशेषता निर्धारण",
          estimations: "आकलन",
          estimation: "आकलन",
          predictions: "पूर्वानुमान",
          prediction: "पूर्वानुमान",
          incidence_rates: "घटनादर",
          incidence_rate: "घटनादर",
          evidence_synthesis: "साक्ष्य संकलन",
          pathways: "पाथवे",
          pathway: "पाथवे",
        },
        resultSection: {
          populationCharacteristics: "आबादी विशेषताएँ",
          incidenceRates: "घटनादर",
          comparativeEffectiveness: "तुलनात्मक प्रभावशीलता",
          treatmentPatterns: "उपचार पैटर्न",
          safetyAnalysis: "सुरक्षा विश्लेषण",
          predictiveModeling: "पूर्वानुमान मॉडलिंग",
          evidenceSynthesis: "साक्ष्य संकलन",
        },
      },
      page: {
        title: "प्रकाशित करें",
        subtitle:
          "अध्ययनों और विश्लेषणों से पूर्व-प्रकाशन पांडुलिपियाँ तैयार करें",
        startNewDocument: "नया दस्तावेज़ शुरू करें",
        untitledDocument: "बिना शीर्षक वाला दस्तावेज़",
      },
      cart: {
        selected: "चयनित ({{count}})",
        empty: "अभी तक कोई विश्लेषण चयनित नहीं है",
        removeAnalysis: "{{name}} हटाएँ",
      },
      configurator: {
        documentTitle: "दस्तावेज़ शीर्षक",
        documentTitlePlaceholder: "दस्तावेज़ शीर्षक दर्ज करें...",
        authors: "लेखक (कॉमा से अलग)",
        authorsPlaceholder: "लेखक एक, लेखक दो...",
        template: "टेम्पलेट",
      },
      preview: {
        diagramDataNotAvailable: "आरेख डेटा उपलब्ध नहीं है",
        unknownDiagramType: "अज्ञात आरेख प्रकार",
        reviewWarning:
          "कुछ AI-जनित अनुभागों की अभी समीक्षा नहीं हुई है. निर्यात से पहले सभी AI सामग्री स्वीकार या संपादित करें.",
        generatedLabel: "{{date}} को जनित",
        noSectionContent: "इस अनुभाग के लिए कोई सामग्री उपलब्ध नहीं है.",
        noSectionsIncluded:
          "कोई अनुभाग शामिल नहीं है. अपना दस्तावेज़ कॉन्फ़िगर करने के लिए वापस जाएँ.",
        backToConfigure: "कॉन्फ़िगरेशन पर वापस जाएँ",
        export: "निर्यात",
      },
      exportControls: {
        exportFormat: "निर्यात फ़ॉर्मैट",
        comingSoon: "जल्द आ रहा है",
        exporting: "निर्यात हो रहा है...",
        exportAs: "{{format}} के रूप में निर्यात करें",
        formats: {
          pdf: {
            description: "प्रिंट डायलॉग के माध्यम से पूर्ण फ़ॉर्मैटेड रिपोर्ट",
          },
          docx: {
            description: "संरचित Word दस्तावेज़",
          },
          xlsx: {
            description: "तालिकाएँ और सांख्यिकी स्प्रेडशीट के रूप में",
          },
          png: {
            description: "चार्ट रास्टर इमेज फ़ाइलों के रूप में",
          },
          svg: {
            description: "चार्ट वेक्टर इमेज फ़ाइलों के रूप में",
          },
        },
      },
      exportPanel: {
        draftWarning:
          "कुछ AI-जनित अनुभाग अभी भी मसौदा स्थिति में हैं. निर्यात से पहले वापस जाकर सभी AI सामग्री स्वीकार या संपादित करें.",
        chooseExportFormat: "निर्यात फ़ॉर्मैट चुनें",
        exporting: "निर्यात हो रहा है...",
        exportAs: "{{format}} के रूप में निर्यात करें",
        backToPreview: "पूर्वावलोकन पर वापस जाएँ",
        formatLabels: {
          figuresZip: "फ़िगर्स ZIP",
        },
        formats: {
          docx: {
            label: "Microsoft Word दस्तावेज़",
            description:
              "एम्बेडेड फ़िगर्स के साथ जर्नल-तैयार पांडुलिपि",
          },
          pdf: {
            label: "PDF दस्तावेज़",
            description:
              "समीक्षा और साझा करने के लिए प्रिंट-तैयार दस्तावेज़",
          },
          figuresZip: {
            label: "अलग-अलग फ़िगर्स",
            description:
              "अलग जर्नल अपलोड के लिए SVG फ़ाइलें",
          },
        },
      },
      methods: {
        studyDesign: "अध्ययन डिज़ाइन",
        primaryObjective: "मुख्य उद्देश्य",
        hypothesis: "परिकल्पना",
        scientificRationale: "वैज्ञानिक औचित्य",
        cohortDefinitions: "कोहोर्ट परिभाषाएँ",
        target: "लक्ष्य",
        comparator: "तुलनाकार",
        outcome: "परिणाम",
        timeAtRisk: "जोखिम अवधि",
        start: "आरंभ",
        end: "समाप्ति",
        matchingStrategy: "मैचिंग रणनीति",
        modelSettings: "मॉडल सेटिंग्स",
        empty:
          "कोई विधि डेटा उपलब्ध नहीं है. विश्लेषण पैरामीटर दिए जाने पर विधियाँ अपने आप बनेंगी.",
        defaults: {
          observational: "प्रेक्षणात्मक",
          cohortStart: "कोहोर्ट प्रारंभ",
          cohortEnd: "कोहोर्ट समाप्ति",
        },
      },
      reportPreview: {
        title: "अध्ययन रिपोर्ट पूर्वावलोकन",
        subtitle:
          "अनुभागों को चालू/बंद करें और कंट्रोल्स से पुनःक्रमित करें. केवल शामिल अनुभाग निर्यात में दिखाई देंगे.",
        empty:
          "पूर्वावलोकन के लिए कोई अनुभाग नहीं है. वापस जाकर विश्लेषण निष्पादन चुनें.",
      },
      reportSection: {
        moveUp: "ऊपर ले जाएँ",
        moveDown: "नीचे ले जाएँ",
        diagnosticsPlaceholder:
          "डायग्नोस्टिक्स डेटा निर्यातित रिपोर्ट में रेंडर किया जाएगा.",
        includeSection: "अनुभाग शामिल करें",
        excludeSection: "अनुभाग हटाएँ",
        included: "शामिल",
        excluded: "बहिष्कृत",
      },
      resultsSummary: {
        empty: "इस निष्पादन के लिए कोई परिणाम डेटा उपलब्ध नहीं है.",
      },
      resultsTable: {
        empty: "इस तालिका के लिए कोई संरचित डेटा उपलब्ध नहीं है.",
        caption: "तालिका {{number}}. {{title}}",
      },
      sectionEditor: {
        tableLabel: "तालिका",
        aiNarrative: "AI नैरेटिव",
        structuredData: "संरचित डेटा",
        hideTable: "तालिका छिपाएँ",
        showTable: "तालिका दिखाएँ",
        hideNarrative: "नैरेटिव छिपाएँ",
        showNarrative: "नैरेटिव दिखाएँ",
        hideDiagram: "आरेख छिपाएँ",
        showDiagram: "आरेख दिखाएँ",
        noDiagram: "अभी तक कोई आरेख नहीं बना",
      },
      studySelector: {
        loadingStudies: "अध्ययन लोड हो रहे हैं...",
        failedToLoad:
          "अध्ययन लोड नहीं हो सके. कृपया फिर से प्रयास करें.",
        selectStudy: "अध्ययन चुनें",
        noStudiesFound:
          "कोई अध्ययन नहीं मिला. पहले एक अध्ययन बनाएँ.",
        completedExecutions: "पूर्ण निष्पादन",
        loadingExecutions: "निष्पादन लोड हो रहे हैं...",
        noCompletedExecutions:
          "इस अध्ययन के लिए कोई पूर्ण निष्पादन नहीं मिला.",
        executionLabel: "निष्पादन #{{value}}",
      },
      analysisPicker: {
        filter: {
          allTypes: "सभी प्रकार",
        },
        searchAnalyses: "विश्लेषण खोजें...",
        searchStudies: "अध्ययन खोजें...",
        tabs: {
          allAnalyses: "सभी विश्लेषण",
          fromStudies: "अध्ययनों से",
        },
        loadingAnalyses: "विश्लेषण लोड हो रहे हैं...",
        noCompletedAnalyses:
          "कोई पूर्ण विश्लेषण नहीं मिला",
        loadingStudies: "अध्ययन लोड हो रहे हैं...",
        noStudiesMatchFilters:
          "कोई अध्ययन आपके फ़िल्टर से मेल नहीं खाता",
        noStudiesFound: "कोई अध्ययन नहीं मिला",
        completedAnalyses_one: "{{count}} पूर्ण विश्लेषण",
        completedAnalyses_other: "{{count}} पूर्ण विश्लेषण",
        actions: {
          selectAll: "सभी चुनें",
          deselectAll: "सभी अचयनित करें",
        },
      },
      aiNarrative: {
        generate: "AI मसौदा बनाएँ",
        generating: "नैरेटिव बनाया जा रहा है...",
        draft: "AI मसौदा",
        accept: "स्वीकार करें",
        regenerate: "फिर से बनाएँ",
        accepted: "स्वीकार किया गया",
        edit: "संपादित करें",
      },
      structuredData: {
        empty: "कोई संरचित डेटा उपलब्ध नहीं है",
      },
      diagram: {
        exportSvg: "SVG के रूप में निर्यात करें",
        exportPng: "PNG के रूप में निर्यात करें",
      },
      tables: {
        captions: {
          incidenceRatesByCohort: "कोहोर्ट के अनुसार घटनादर",
          comparativeEffectivenessEstimates:
            "तुलनात्मक प्रभावशीलता अनुमान",
          sccsEstimates:
            "स्व-नियंत्रित केस सीरीज़: एक्सपोज़र विंडो के अनुसार घटनादर अनुपात",
          treatmentPathways: "उपचार पाथवे (शीर्ष 10)",
          populationCharacteristics: "आबादी विशेषताएँ",
          predictionModelPerformance: "पूर्वानुमान मॉडल प्रदर्शन",
          evidenceSynthesisPooled: "साक्ष्य संकलन: संयुक्त अनुमान",
        },
        headers: {
          cohort: "कोहोर्ट",
          outcome: "परिणाम",
          events: "घटनाएँ",
          personYears: "व्यक्ति-वर्ष",
          ratePer1000Py: "दर/1000PY",
          exposureWindow: "एक्सपोज़र विंडो",
          pathway: "पाथवे",
          patients: "रोगी",
          percentFemale: "% महिला",
          percentMale: "% पुरुष",
          ageGroup: "आयु समूह",
          model: "मॉडल",
          brierScore: "Brier स्कोर",
          targetN: "लक्ष्य N",
          outcomeN: "परिणाम N",
          analysis: "विश्लेषण",
          pooledEstimate: "संयुक्त अनुमान",
        },
      },
      templates: {
        "generic-ohdsi": {
          name: "सामान्य OHDSI प्रकाशन",
          description:
            "पर्यवेक्षणीय स्वास्थ्य डेटा अध्ययनों के लिए मानक IMRaD संरचना",
          sections: {
            introduction: "परिचय",
            methods: "विधियाँ",
            discussion: "चर्चा",
          },
        },
        "comparative-effectiveness": {
          name: "तुलनात्मक प्रभावशीलता रिपोर्ट",
          description:
            "प्रोपेन्सिटी स्कोर विश्लेषण के साथ CLE/CER संरचना",
          sections: {
            background: "पृष्ठभूमि",
            "study-design": "अध्ययन डिज़ाइन",
            "ps-matching": "प्रोपेन्सिटी स्कोर मैचिंग",
            covariates: "कोवेरिएट संतुलन",
            "sensitivity-analyses": "संवेदनशीलता विश्लेषण",
            discussion: "चर्चा",
          },
        },
        "incidence-report": {
          name: "घटनादर रिपोर्ट",
          description: "आबादी-आधारित घटनादर विश्लेषण",
          sections: {
            background: "पृष्ठभूमि",
            methods: "विधियाँ",
            discussion: "चर्चा",
          },
        },
        "study-protocol": {
          name: "अध्ययन प्रोटोकॉल / SAP",
          description:
            "अध्ययन-पूर्व सांख्यिकीय विश्लेषण योजना - परिणाम आवश्यक नहीं",
          sections: {
            objectives: "उद्देश्य",
            hypotheses: "परिकल्पनाएँ",
            "study-design": "अध्ययन डिज़ाइन",
            "data-sources": "डेटा स्रोत",
            "cohort-definitions": "कोहोर्ट परिभाषाएँ",
            "analysis-plan": "विश्लेषण योजना",
            timeline: "समयरेखा",
          },
        },
        "jamia-style": {
          name: "JAMIA शैली",
          description:
            "Journal of the American Medical Informatics Association - पुनरुत्पादकता पर ज़ोर के साथ इन्फॉर्मेटिक्स पद्धति केंद्रित",
          sections: {
            "background-significance": "पृष्ठभूमि और महत्व",
            objective: "उद्देश्य",
            "materials-methods": "सामग्री और विधियाँ",
            "data-sources": "डेटा स्रोत और अध्ययन आबादी",
            "phenotype-definitions": "फेनोटाइप परिभाषाएँ",
            "statistical-analysis": "सांख्यिकीय विश्लेषण",
            discussion: "चर्चा",
            limitations: "सीमाएँ",
            conclusion: "निष्कर्ष",
          },
        },
        "lancet-style": {
          name: "Lancet शैली",
          description:
            "The Lancet - संरचित विधियों, साक्ष्य-आधारित व्याख्या और नीतिगत निहितार्थों के साथ वैश्विक स्वास्थ्य केंद्रित",
          sections: {
            introduction: "परिचय",
            methods: "विधियाँ",
            "study-design-participants": "अध्ययन डिज़ाइन और प्रतिभागी",
            procedures: "प्रक्रियाएँ",
            outcomes: "परिणाम",
            "statistical-analysis": "सांख्यिकीय विश्लेषण",
            "role-of-funding": "वित्तपोषण स्रोत की भूमिका",
            discussion: "चर्चा",
          },
        },
        "nejm-style": {
          name: "NEJM शैली",
          description:
            "New England Journal of Medicine - संक्षिप्त नैदानिक प्रभाव संरचना",
          sections: {
            introduction: "परिचय",
            methods: "विधियाँ",
            "study-design": "अध्ययन डिज़ाइन और पर्यवेक्षण",
            patients: "रोगी",
            endpoints: "समापन बिंदु",
            "statistical-analysis": "सांख्यिकीय विश्लेषण",
            discussion: "चर्चा",
          },
        },
        "himss-poster": {
          name: "HIMSS पोस्टर",
          description:
            "HIMSS सम्मेलन पोस्टर - पृष्ठभूमि, विधियाँ, मुख्य निष्कर्ष और प्रभाव कथन के लिए संक्षिप्त पैनल",
          sections: {
            background: "पृष्ठभूमि",
            "problem-statement": "समस्या कथन",
            objectives: "उद्देश्य",
            methods: "विधियाँ",
            "key-findings": "मुख्य निष्कर्ष",
            "clinical-impact": "नैदानिक और परिचालन प्रभाव",
            "next-steps": "अगले कदम",
          },
        },
      },
    },
  },
);

export const publishCareGapRiskResources: Record<string, MessageTree> = {
  "en-US": enPublishCareGapRisk,
  "es-ES": esPublishCareGapRisk,
  "fr-FR": frPublishCareGapRisk,
  "de-DE": dePublishCareGapRiskPass100,
  "pt-BR": ptPublishCareGapRiskPass100,
  "fi-FI": mergeMessageTrees(enPublishCareGapRisk, {}),
  "ja-JP": mergeMessageTrees(enPublishCareGapRisk, {}),
  "zh-Hans": mergeMessageTrees(enPublishCareGapRisk, {}),
  "ko-KR": koPublishCareGapRisk,
  "hi-IN": hiPublishCareGapRisk,
  ar: mergeMessageTrees(enPublishCareGapRisk, {}),
  "en-XA": mergeMessageTrees(enPublishCareGapRisk, {}),
};
